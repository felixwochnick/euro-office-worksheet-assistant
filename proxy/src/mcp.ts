/**
 * MCP endpoint (POST /mcp, Streamable HTTP, stateless): AI clients such as Claude, ChatGPT or Le Chat work on
 * the document that the user has open in Euro-Office. Every document tool is forwarded through the plugin
 * bridge (bridge.ts) to the editor; music helpers (convert_german_notes, add_lyrics) run on the server.
 *
 * Arguments are validated with the same rules as chat tool calls (tools.ts), so ABC and worksheet blocks are
 * checked before they reach the editor.
 */
import { createMcpHandler, McpServer, type CallToolResult, type McpHttpHandler, type StandardSchemaWithJSON } from '@modelcontextprotocol/server';
import type { Identity } from './auth.js';
import { Bridge, BridgeError } from './bridge.js';
import { BASE_SYSTEM_PROMPT, renderDocumentContext } from './prompt.js';
import { checkClientToolCall, CLIENT_TOOLS, executeServerTool, SERVER_TOOLS, TOOL_DEFINITIONS } from './tools.js';
import type { DocumentContext, ToolDefinition } from './types.js';

export const MCP_INSTRUCTIONS =
  `This server edits the document that the user has open in Euro-Office (also called Nextcloud Office) through the ` +
  `"Arbeitsblatt-Assistent" (worksheet assistant) plugin. Start with get_document_outline; if the user has several ` +
  `documents open, use list_open_documents and pass document_id. Changes are applied immediately – the user sees ` +
  `them in the editor and can undo them there (Ctrl+Z).\n\n` +
  BASE_SYSTEM_PROMPT.replace(
    '- The current document outline is given below.',
    '- Get the current document outline with get_document_outline (again after edits).',
  ).replace('delete_elements(from, to) removes elements (the user confirms).', 'delete_elements(from, to) removes elements.');

const DOCUMENT_ID_PROPERTY = {
  type: 'string',
  description: 'Optional: id of the document from list_open_documents. Default: the document the user worked in most recently.',
};

const TITLES: Record<string, string> = {
  list_open_documents: 'List open documents',
  get_document_outline: 'Read document outline',
  get_elements: 'Read elements',
  insert_blocks: 'Insert worksheet content',
  replace_elements: 'Replace elements',
  delete_elements: 'Delete elements',
  insert_staff: 'Insert music staff',
  insert_empty_staves: 'Insert empty staves',
  replace_staff: 'Change music staff',
  convert_german_notes: 'Convert German note names to ABC',
  add_lyrics: 'Add lyrics to a tune',
};

const READ_ONLY = new Set(['list_open_documents', 'get_document_outline', 'get_elements', 'convert_german_notes', 'add_lyrics']);
const DESTRUCTIVE = new Set(['replace_elements', 'delete_elements', 'replace_staff']);

/**
 * A JSON Schema as Standard Schema for the SDK. Validation is done by checkClientToolCall / the server tools
 * (they accept a few lenient variants and give model-friendly error messages), so this only checks the shape.
 */
function jsonSchema(schema: Record<string, unknown>): StandardSchemaWithJSON<Record<string, unknown>> {
  return {
    '~standard': {
      version: 1,
      vendor: 'worksheet-assistant',
      validate: (value: unknown) =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? { value: value as Record<string, unknown> }
          : { issues: [{ message: 'The arguments must be a JSON object.' }] },
      jsonSchema: { input: () => schema, output: () => schema },
    },
  };
}

function text(value: unknown, isError = false): CallToolResult {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }], isError };
}

function withDocumentId(def: ToolDefinition): Record<string, unknown> {
  const params = def.parameters as { properties?: Record<string, unknown> };
  return { ...def.parameters, properties: { ...(params.properties ?? {}), document_id: DOCUMENT_ID_PROPERTY } };
}

export interface McpOptions {
  bridge: Bridge;
  version: string;
  /** Called after every tool call (for logging). */
  onToolCall?: (info: { user: string; tool: string; ok: boolean; ms: number }) => void;
}

/** Build the MCP server for one request (stateless) and one authenticated user. */
export function buildMcpServer(identity: Identity, opts: McpOptions): McpServer {
  const server = new McpServer(
    { name: 'arbeitsblatt-assistent', title: 'Arbeitsblatt-Assistent (Euro-Office)', version: opts.version },
    { instructions: MCP_INSTRUCTIONS },
  );
  const { bridge } = opts;

  const run = async (tool: string, fn: () => Promise<CallToolResult>): Promise<CallToolResult> => {
    const started = Date.now();
    let result: CallToolResult;
    try {
      result = await fn();
    } catch (err) {
      result = err instanceof BridgeError ? text(err.message, true) : text(`Internal error: ${(err as Error).message}`, true);
    }
    opts.onToolCall?.({ user: identity.userId, tool, ok: !result.isError, ms: Date.now() - started });
    return result;
  };

  server.registerTool(
    'list_open_documents',
    {
      title: TITLES.list_open_documents,
      description:
        'Documents the user currently has open in Euro-Office with the Arbeitsblatt-Assistent panel and MCP access ' +
        'switched on. The first one is the most recently used (the default for all other tools).',
      inputSchema: jsonSchema({ type: 'object', properties: {} }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      run('list_open_documents', async () => {
        const docs = bridge.list(identity.userId).map((s, i) => ({
          document_id: s.id,
          title: s.title,
          default: i === 0,
          connected_since: new Date(s.connectedAt).toISOString(),
          last_active: new Date(s.lastActiveAt).toISOString(),
        }));
        if (!docs.length) bridge.pick(identity.userId); // throws the explanatory error
        return text({ documents: docs });
      }),
  );

  for (const def of TOOL_DEFINITIONS) {
    const name = def.name;
    const isClient = CLIENT_TOOLS.has(name);
    if (!isClient && !SERVER_TOOLS.has(name)) continue;
    server.registerTool(
      name,
      {
        title: TITLES[name] ?? name,
        description: def.description,
        inputSchema: jsonSchema(isClient ? withDocumentId(def) : def.parameters),
        annotations: {
          readOnlyHint: READ_ONLY.has(name),
          destructiveHint: DESTRUCTIVE.has(name),
          idempotentHint: READ_ONLY.has(name),
          openWorldHint: false,
        },
      },
      async (rawArgs: Record<string, unknown>) =>
        run(name, async () => {
          const { document_id, ...args } = rawArgs;
          if (!isClient) {
            const result = executeServerTool({ id: 'mcp', name, arguments: args }) as { ok?: boolean };
            return text(result, result?.ok === false);
          }
          const check = checkClientToolCall({ id: 'mcp', name, arguments: args });
          if (!check.ok) return text({ ok: false, error: check.error }, true);
          const session = bridge.pick(identity.userId, typeof document_id === 'string' ? document_id : undefined);
          const result = (await session.call(name, check.args)) as Record<string, unknown> | null;
          if (name === 'get_document_outline' && result && result.outline) {
            // Readable outline (same format the chat model gets) plus the document id.
            return text(`Document "${session.title}" (document_id ${session.id})\n${renderDocumentContext(result.outline as DocumentContext)}`);
          }
          return text({ ...(result ?? {}), document_id: session.id }, !result || result.ok === false);
        }),
    );
  }
  return server;
}

/** The MCP HTTP handler. The caller authenticates and passes the identity as authInfo.extra.identity. */
export function createMcpEndpoint(opts: McpOptions): McpHttpHandler {
  return createMcpHandler(
    (ctx) => {
      const identity = ctx.authInfo?.extra?.identity as Identity | undefined;
      if (!identity) throw new Error('unauthenticated MCP request');
      return buildMcpServer(identity, opts);
    },
    { legacy: 'stateless', responseMode: 'json' },
  );
}

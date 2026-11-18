/**
 * `arbeitsblatt-assistent mcp-stdio`: an MCP server on stdin/stdout for clients that start local servers as a
 * command (Claude Desktop, …). It forwards every tool call to the running companion's HTTP endpoint, where the
 * editors are connected. If the companion is not running yet, it is started in the background first.
 *
 * Nothing but MCP messages may be written to stdout; diagnostics go to stderr.
 */
import { spawn } from 'node:child_process';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { McpServer, type CallToolResult, type StandardSchemaWithJSON } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { VERSION } from '../version.js';
import { launchCommand } from './autostart.js';

function passthrough(schema: Record<string, unknown>): StandardSchemaWithJSON<Record<string, unknown>> {
  return {
    '~standard': {
      version: 1,
      vendor: 'worksheet-assistant',
      validate: (value: unknown) => ({ value: (value ?? {}) as Record<string, unknown> }),
      jsonSchema: { input: () => schema, output: () => schema },
    },
  };
}

async function running(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/v1/meta`, { signal: AbortSignal.timeout(1500) });
    const meta = (await res.json()) as { auth_mode?: string };
    return res.ok && meta.auth_mode === 'local';
  } catch {
    return false;
  }
}

export async function ensureCompanionRunning(url: string): Promise<void> {
  if (await running(url)) return;
  const [cmd, ...args] = launchCommand();
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await running(url)) return;
  }
  throw new Error(`The companion did not start (${url}).`);
}

export async function runStdio(url: string): Promise<void> {
  await ensureCompanionRunning(url);
  const client = new Client({ name: 'arbeitsblatt-assistent-stdio', version: VERSION });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`)));
  const { tools } = await client.listTools();
  const instructions = client.getInstructions?.() ?? undefined;
  serveStdio(
    () => {
      const server = new McpServer({ name: 'arbeitsblatt-assistent', title: 'Arbeitsblatt-Assistent (Euro-Office)', version: VERSION }, { instructions });
      for (const t of tools) {
        server.registerTool(
          t.name,
          {
            title: t.title,
            description: t.description,
            inputSchema: passthrough(t.inputSchema as Record<string, unknown>),
            annotations: t.annotations,
          },
          async (args: Record<string, unknown>) => {
            try {
              return (await client.callTool({ name: t.name, arguments: args })) as CallToolResult;
            } catch (err) {
              return { content: [{ type: 'text', text: `The Arbeitsblatt-Assistent companion is not reachable: ${(err as Error).message}` }], isError: true };
            }
          },
        );
      }
      return server;
    },
    { onerror: (err) => process.stderr.write(`mcp-stdio: ${err.message}\n`) },
  );
}

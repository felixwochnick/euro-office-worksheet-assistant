/**
 * One step of the agent loop.
 *
 * The plugin sends the full conversation. The proxy calls the model, executes
 * server-side tools and rejects invalid client tool calls internally (looping
 * back to the model), and returns as soon as
 *   - the model produced a final answer (done = true), or
 *   - there are client tool calls the plugin must execute (pending_tool_calls).
 * The plugin executes them, appends the tool results and calls again.
 *
 * Iterations are counted as assistant messages with tool calls since the last
 * user message – across requests – so a misbehaving model or client cannot
 * loop forever: when the limit is reached the model is forced to answer in text.
 */
import { buildSystemPrompt } from './prompt.js';
import type { ImageService } from './images.js';
import { CLIENT_TOOLS, SERVER_TOOLS, checkToolCall, runServerTool, toolDefinitions, type ToolContext } from './tools.js';
import type { AssistantMessage, ChatMessage, DocumentContext, LLMProvider, ToolCall, ToolMessage } from './types.js';

export interface TurnResult {
  /** New messages to append to the conversation (in order). */
  messages: ChatMessage[];
  /** Client tool calls the plugin has to execute (subset of the last assistant message). */
  pending_tool_calls: ToolCall[];
  done: boolean;
  iterations: number;
  max_iterations: number;
}

export function countToolRounds(messages: ChatMessage[]): number {
  let n = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user') break;
    if (m.role === 'assistant' && m.tool_calls?.length) n++;
  }
  return n;
}

function toolMessage(call: ToolCall, result: unknown): ToolMessage {
  return { role: 'tool', tool_call_id: call.id, name: call.name, content: JSON.stringify(result) };
}

export async function runTurn(opts: {
  provider: LLMProvider;
  messages: ChatMessage[];
  documentContext?: DocumentContext;
  maxIterations: number;
  /** Signed-in user (own pictures). */
  userId?: string;
  /** Picture search (null/undefined = pictures switched off). */
  images?: ImageService | null;
}): Promise<TurnResult> {
  const ctx: ToolContext = { userId: opts.userId ?? 'default', images: opts.images ?? null };
  const tools = toolDefinitions(ctx);
  const history: ChatMessage[] = [...opts.messages];
  const appended: ChatMessage[] = [];
  const max = opts.maxIterations;

  // Hard stop for the internal loop (each pass adds one tool round, so this is
  // reached only if something is inconsistent).
  for (let guard = 0; guard <= max + 1; guard++) {
    const rounds = countToolRounds(history);
    const forceFinal = rounds >= max;
    const result = await opts.provider.complete({
      system: buildSystemPrompt(opts.documentContext, { forceFinal, pictures: !!ctx.images }),
      messages: history,
      tools,
      toolChoice: forceFinal ? 'none' : 'auto',
    });

    const calls = forceFinal ? [] : result.tool_calls;
    const assistant: AssistantMessage = { role: 'assistant', content: result.content ?? '' };
    if (calls.length) assistant.tool_calls = calls;
    if (!calls.length && !assistant.content.trim()) {
      assistant.content = result.truncated
        ? 'Die KI hat ihr Antwortlimit erreicht, bevor sie fertig war. Bitte formuliere die Anfrage kürzer oder in ' +
          'Teilschritten (z. B. erst die Noten, dann den Text). Administratoren können LLM_MAX_TOKENS im Proxy erhöhen.'
        : forceFinal
        ? 'Ich habe die maximale Anzahl an Arbeitsschritten erreicht. Bitte prüfe das Dokument und formuliere die Anfrage ggf. neu.'
        : 'Entschuldigung, ich habe keine Antwort erhalten. Bitte versuche es noch einmal.';
    }
    history.push(assistant);
    appended.push(assistant);

    if (!calls.length) {
      return { messages: appended, pending_tool_calls: [], done: true, iterations: rounds, max_iterations: max };
    }

    // Validate client calls, run server calls.
    const serverResults: ToolMessage[] = [];
    const clientCalls: ToolCall[] = [];
    const rejected: ToolMessage[] = [];
    for (const call of calls) {
      if (SERVER_TOOLS.has(call.name) && tools.some((t) => t.name === call.name)) {
        serverResults.push(toolMessage(call, await runServerTool(call, ctx)));
      } else if (CLIENT_TOOLS.has(call.name)) {
        const check = await checkToolCall(call, ctx);
        if (check.ok) {
          call.arguments = check.args; // normalised arguments (also stored in history)
          clientCalls.push(call);
        } else {
          rejected.push(toolMessage(call, { ok: false, error: check.error }));
        }
      } else {
        rejected.push(toolMessage(call, { ok: false, error: `Unknown tool "${call.name}".` }));
      }
    }

    if (rejected.length) {
      // Do not execute anything from a batch that contains invalid calls:
      // the model corrects and resends the batch.
      const skipped = clientCalls.map((c) =>
        toolMessage(c, { ok: false, error: 'Not executed because another tool call in the same step was invalid. Send it again after fixing the error.' }),
      );
      const msgs = [...serverResults, ...rejected, ...skipped];
      // Keep tool results in the order of the calls.
      msgs.sort((a, b) => calls.findIndex((c) => c.id === a.tool_call_id) - calls.findIndex((c) => c.id === b.tool_call_id));
      history.push(...msgs);
      appended.push(...msgs);
      continue;
    }

    history.push(...serverResults);
    appended.push(...serverResults);
    if (clientCalls.length) {
      return { messages: appended, pending_tool_calls: clientCalls, done: false, iterations: rounds + 1, max_iterations: max };
    }
  }
  // Should not happen – the forced final answer ends the loop.
  const fallback: AssistantMessage = { role: 'assistant', content: 'Die Anfrage konnte nicht abgeschlossen werden.' };
  appended.push(fallback);
  return { messages: appended, pending_tool_calls: [], done: true, iterations: max, max_iterations: max };
}

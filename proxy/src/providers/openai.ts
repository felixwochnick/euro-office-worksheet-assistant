/**
 * OpenAI-compatible chat completions provider.
 * Used for Mistral (https://api.mistral.ai/v1), OpenAI, Ollama (http://ollama:11434/v1),
 * LM Studio, vLLM and other servers implementing /chat/completions with tools.
 */
import type { ChatMessage, CompletionRequest, CompletionResult, LLMProvider, ToolCall } from '../types.js';
import { parseArguments, postJson } from './http.js';

export interface OpenAICompatibleOptions {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  readonly model: string;

  constructor(private readonly opts: OpenAICompatibleOptions) {
    this.name = opts.name;
    this.model = opts.model;
  }

  static toWireMessages(system: string, messages: ChatMessage[]): unknown[] {
    const out: unknown[] = [{ role: 'system', content: system }];
    for (const m of messages) {
      if (m.role === 'user') out.push({ role: 'user', content: m.content });
      else if (m.role === 'assistant') {
        const msg: Record<string, unknown> = { role: 'assistant', content: m.content ?? '' };
        if (m.tool_calls?.length) {
          msg.tool_calls = m.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments ?? {}) },
          }));
        }
        out.push(msg);
      } else {
        out.push({ role: 'tool', tool_call_id: m.tool_call_id, name: m.name, content: m.content });
      }
    }
    return out;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const body: Record<string, unknown> = {
      model: this.opts.model,
      messages: OpenAICompatibleProvider.toWireMessages(req.system, req.messages),
      temperature: this.opts.temperature,
      max_tokens: this.opts.maxTokens,
      tools: req.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: req.toolChoice,
    };
    const headers: Record<string, string> = {};
    if (this.opts.apiKey) headers.authorization = `Bearer ${this.opts.apiKey}`;
    const url = this.opts.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const data = await postJson(url, headers, body, this.opts.timeoutMs);

    const message = data?.choices?.[0]?.message ?? {};
    const content = typeof message.content === 'string'
      ? message.content
      : Array.isArray(message.content)
        ? message.content.map((c: any) => (typeof c?.text === 'string' ? c.text : '')).join('')
        : '';
    const toolCalls: ToolCall[] = (Array.isArray(message.tool_calls) ? message.tool_calls : [])
      .filter((tc: any) => tc?.function?.name)
      .map((tc: any, i: number) => ({
        id: String(tc.id || `call${Date.now().toString(36)}${i}`).slice(0, 64),
        name: String(tc.function.name),
        arguments: parseArguments(tc.function.arguments),
      }));
    return { content, tool_calls: toolCalls };
  }
}

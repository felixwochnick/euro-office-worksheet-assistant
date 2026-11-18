/**
 * Anthropic Messages API provider (https://api.anthropic.com/v1/messages).
 */
import type { ChatMessage, CompletionRequest, CompletionResult, LLMProvider, ToolCall } from '../types.js';
import { postJson } from './http.js';

export interface AnthropicOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

type Block = Record<string, unknown>;
interface WireMessage {
  role: 'user' | 'assistant';
  content: Block[];
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly model: string;

  constructor(private readonly opts: AnthropicOptions) {
    this.model = opts.model;
  }

  /**
   * Convert neutral messages: tool results become tool_result blocks in a user
   * message, consecutive messages of the same role are merged (the API
   * requires alternating roles).
   */
  static toWireMessages(messages: ChatMessage[]): WireMessage[] {
    const out: WireMessage[] = [];
    const push = (role: 'user' | 'assistant', blocks: Block[]) => {
      if (!blocks.length) return;
      const last = out[out.length - 1];
      if (last && last.role === role) last.content.push(...blocks);
      else out.push({ role, content: blocks });
    };
    for (const m of messages) {
      if (m.role === 'user') push('user', [{ type: 'text', text: m.content || ' ' }]);
      else if (m.role === 'assistant') {
        const blocks: Block[] = [];
        if (m.content) blocks.push({ type: 'text', text: m.content });
        for (const tc of m.tool_calls ?? []) blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments ?? {} });
        push('assistant', blocks.length ? blocks : [{ type: 'text', text: ' ' }]);
      } else {
        push('user', [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }]);
      }
    }
    return out;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const body = {
      model: this.opts.model,
      system: req.system,
      max_tokens: this.opts.maxTokens,
      temperature: this.opts.temperature,
      messages: AnthropicProvider.toWireMessages(req.messages),
      tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      tool_choice: { type: req.toolChoice },
    };
    const url = this.opts.baseUrl.replace(/\/+$/, '') + '/v1/messages';
    const data = await postJson(
      url,
      { 'x-api-key': this.opts.apiKey, 'anthropic-version': '2023-06-01' },
      body,
      this.opts.timeoutMs,
    );
    const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
    const content = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const toolCalls: ToolCall[] = blocks
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ id: String(b.id), name: String(b.name), arguments: (b.input ?? {}) as Record<string, unknown> }));
    return { content, tool_calls: toolCalls, truncated: data?.stop_reason === 'max_tokens' };
  }
}

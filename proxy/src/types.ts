/**
 * Provider-neutral chat protocol shared by the plugin and the proxy.
 * The plugin keeps the conversation and sends the full history on every
 * request; the proxy is stateless.
 */

export interface ToolCall {
  /** Provider-issued id; must be echoed back in the matching tool message. */
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface UserMessage {
  role: 'user';
  content: string;
}

export interface AssistantMessage {
  role: 'assistant';
  content: string;
  tool_calls?: ToolCall[];
}

export interface ToolMessage {
  role: 'tool';
  tool_call_id: string;
  name: string;
  /** JSON-encoded tool result. */
  content: string;
}

export type ChatMessage = UserMessage | AssistantMessage | ToolMessage;

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema of the arguments object. */
  parameters: Record<string, unknown>;
}

export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  /** 'none' forces a plain text answer (used when the iteration limit is reached). */
  toolChoice: 'auto' | 'none';
}

export interface CompletionResult {
  content: string;
  tool_calls: ToolCall[];
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

/** Document information sent by the plugin with every request. */
export interface DocumentContext {
  elements?: Array<{
    index: number;
    type?: string;
    text?: string;
    style?: string;
    is_heading?: boolean;
    heading_level?: number | null;
    has_image?: boolean;
    abc?: string | null;
    /** Number of the staff in document order ("Notenzeile 1" = first staff). */
    staff_number?: number;
    /** The staff image in this element is currently selected. */
    selected?: boolean;
  }>;
  cursor_index?: number | null;
  total_elements?: number;
  truncated?: boolean;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ProviderError';
  }
}

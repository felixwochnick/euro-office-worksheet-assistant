import type { Config } from '../config.js';
import { ProviderError, type LLMProvider } from '../types.js';
import { AnthropicProvider } from './anthropic.js';
import { MockProvider } from './mock.js';
import { OpenAICompatibleProvider } from './openai.js';

export function createProvider(cfg: Config): LLMProvider {
  switch (cfg.provider) {
    case 'anthropic':
      return new AnthropicProvider({
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        timeoutMs: cfg.timeoutMs,
      });
    case 'mock':
      return new MockProvider();
    case 'none':
      // MCP-only deployment: the AI client (e.g. Claude) brings its own model.
      return {
        name: 'none',
        model: '',
        complete: async () => {
          throw new ProviderError('The AI chat is disabled on this server (LLM_PROVIDER=none) – use an MCP client instead.', 503);
        },
      };
    case 'mistral':
    case 'openai':
      return new OpenAICompatibleProvider({
        name: cfg.provider,
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        timeoutMs: cfg.timeoutMs,
        reasoningEffort: cfg.reasoningEffort,
      });
  }
}

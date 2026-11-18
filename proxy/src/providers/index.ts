import type { Config } from '../config.js';
import type { LLMProvider } from '../types.js';
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

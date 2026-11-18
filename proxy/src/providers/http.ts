import { ProviderError } from '../types.js';

/** POST JSON with timeout; throws ProviderError with a short, log-safe message. */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === 'TimeoutError') throw new ProviderError(`LLM request timed out after ${timeoutMs} ms`, 504);
    throw new ProviderError(`LLM request failed: ${e.message}`, 502);
  }
  const text = await res.text();
  if (!res.ok) {
    // Upstream error bodies can be long; keep the first part for diagnostics.
    throw new ProviderError(`LLM API error ${res.status}: ${text.slice(0, 500)}`, res.status === 429 ? 429 : 502);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError('LLM API returned invalid JSON', 502);
  }
}

/** Parse tool-call arguments; keep the raw string if it is not valid JSON. */
export function parseArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || raw.trim() === '') return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : { __raw: raw };
  } catch {
    return { __raw: raw };
  }
}

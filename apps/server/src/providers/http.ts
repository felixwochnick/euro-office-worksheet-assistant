import { ProviderError } from '../types.js';

/** Status codes of temporary provider problems (overloaded, rate limited, gateway errors). */
const TRANSIENT = new Set([429, 502, 503, 504, 529]);

/** The provider's error message from a JSON error body ({"message"} or {"error": {"message"}}), else the text. */
export function errorDetail(text: string): string {
  try {
    const j = JSON.parse(text) as { message?: unknown; error?: { message?: unknown } | string };
    const m = j.message ?? (typeof j.error === 'object' ? j.error?.message : j.error);
    if (typeof m === 'string' && m.trim()) return m.trim().slice(0, 300);
  } catch {
    /* not JSON */
  }
  return text.slice(0, 300);
}

/**
 * POST JSON with timeout; throws ProviderError with a short, log-safe message.
 * Temporary errors (429/5xx overload) are retried up to twice with a short pause.
 */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  retryDelaysMs: number[] = [1500, 4000],
): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await postJsonOnce(url, headers, body, timeoutMs);
    } catch (err) {
      const status = err instanceof ProviderError ? err.upstreamStatus : undefined;
      if (status === undefined || !TRANSIENT.has(status) || attempt >= retryDelaysMs.length) throw err;
      await new Promise((r) => setTimeout(r, retryDelaysMs[attempt]));
    }
  }
}

async function postJsonOnce(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<any> {
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
    const detail = errorDetail(text);
    const message = TRANSIENT.has(res.status)
      ? `The AI provider is busy or not available right now (HTTP ${res.status}: ${detail}). Please try again in a moment.`
      : `LLM API error ${res.status}: ${detail}`;
    throw new ProviderError(message, res.status === 429 ? 429 : 502, res.status);
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

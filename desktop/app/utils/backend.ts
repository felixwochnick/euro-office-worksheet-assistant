/**
 * Calls into the Rust side of the app (src-tauri/src/lib.rs). Outside of Tauri (`nuxt dev` in a browser, UI
 * tests) a simulated backend answers instead, so the window can be developed and checked without the app.
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (inTauri()) return invoke<T>(command, args)
  const { mockCall } = await import('./mock-backend')
  return mockCall(command, args) as Promise<T>
}

export async function onEvent<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
  if (inTauri()) return listen<T>(event, e => handler(e.payload))
  const { mockListen } = await import('./mock-backend')
  return mockListen(event, handler as (payload: unknown) => void)
}

/** The companion's settings API (/companion/api/<path>); POST when a body is given. */
export function companion<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  return call<T>('api', { method: body === undefined ? 'GET' : 'POST', path, body: body ?? null })
}

/** Error text of a failed call (Tauri rejects with a string). */
export function errorText(err: unknown): string {
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  return String(err)
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { countToolRounds, runTurn } from '../src/agent.js';
import { loadConfig, type Config } from '../src/config.js';
import { AnthropicProvider } from '../src/providers/anthropic.js';
import { MockProvider } from '../src/providers/mock.js';
import { OpenAICompatibleProvider } from '../src/providers/openai.js';
import { buildServer } from '../src/server.js';
import { checkClientToolCall, normalizePosition } from '../src/tools.js';
import type { ChatMessage, CompletionRequest, CompletionResult, LLMProvider } from '../src/types.js';

const TOKEN = 'test-token-0123456789';

function cfg(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    LLM_PROVIDER: 'mock',
    PROXY_TOKEN: TOKEN,
    CORS_ORIGINS: 'https://cloud.example.org',
    LOG_LEVEL: 'silent',
    ...overrides,
  });
}

/** Provider returning scripted results and recording requests. */
class ScriptedProvider implements LLMProvider {
  readonly name = 'scripted';
  readonly model = 'scripted';
  requests: CompletionRequest[] = [];
  constructor(private readonly script: Array<CompletionResult | ((r: CompletionRequest) => CompletionResult)>) {}
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    this.requests.push(req);
    const step = this.script[Math.min(this.requests.length - 1, this.script.length - 1)];
    return typeof step === 'function' ? step(req) : step;
  }
}

const VALID_ABC = 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\nC F G2 |]';

// ---------------------------------------------------------------------------

test('config: requires token and API key', () => {
  assert.throws(() => loadConfig({ LLM_PROVIDER: 'mock' }), /PROXY_TOKEN/);
  assert.throws(() => loadConfig({ LLM_PROVIDER: 'mistral', PROXY_TOKEN: TOKEN }), /API key/);
  assert.throws(() => loadConfig({ LLM_PROVIDER: 'nope', PROXY_TOKEN: TOKEN }), /LLM_PROVIDER/);
  assert.throws(() => loadConfig({ LLM_PROVIDER: 'mock', PROXY_TOKEN: 'short' }), /16/);
  const c = loadConfig({ PROXY_TOKEN: TOKEN, MISTRAL_API_KEY: 'k' });
  assert.equal(c.provider, 'mistral');
  assert.equal(c.model, 'mistral-large-latest');
  const o = loadConfig({ PROXY_TOKEN: TOKEN, LLM_PROVIDER: 'openai', LLM_BASE_URL: 'http://ollama:11434/v1', LLM_MODEL: 'qwen2.5' });
  assert.equal(o.apiKey, '');
  assert.equal(o.model, 'qwen2.5');
});

test('tools: position normalisation', () => {
  assert.equal(normalizePosition(undefined), 'cursor');
  assert.equal(normalizePosition('cursor'), 'cursor');
  assert.deepEqual(normalizePosition({ after_paragraph_index: 3 }), { after_paragraph_index: 3 });
  assert.deepEqual(normalizePosition({ after_paragraph_index: '4' }), { after_paragraph_index: 4 });
  assert.deepEqual(normalizePosition('after_paragraph_index: 7'), { after_paragraph_index: 7 });
  assert.deepEqual(normalizePosition({ type: 'after_heading', heading: 'Aufgabe 2' }), { after_heading: 'Aufgabe 2' });
  assert.equal(normalizePosition({ after_paragraph_index: -1 }), null);
  assert.equal(normalizePosition('somewhere'), null);
});

test('tools: insert_staff validates and normalises ABC', () => {
  const ok = checkClientToolCall({ id: '1', name: 'insert_staff', arguments: { abc: '```abc\n' + VALID_ABC + '\n```', position: 'cursor' } });
  assert.equal(ok.ok, true);
  assert.equal(ok.args.abc, VALID_ABC);
  assert.equal(ok.args.width_cm, undefined); // the plugin falls back to the user's default width
  const bad = checkClientToolCall({ id: '2', name: 'insert_staff', arguments: { abc: 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\nc d e h', position: 'cursor' } });
  assert.equal(bad.ok, false);
  assert.match(bad.error!, /German note "h"/);
  const noClef = checkClientToolCall({ id: '3', name: 'insert_staff', arguments: { abc: 'X:1\nM:4/4\nL:1/4\nK:C\nC', position: 'cursor' } });
  assert.equal(noClef.ok, false);
  const empty = checkClientToolCall({ id: '4', name: 'insert_empty_staves', arguments: { clef: 'bass', count: 2, position: { after_paragraph_index: 1 }, width_cm: 40 } });
  assert.deepEqual(empty.args, { clef: 'bass', count: 2, measures: 4, position: { after_paragraph_index: 1 }, width_cm: 19 });
});

test('agent: mock provider runs the worksheet scenario', async () => {
  const provider = new MockProvider();
  const messages: ChatMessage[] = [
    { role: 'user', content: 'Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein und darunter eine leere Zeile zum Nachschreiben' },
  ];
  // Step 1: convert_german_notes runs on the server, insert_staff is returned to the client.
  const r1 = await runTurn({ provider, messages, maxIterations: 6 });
  assert.equal(r1.done, false);
  assert.equal(r1.pending_tool_calls.length, 1);
  const staff = r1.pending_tool_calls[0];
  assert.equal(staff.name, 'insert_staff');
  assert.equal(staff.arguments.abc, 'X:1\nM:none\nL:1/4\nK:C clef=treble\nC F G |]');
  assert.deepEqual(staff.arguments.position, { after_heading: 'Aufgabe 2' });
  const conv = r1.messages.find((m) => m.role === 'tool' && m.name === 'convert_german_notes');
  assert.ok(conv, 'server tool result is part of the returned messages');

  messages.push(...r1.messages, { role: 'tool', tool_call_id: staff.id, name: staff.name, content: JSON.stringify({ ok: true, index: 5 }) });
  const r2 = await runTurn({ provider, messages, maxIterations: 6 });
  assert.equal(r2.pending_tool_calls[0].name, 'insert_empty_staves');
  assert.deepEqual(r2.pending_tool_calls[0].arguments.position, { after_paragraph_index: 5 });

  const empty = r2.pending_tool_calls[0];
  messages.push(...r2.messages, { role: 'tool', tool_call_id: empty.id, name: empty.name, content: JSON.stringify({ ok: true, index: 6 }) });
  const r3 = await runTurn({ provider, messages, maxIterations: 6 });
  assert.equal(r3.done, true);
  assert.match((r3.messages[0] as { content: string }).content, /Notenzeile/);
});

test('agent: invalid ABC is sent back to the model, not to the client', async () => {
  const provider = new ScriptedProvider([
    { content: '', tool_calls: [{ id: 'a1', name: 'insert_staff', arguments: { abc: 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\nc fis g', position: 'cursor' } }] },
    { content: '', tool_calls: [{ id: 'a2', name: 'insert_staff', arguments: { abc: 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\nc ^f g', position: 'cursor' } }] },
  ]);
  const r = await runTurn({ provider, messages: [{ role: 'user', content: 'x' }], maxIterations: 6 });
  assert.equal(provider.requests.length, 2);
  assert.equal(r.pending_tool_calls.length, 1);
  assert.equal(r.pending_tool_calls[0].id, 'a2');
  const err = r.messages.find((m) => m.role === 'tool' && m.tool_call_id === 'a1') as { content: string };
  assert.match(err.content, /Accidentals are written before the note/);
});

test('agent: iteration limit forces a final text answer', async () => {
  const provider = new ScriptedProvider([
    (req) =>
      req.toolChoice === 'none'
        ? { content: 'Zusammenfassung', tool_calls: [] }
        : { content: '', tool_calls: [{ id: 'x' + Math.random().toString(36).slice(2, 8), name: 'convert_german_notes', arguments: { notes: 'c' } }] },
  ]);
  const r = await runTurn({ provider, messages: [{ role: 'user', content: 'loop' }], maxIterations: 3 });
  assert.equal(r.done, true);
  assert.equal(provider.requests.length, 4); // 3 tool rounds + forced final answer
  assert.equal(provider.requests[3].toolChoice, 'none');
  assert.match(provider.requests[3].system, /maximum number of tool steps/);
  assert.equal((r.messages.at(-1) as { content: string }).content, 'Zusammenfassung');
  assert.equal(countToolRounds([...r.messages]), 3);
});

test('providers: OpenAI-compatible wire format', () => {
  const wire = OpenAICompatibleProvider.toWireMessages('sys', [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: '', tool_calls: [{ id: 'abc123def', name: 'get_document_outline', arguments: {} }] },
    { role: 'tool', tool_call_id: 'abc123def', name: 'get_document_outline', content: '{}' },
  ]) as any[];
  assert.equal(wire[0].role, 'system');
  assert.equal(wire[2].tool_calls[0].function.arguments, '{}');
  assert.equal(wire[3].tool_call_id, 'abc123def');
});

test('providers: Anthropic wire format merges tool results into one user turn', () => {
  const wire = AnthropicProvider.toWireMessages([
    { role: 'user', content: 'hi' },
    {
      role: 'assistant',
      content: 'ok',
      tool_calls: [
        { id: 't1', name: 'insert_staff', arguments: { abc: VALID_ABC } },
        { id: 't2', name: 'get_document_outline', arguments: {} },
      ],
    },
    { role: 'tool', tool_call_id: 't1', name: 'insert_staff', content: '{"ok":true}' },
    { role: 'tool', tool_call_id: 't2', name: 'get_document_outline', content: '{}' },
  ]);
  assert.equal(wire.length, 3);
  assert.equal(wire[1].content.length, 3);
  assert.equal(wire[2].role, 'user');
  assert.deepEqual(wire[2].content.map((b) => b.type), ['tool_result', 'tool_result']);
});

test('server: auth, CORS, validation and chat', async () => {
  const app = await buildServer(cfg());
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/healthz' })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/info' })).statusCode, 401);
    assert.equal(
      (await app.inject({ method: 'GET', url: '/v1/info', headers: { authorization: 'Bearer wrong-token-0000000' } })).statusCode,
      401,
    );
    const info = await app.inject({ method: 'GET', url: '/v1/info', headers: { authorization: `Bearer ${TOKEN}` } });
    assert.equal(info.json().provider, 'mock');

    const preflightOk = await app.inject({
      method: 'OPTIONS',
      url: '/v1/chat',
      headers: { origin: 'https://cloud.example.org', 'access-control-request-method': 'POST' },
    });
    assert.equal(preflightOk.headers['access-control-allow-origin'], 'https://cloud.example.org');
    const preflightBad = await app.inject({
      method: 'OPTIONS',
      url: '/v1/chat',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    assert.equal(preflightBad.headers['access-control-allow-origin'], undefined);

    const bad = await app.inject({ method: 'POST', url: '/v1/chat', headers: { authorization: `Bearer ${TOKEN}` }, payload: { messages: [] } });
    assert.equal(bad.statusCode, 400);

    const orphan = await app.inject({
      method: 'POST',
      url: '/v1/chat',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { messages: [{ role: 'user', content: 'x' }, { role: 'tool', tool_call_id: 'nope', name: 'x', content: '{}' }] },
    });
    assert.equal(orphan.statusCode, 400);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat',
      headers: { authorization: `Bearer ${TOKEN}`, origin: 'https://cloud.example.org' },
      payload: {
        messages: [{ role: 'user', content: 'Füge eine Notenzeile mit c – f – g im Violinschlüssel ein' }],
        document_context: { elements: [{ index: 0, text: 'Aufgabe 1', is_heading: true }], cursor_index: 0 },
      },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.done, false);
    assert.equal(body.pending_tool_calls[0].name, 'insert_staff');
  } finally {
    await app.close();
  }
});

test('server: rate limit', async () => {
  const app = await buildServer(cfg({ RATE_LIMIT_MAX: '2' }));
  try {
    const call = () => app.inject({ method: 'GET', url: '/v1/info', headers: { authorization: `Bearer ${TOKEN}` } });
    assert.equal((await call()).statusCode, 200);
    assert.equal((await call()).statusCode, 200);
    assert.equal((await call()).statusCode, 429);
  } finally {
    await app.close();
  }
});

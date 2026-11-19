import test from 'node:test';
import assert from 'node:assert/strict';
import { countToolRounds, runTurn } from '../src/agent.js';
import { loadConfig, type Config } from '../src/config.js';
import { AnthropicProvider } from '../src/providers/anthropic.js';
import { MockProvider } from '../src/providers/mock.js';
import { OpenAICompatibleProvider } from '../src/providers/openai.js';
import { buildServer } from '../src/server.js';
import { buildSystemPrompt } from '../src/prompt.js';
import { checkClientToolCall, executeServerTool, normalizePosition } from '../src/tools.js';
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

test('agent: mock handles "4/4 bc1, f1, g2, be2, c1, C" without dropping notes', async () => {
  const provider = new MockProvider();
  const messages: ChatMessage[] = [{ role: 'user', content: 'Ich brauche eine Notenzeile:\n4/4 bc1, f1, g2, be2, c1, C' }];
  const r1 = await runTurn({ provider, messages, maxIterations: 6 });
  const conv = r1.messages.find((m) => m.role === 'tool' && m.name === 'convert_german_notes') as { content: string };
  const result = JSON.parse(conv.content);
  assert.equal(result.digits, 'duration');
  assert.equal(result.meter, '4/4');
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings[0].code, 'far_from_staff');
  const staff = r1.pending_tool_calls[0];
  assert.equal(staff.arguments.abc, 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\n_C4 | F4 | G2 _E2 | C4 | C,,4 |]');
  messages.push(...r1.messages, { role: 'tool', tool_call_id: staff.id, name: staff.name, content: JSON.stringify({ ok: true, index: 3 }) });
  const r2 = await runTurn({ provider, messages, maxIterations: 6 });
  const answer = (r2.messages[0] as { content: string }).content;
  assert.match(answer, /Notenwerte/);
  assert.match(answer, /in der großen Oktave/);
});

test('tools: replace_staff validation', () => {
  const ok = checkClientToolCall({ id: '1', name: 'replace_staff', arguments: { index: '4', abc: VALID_ABC } });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.args, { index: 4, abc: VALID_ABC });
  assert.equal(checkClientToolCall({ id: '2', name: 'replace_staff', arguments: { index: -1, abc: VALID_ABC } }).ok, false);
  assert.match(checkClientToolCall({ id: '3', name: 'replace_staff', arguments: { index: 1, abc: 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\ncis' } }).error!, /nothing was changed/);
});

test('agent: mock edits an existing staff ("ändere Zeile 1: statt bc #c")', async () => {
  const provider = new MockProvider();
  const messages: ChatMessage[] = [{ role: 'user', content: 'bitte ändere Zeile 1: statt bc #c' }];
  const r1 = await runTurn({ provider, messages, maxIterations: 6 });
  assert.equal(r1.pending_tool_calls[0].name, 'get_document_outline');
  const outline = {
    ok: true,
    outline: {
      elements: [
        { index: 3, text: 'Schreibe die Tonnamen unter die Noten.' },
        { index: 4, text: '', has_image: true, staff_number: 1, abc: 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\n_C4 | F4 | G2 _E2 | C4 | C,,4 |]' },
      ],
    },
  };
  const c1 = r1.pending_tool_calls[0];
  messages.push(...r1.messages, { role: 'tool', tool_call_id: c1.id, name: c1.name, content: JSON.stringify(outline) });
  const r2 = await runTurn({ provider, messages, maxIterations: 6 });
  const replace = r2.pending_tool_calls[0];
  assert.equal(replace.name, 'replace_staff');
  assert.deepEqual(replace.arguments, { index: 4, abc: 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\n^C4 | F4 | G2 _E2 | C4 | C,,4 |]' });
  messages.push(...r2.messages, { role: 'tool', tool_call_id: replace.id, name: replace.name, content: JSON.stringify({ ok: true, replaced: true, index: 4 }) });
  const r3 = await runTurn({ provider, messages, maxIterations: 6 });
  assert.equal(r3.done, true);
  assert.match((r3.messages[0] as { content: string }).content, /Notenzeile 1 steht jetzt „#c“ statt „bc“/);
});

test('tools: add_lyrics distributes syllables, insert_staff rejects misaligned lyrics', () => {
  const tune = 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\nC D E F | G2 G2 |\nA A A A | G4 |]';
  const r = executeServerTool({ id: 'l', name: 'add_lyrics', arguments: { abc: tune, lyrics: 'Al-le mei-ne Ent-chen schwim-men auf dem See' } }) as any;
  assert.equal(r.ok, true);
  assert.equal(r.abc, 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\nC D E F | G2 G2 |\nw: Al-le mei-ne Ent-chen\nA A A A | G4 |]\nw: schwim-men auf dem See');
  const tooMany = executeServerTool({ id: 'm', name: 'add_lyrics', arguments: { abc: tune, lyrics: 'a b c d e f g h i j k l' } }) as any;
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.errors[0].code, 'too_many_syllables');
  const bad = checkClientToolCall({ id: 'n', name: 'insert_staff', arguments: { abc: tune.replace('G2 G2 |', 'G2 G2 |\nw: Al-le mei-ne'), position: 'cursor' } });
  assert.equal(bad.ok, false);
  assert.match(bad.error!, /Lyrics do not fit/);
  assert.equal(checkClientToolCall({ id: 'o', name: 'insert_staff', arguments: { abc: r.abc, position: 'cursor' } }).ok, true);
});

test('agent: mock adds lyrics to an existing staff', async () => {
  const provider = new MockProvider();
  const messages: ChatMessage[] = [{ role: 'user', content: 'Füge zu Zeile 1 den Text hinzu: Al-le mei-ne Ent-chen' }];
  const r1 = await runTurn({ provider, messages, maxIterations: 6 });
  const c1 = r1.pending_tool_calls[0];
  assert.equal(c1.name, 'get_document_outline');
  const outline = { ok: true, outline: { elements: [{ index: 2, has_image: true, staff_number: 1, abc: 'X:1\nM:none\nL:1/4\nK:C clef=treble\nC D E F G2 G2 |]' }] } };
  messages.push(...r1.messages, { role: 'tool', tool_call_id: c1.id, name: c1.name, content: JSON.stringify(outline) });
  const r2 = await runTurn({ provider, messages, maxIterations: 6 });
  const replace = r2.pending_tool_calls[0];
  assert.equal(replace.name, 'replace_staff');
  assert.equal(replace.arguments.abc, 'X:1\nM:none\nL:1/4\nK:C clef=treble\nC D E F G2 G2 |]\nw: Al-le mei-ne Ent-chen');
});

test('tools: insert_blocks / replace / delete validation', () => {
  const ok = checkClientToolCall({
    id: 'b1',
    name: 'insert_blocks',
    arguments: {
      position: 'end',
      blocks: [
        { type: 'heading', text: 'Arbeitsblatt', level: 7 },
        { type: 'paragraph', text: 'Hallo **Welt**', align: 'center' },
        { type: 'list', items: ['a', 'b'], ordered: true },
        { type: 'table', rows: [['A', 'B'], ['1']] },
        { type: 'lines', count: 3, label: 'Antwort:' },
        { type: 'box', title: 'Merke', text: 'Wichtig' },
        { type: 'staff', abc: VALID_ABC },
        { type: 'empty_staves', clef: 'bass', count: 2 },
        { type: 'page_break' },
        { type: 'spacer' },
      ],
    },
  });
  assert.equal(ok.ok, true, ok.error);
  const blocks = ok.args.blocks as any[];
  assert.equal(blocks[0].level, 3); // clamped
  assert.deepEqual(blocks[3].rows, [['A', 'B'], ['1']]);
  assert.equal(blocks[6].abc, VALID_ABC);
  assert.deepEqual(blocks[7], { type: 'empty_staves', clef: 'bass', count: 2, measures: 4 });
  assert.equal(ok.args.position, 'end');

  const badAbc = checkClientToolCall({ id: 'b2', name: 'insert_blocks', arguments: { position: 'cursor', blocks: [{ type: 'paragraph', text: 'x' }, { type: 'staff', abc: 'X:1\nK:C\nc fis' }] } });
  assert.equal(badAbc.ok, false);
  assert.match(badAbc.error!, /blocks\[1\]: invalid ABC/);
  assert.match(checkClientToolCall({ id: 'b3', name: 'insert_blocks', arguments: { position: 'end', blocks: [{ type: 'image' }] } }).error!, /unknown type/);
  assert.match(checkClientToolCall({ id: 'b4', name: 'insert_blocks', arguments: { position: 'end', blocks: [] } }).error!, /non-empty/);
  assert.equal(checkClientToolCall({ id: 'b5', name: 'insert_blocks', arguments: { position: 'somewhere', blocks: [{ type: 'spacer' }] } }).ok, false);

  assert.deepEqual(checkClientToolCall({ id: 'r1', name: 'replace_elements', arguments: { from: 2, to: 3, blocks: [{ type: 'paragraph', text: 'neu' }] } }).args, { from: 2, to: 3, blocks: [{ type: 'paragraph', text: 'neu' }] });
  assert.equal(checkClientToolCall({ id: 'r2', name: 'replace_elements', arguments: { from: 3, to: 2, blocks: [{ type: 'spacer' }] } }).ok, false);
  assert.deepEqual(checkClientToolCall({ id: 'd1', name: 'delete_elements', arguments: { from: 4, to: 4 } }).args, { from: 4, to: 4 });
  assert.deepEqual(checkClientToolCall({ id: 'g1', name: 'get_elements', arguments: { from: 1 } }).args, { from: 1, to: 1 });
});

test('tools: computer science diagrams keep deeply nested steps and are validated', () => {
  const deep = { if: 'a', then: [{ while: 'b', do: [{ if: 'c', then: [{ repeat: ['x ← x + 1'], until: 'bis x = 3' }], else: [] }] }], else: ['[[y]]'] };
  const ok = checkClientToolCall({
    id: 'u1',
    name: 'insert_blocks',
    arguments: {
      position: 'end',
      blocks: [
        { type: 'structogram', title: 'Tief', steps: ['start', deep] },
        { type: 'sequence_diagram', participants: ['a', 'b'], messages: [{ fragment: 'loop', label: 'i', messages: [{ fragment: 'alt', label: 'x', messages: [{ fragment: 'opt', label: 'y', messages: [{ from: 'a', to: 'b', text: 'm()' }] }] }] }] },
        { type: 'class_diagram', classes: [{ name: 'Tier', methods: 2 }, { name: 'Hund' }], relations: [{ from: 'Hund', to: 'Tier', kind: 'inheritance', blank: true }], show_answers: true },
        { type: 'state_diagram', notation: 'automaton', states: ['q0', 'q1'], initial: 'q0', accepting: ['q1'], transitions: [{ from: 'q0', to: 'q1', label: 'a' }] },
        { type: 'er_diagram', entities: [{ name: 'A', attributes: ['__id__'] }, { name: 'B' }], relationships: [{ name: 'r', from: 'A', to: 'B', from_card: '1', to_card: 'n' }] },
        { type: 'object_diagram', objects: [{ name: 'o', class: 'K' }], links: [] },
      ],
    },
  });
  assert.equal(ok.ok, true, ok.error);
  const b = ok.args.blocks as any[];
  assert.deepEqual(b[0].steps[1], deep);
  assert.equal(b[1].messages[0].messages[0].messages[0].messages[0].text, 'm()');
  assert.equal(b[2].relations[0].blank, true);
  // diagram texts are code: a literal backslash-n stays as it is
  let nested: unknown = 'tief';
  for (const v of ['d', 'c', 'b', 'a']) nested = { switch: v, cases: [{ label: v, do: [nested] }] };
  const code = checkClientToolCall({ id: 'u3', name: 'insert_blocks', arguments: { position: 'end', blocks: [{ type: 'structogram', steps: ['printf("%d\\n", summe)', nested] }] } });
  assert.equal(code.ok, true, code.error);
  assert.equal((code.args.blocks as any[])[0].steps[0], 'printf("%d\\n", summe)');
  assert.equal(JSON.stringify((code.args.blocks as any[])[0].steps[1]).includes('"tief"'), true, 'four nested switches survive');
  const bad = checkClientToolCall({ id: 'u2', name: 'insert_blocks', arguments: { position: 'end', blocks: [{ type: 'class_diagram', classes: [{ name: 'A' }], relations: [{ from: 'A', to: 'B' }] }] } });
  assert.equal(bad.ok, false);
  assert.match(bad.error!, /blocks\[0\] \(class_diagram\): classDiagram: "relations\[0\]\.to" is "B", which is not one of the classes: A\./);
});

test('tools: designed worksheet blocks are validated and laid out once', () => {
  const ok = checkClientToolCall({
    id: 'n1',
    name: 'insert_blocks',
    arguments: {
      position: 'end',
      theme: 'primary',
      lang: 'de',
      blocks: [
        { type: 'title', text: 'Tiere', grade: 'Klasse 2', unknown_key: 1 },
        { type: 'task', number: 1, instruction: 'Löse das Rätsel.', points: 4, icons: ['single'] },
        { type: 'crossword', entries: [{ answer: 'Hund', clue: 'bellt' }, { answer: 'Huhn', clue: 'gackert' }] },
        { type: 'cloze', text: 'Der [[Hund]] bellt.\\nNeue Zeile' },
        { type: 'formula', latex: '\\neq' },
        { type: 'paragraph', text: 'Rechne \\(a \\neq b\\).\\nDann weiter.', syllables: true },
        { type: 'lines', count: 2, style: 'school2' },
        { type: 'columns', columns: [[{ type: 'paragraph', text: 'links' }], [{ type: 'staff', abc: VALID_ABC }]] },
      ],
    },
  });
  assert.equal(ok.ok, true, ok.error);
  const b = ok.args.blocks as any[];
  assert.equal(ok.args.theme, 'primary');
  assert.equal(ok.args.lang, 'de');
  assert.equal(b[0].unknown_key, undefined);
  assert.equal(b[1].number, '1');
  assert.equal(b[3].text, 'Der [[Hund]] bellt.\nNeue Zeile');
  assert.equal(b[4].latex, '\\neq'); // LaTeX is never unescaped
  assert.equal(b[5].text, 'Rechne \\(a \\neq b\\).\nDann weiter.');
  assert.equal(b[5].syllables, true);
  assert.equal(b[6].style, 'school2');
  assert.equal(b[7].columns[1][0].abc, VALID_ABC);

  const err = (blocks: unknown[], extra: Record<string, unknown> = {}) =>
    checkClientToolCall({ id: 'n2', name: 'insert_blocks', arguments: { position: 'end', blocks, ...extra } }).error ?? '';
  assert.match(err([{ type: 'crossword', entries: [{ answer: 'ABC', clue: 'x' }, { answer: 'XYZ', clue: 'y' }] }]), /blocks\[0\] \(crossword\): .*could not be placed/);
  assert.match(err([{ type: 'chart', chart_type: 'column', labels: ['a', 'b'], series: [{ values: [1] }] }]), /blocks\[0\] \(chart\)/);
  assert.match(err([{ type: 'cloze', text: 'ohne Lücken' }]), /\[\[answer\]\]/);
  assert.match(err([{ type: 'lines', count: 2, style: 'wavy' }]), /"style" must be one of/);
  assert.match(err([{ type: 'task' }]), /task needs "instruction"/);
  assert.match(err([{ type: 'columns', columns: [[{ type: 'columns', columns: [[], []] }], []] }]), /cannot be nested/);
  assert.match(err([{ type: 'paragraph', text: 'x' }], { theme: 'pink' }), /"theme" must be one of/);
  assert.match(err([{ type: 'qr_code' }]), /qr_code needs "url"/);

  const page = checkClientToolCall({ id: 's1', name: 'setup_page', arguments: { paper: 'A5', orientation: 'landscape', header: { left: 'Schule', bogus: 1 }, page_numbers: true, theme: 'classic' } });
  assert.equal(page.ok, true, page.error);
  assert.deepEqual(page.args, { theme: 'classic', paper: 'A5', orientation: 'landscape', header: { left: 'Schule' }, page_numbers: true });
  assert.equal(checkClientToolCall({ id: 's2', name: 'setup_page', arguments: { paper: 'A3' } }).ok, false);
  assert.equal(checkClientToolCall({ id: 's3', name: 'setup_page', arguments: {} }).ok, false);
  assert.deepEqual(checkClientToolCall({ id: 'c1', name: 'check_worksheet', arguments: { grade: 3 } }).args, { grade: 3 });
  assert.equal(checkClientToolCall({ id: 'c2', name: 'check_worksheet', arguments: { grade: 20 } }).ok, false);
});

test('agent: mock creates a worksheet with insert_blocks', async () => {
  const provider = new MockProvider();
  const messages: ChatMessage[] = [{ role: 'user', content: 'Erstelle ein Arbeitsblatt zum Wasserkreislauf für Klasse 5' }];
  const r1 = await runTurn({ provider, messages, maxIterations: 6 });
  const call = r1.pending_tool_calls[0];
  assert.equal(call.name, 'insert_blocks');
  const blocks = call.arguments.blocks as any[];
  assert.equal(blocks[0].text, 'Arbeitsblatt: Wasserkreislauf');
  assert.ok(blocks.some((b) => b.type === 'table') && blocks.some((b) => b.type === 'lines'));
  messages.push(...r1.messages, { role: 'tool', tool_call_id: call.id, name: call.name, content: JSON.stringify({ ok: true, inserted: true, count: 12, first_index: 0, last_index: 11 }) });
  const r2 = await runTurn({ provider, messages, maxIterations: 6 });
  assert.match((r2.messages[0] as { content: string }).content, /12 Elementen/);
});

test('prompt: outline shows staff numbers and selection', () => {
  const p = buildSystemPrompt({ elements: [{ index: 4, has_image: true, staff_number: 2, selected: true, abc: 'X:1' }], cursor_index: 4 });
  assert.match(p, /\[4\] \(empty\) \[STAFF 2, SELECTED, abc: "X:1"\] <-- CURSOR/);
  const t = buildSystemPrompt({ elements: [{ index: 2, type: 'table', rows: 3, cols: 2, text: 'A B' }, { index: 3, list_item: true, text: 'eins' }] });
  assert.match(t, /\[2\] \(table 3×2\) "A B"/);
  assert.match(t, /\[3\] LIST "eins"/);
  assert.match(buildSystemPrompt({ elements: [{ index: 0, text: '' }], cursor_index: 0 }), /document is EMPTY/);
});

test('tools: convert_german_notes returns tune, meter and digits interpretation', () => {
  const r = executeServerTool({ id: 'x', name: 'convert_german_notes', arguments: { notes: '4/4 c1 d1 e1 f1', digits: 'auto' } }) as any;
  assert.equal(r.digits, 'octave');
  assert.equal(r.tune, 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\nC D E F |]');
  const d = executeServerTool({ id: 'y', name: 'convert_german_notes', arguments: { notes: '4/4 c1 d1 e1 f1', digits: 'duration' } }) as any;
  assert.equal(d.tune, 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\nC4 | D4 | E4 | F4 |]');
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

test('providers: reasoning_effort is sent and dropped automatically if unsupported', async () => {
  const bodies: any[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    if (body.reasoning_effort) {
      return new Response(JSON.stringify({ message: 'reasoning_effort medium is not supported for this model' }), { status: 400 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const p = new OpenAICompatibleProvider({ name: 'mistral', baseUrl: 'http://x', model: 'm', temperature: 0, maxTokens: 10, timeoutMs: 1000, reasoningEffort: 'medium' });
    const req = { system: 's', messages: [{ role: 'user' as const, content: 'hi' }], tools: [], toolChoice: 'auto' as const };
    assert.equal((await p.complete(req)).content, 'ok');
    assert.equal((await p.complete(req)).content, 'ok');
    assert.deepEqual(bodies.map((b) => b.reasoning_effort ?? null), ['medium', null, null]); // retried once, then never sent again
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(cfg({ LLM_PROVIDER: 'mistral', MISTRAL_API_KEY: 'k' }).reasoningEffort, 'medium');
  assert.equal(cfg({ LLM_PROVIDER: 'mistral', MISTRAL_API_KEY: 'k', LLM_REASONING_EFFORT: 'off' }).reasoningEffort, '');
  assert.equal(cfg({ LLM_PROVIDER: 'openai', LLM_BASE_URL: 'http://ollama:11434/v1' }).reasoningEffort, '');
});

test('agent: truncated empty answers are reported as such', async () => {
  const provider = new ScriptedProvider([{ content: '', tool_calls: [], truncated: true }]);
  const r = await runTurn({ provider, messages: [{ role: 'user', content: 'x' }], maxIterations: 6 });
  assert.match((r.messages[0] as { content: string }).content, /Antwortlimit erreicht/);
  assert.equal(cfg().maxTokens, 8192);
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

test('tools: literal \\n in worksheet texts becomes a line break', async () => {
  const { unescapeText, checkBlocks } = await import('../src/tools.js');
  assert.equal(unescapeText('Zeile 1\\nZeile 2'), 'Zeile 1\nZeile 2');
  assert.equal(unescapeText('a\\tb'), 'a\tb');
  assert.equal(unescapeText('kein Backslash'), 'kein Backslash');
  const r = checkBlocks([{ type: 'box', title: 'Merke', text: 'a\\nb' }, { type: 'table', rows: [['x\\ny']] }]);
  assert.equal((r.blocks![0] as { text: string }).text, 'a\nb');
  assert.deepEqual((r.blocks![1] as { rows: string[][] }).rows, [['x\ny']]);
});

test('providers: temporary provider errors are retried, the message is readable', async () => {
  const { postJson } = await import('../src/providers/http.js');
  const { ProviderError } = await import('../src/types.js');
  const realFetch = globalThis.fetch;
  let calls = 0;
  const busy = () => new Response(JSON.stringify({ object: 'error', message: 'Service unavailable.', code: '3800' }), { status: 503 });
  globalThis.fetch = (async () => (++calls < 3 ? busy() : new Response('{"ok":1}', { status: 200 }))) as typeof fetch;
  try {
    assert.deepEqual(await postJson('http://x', {}, {}, 1000, [1, 1]), { ok: 1 });
    assert.equal(calls, 3);
    calls = -10;
    await assert.rejects(postJson('http://x', {}, {}, 1000, [1, 1]), (err: unknown) => {
      assert.ok(err instanceof ProviderError);
      assert.match((err as Error).message, /busy or not available right now \(HTTP 503: Service unavailable\.\)/);
      return true;
    });
    // other errors are not retried
    calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response('{"message":"bad key"}', { status: 401 });
    }) as typeof fetch;
    await assert.rejects(postJson('http://x', {}, {}, 1000, [1, 1]), /LLM API error 401: bad key/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

/**
 * Deterministic mock provider (LLM_PROVIDER=mock).
 *
 * No API key, no network. It understands a tiny subset of requests such as
 * "Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein
 * und darunter eine leere Zeile" and drives the same tool loop as a real
 * model. Used for the local test harness, demos and automated tests.
 */
import { abcTools } from '../abc.js';
import type { ChatMessage, CompletionRequest, CompletionResult, LLMProvider, ToolMessage } from '../types.js';

const NOTE = "[a-hA-H](?:isis|is|eses|es|s)?(?:'+|,+|[0-9¹²³])?";
const NOTE_SEQUENCE = new RegExp(`(?:^|\\s)(${NOTE}(?:\\s*(?:[–—,-]|\\s|und)\\s*${NOTE}){1,})(?=[\\s.,!?]|$)`);

let counter = 0;
function nextId(): string {
  counter = (counter + 1) % 1e6;
  return ('mock' + counter.toString(36).padStart(5, '0')).slice(0, 9);
}

function parseResult(m: ToolMessage): any {
  try {
    return JSON.parse(m.content);
  } catch {
    return {};
  }
}

export class MockProvider implements LLMProvider {
  readonly name = 'mock';
  readonly model = 'mock';

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const msgs = req.messages;
    let lastUser = -1;
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'user') { lastUser = i; break; }
    const userText = lastUser >= 0 ? (msgs[lastUser] as { content: string }).content : '';
    const since: ChatMessage[] = msgs.slice(lastUser + 1);
    const results = since.filter((m): m is ToolMessage => m.role === 'tool');
    const done = (name: string) => results.filter((r) => r.name === name);

    if (req.toolChoice === 'none') {
      return { content: 'Mock-Modus: Maximale Anzahl an Schritten erreicht.', tool_calls: [] };
    }

    const clef = /bass/i.test(userText) ? 'bass' : 'treble';
    const wantsEmpty = /leer/i.test(userText);
    const task = /Aufgabe\s*(\d+)/i.exec(userText);
    const position: unknown = task ? { after_heading: `Aufgabe ${task[1]}` } : 'cursor';
    // Strip words that look like note names but are not ("Aufgabe", "eine", …) by only
    // searching after "mit" if present.
    const searchText = /\bmit\b/i.test(userText) ? userText.slice(userText.search(/\bmit\b/i) + 3) : userText;
    const seq = NOTE_SEQUENCE.exec(searchText);

    // 1) note names -> convert_german_notes
    if (seq && done('convert_german_notes').length === 0) {
      return {
        content: '',
        tool_calls: [{ id: nextId(), name: 'convert_german_notes', arguments: { notes: seq[1].trim(), clef } }],
      };
    }

    // 2) converted notes -> insert_staff
    const converted = done('convert_german_notes')[0];
    if (converted && done('insert_staff').length === 0) {
      const r = parseResult(converted);
      const notes = typeof r.abc_notes === 'string' && r.abc_notes ? r.abc_notes : 'C';
      const abc = abcTools.buildAbc({ notes: notes + ' |]', clef, meter: 'none' });
      return {
        content: '',
        tool_calls: [{ id: nextId(), name: 'insert_staff', arguments: { abc, width_cm: 16, position } }],
      };
    }

    // 3) empty staves (after the inserted staff, if there is one)
    if (wantsEmpty && done('insert_empty_staves').length === 0) {
      const staff = done('insert_staff')[0];
      const staffResult = staff ? parseResult(staff) : null;
      const pos = staffResult && Number.isInteger(staffResult.index) ? { after_paragraph_index: staffResult.index } : position;
      return {
        content: '',
        tool_calls: [{ id: nextId(), name: 'insert_empty_staves', arguments: { clef, count: 1, measures: 4, width_cm: 16, position: pos } }],
      };
    }

    // 4) final answer
    if (results.length === 0) {
      return {
        content:
          'Mock-Modus: Ich verstehe nur einfache Anfragen wie „Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein und darunter eine leere Zeile“.',
        tool_calls: [],
      };
    }
    const failed = results.map(parseResult).filter((r) => r && r.ok === false);
    if (failed.length) {
      return { content: `Mock-Modus: Es gab ein Problem: ${failed.map((f) => f.error ?? f.reason ?? 'unbekannt').join('; ')}`, tool_calls: [] };
    }
    const parts: string[] = [];
    if (done('insert_staff').length) parts.push('die Notenzeile');
    if (done('insert_empty_staves').length) parts.push('eine leere Notenzeile');
    return { content: `Fertig (Mock-Modus): Ich habe ${parts.join(' und ') || 'nichts'} eingefügt.`, tool_calls: [] };
  }
}

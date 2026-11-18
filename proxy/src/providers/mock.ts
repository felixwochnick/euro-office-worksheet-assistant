/**
 * Deterministic mock provider (LLM_PROVIDER=mock).
 *
 * No API key, no network. It understands a small subset of requests such as
 * "Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein
 * und darunter eine leere Zeile" or "Ich brauche eine Notenzeile: 4/4 bc1, f1,
 * g2, be2, c1, C" and drives the same tool loop as a real model. Used for the
 * local test harness, demos and automated tests – it is NOT an AI.
 */
import { abcTools } from '../abc.js';
import type { ChatMessage, CompletionRequest, CompletionResult, LLMProvider, ToolMessage } from '../types.js';

let counter = 0;
function nextId(): string {
  counter = (counter + 1) % 1e6;
  return ('mock' + counter.toString(36).padStart(5, '0')).slice(0, 9);
}

function parseResult(m: ToolMessage | undefined): any {
  if (!m) return {};
  try {
    return JSON.parse(m.content);
  } catch {
    return {};
  }
}

const METER = /^\d{1,2}\/\d{1,2}[,:.]?$/;

/** Is this whitespace-separated word part of a note list? */
function isNoteWord(word: string): boolean {
  const w = word.replace(/[.!?]$/, '');
  if (!w) return false;
  if (METER.test(w) || w === '|' || w === '||' || w === '|]') return true;
  if (/^[–—-]$/.test(w)) return true;
  return abcTools.germanToAbc(w).ok;
}

/**
 * The longest run of consecutive note words in the message, e.g.
 * "4/4 bc1, f1, g2, be2, c1, C" or "c – f – g". Single letters inside normal
 * sentences ("a") are ignored by requiring at least two notes.
 */
export function extractNoteList(text: string): string | null {
  const words = text.replace(/:(?=\s)/g, ' ').split(/\s+/).filter(Boolean);
  let best: string[] = [];
  let run: string[] = [];
  for (const w of words) {
    if (isNoteWord(w)) {
      run.push(w);
      if (run.length > best.length) best = [...run];
    } else {
      run = [];
    }
  }
  const notes = best.filter((w) => !METER.test(w) && !/^[–—-]$/.test(w) && !/^\|/.test(w));
  return notes.length >= 2 ? best.join(' ').replace(/[.!?]$/, '') : null;
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
    const digits = /notenwert|ganze|halbe|viertel/i.test(userText) ? 'duration' : /oktav|gestrichen/i.test(userText) ? 'octave' : 'auto';
    const list = extractNoteList(userText);

    // 1) note names -> convert_german_notes (server-side)
    if (list && done('convert_german_notes').length === 0) {
      return {
        content: '',
        tool_calls: [{ id: nextId(), name: 'convert_german_notes', arguments: { notes: list, clef, digits } }],
      };
    }

    // 2) converted notes -> insert_staff (only if everything could be converted)
    const converted = parseResult(done('convert_german_notes')[0]);
    if (list && converted.errors?.length) {
      const bad = converted.errors.map((e: { token: string }) => `„${e.token}“`).join(', ');
      return {
        content: `Mock-Modus: Diese Angaben kann ich nicht als Tonnamen lesen: ${bad}. Ich habe deshalb nichts eingefügt – bitte korrigieren (z. B. ces statt bc, oder b vor dem Ton: bc).`,
        tool_calls: [],
      };
    }
    if (converted.tune && done('insert_staff').length === 0) {
      return {
        content: '',
        tool_calls: [{ id: nextId(), name: 'insert_staff', arguments: { abc: converted.tune, position } }],
      };
    }

    // 3) empty staves (after the inserted staff, if there is one)
    if (wantsEmpty && done('insert_empty_staves').length === 0) {
      const staffResult = parseResult(done('insert_staff')[0]);
      const pos = Number.isInteger(staffResult.index) ? { after_paragraph_index: staffResult.index } : position;
      return {
        content: '',
        tool_calls: [{ id: nextId(), name: 'insert_empty_staves', arguments: { clef, count: 1, measures: 4, position: pos } }],
      };
    }

    // 4) final answer
    if (results.length === 0) {
      return {
        content:
          'Mock-Modus (keine echte KI): Ich verstehe nur einfache Anfragen wie „Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein und darunter eine leere Zeile“ oder „Notenzeile: 4/4 c1 f1 g2 e2 c1“.',
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
    let answer = `Fertig (Mock-Modus): Ich habe ${parts.join(' und ') || 'nichts'} eingefügt.`;
    if (converted.digits === 'duration') {
      answer += ' Die Ziffern habe ich als Notenwerte gelesen (1 = Ganze, 2 = Halbe, 4 = Viertel).';
    } else if (list && /\d/.test(list.replace(METER_IN_TEXT, ''))) {
      answer += " Die Ziffern habe ich als Oktavangaben gelesen (c1 = c').";
    }
    if (converted.meter) answer += ` Takt: ${converted.meter}${converted.bars ? `, ${converted.bars} Takte` : ''}.`;
    for (const w of converted.warnings ?? []) {
      if (w.code === 'far_from_staff') {
        answer += ` Hinweis: „${w.token}“ liegt in der ${w.octave} – weit unter/über dem Notensystem. Meintest du vielleicht c oder c'?`;
      } else if (w.code === 'incomplete_bar') {
        answer += ` Hinweis: Die Noten füllen keine vollen ${w.meter}-Takte.`;
      }
    }
    return { content: answer, tool_calls: [] };
  }
}

const METER_IN_TEXT = /\d{1,2}\/\d{1,2}/g;

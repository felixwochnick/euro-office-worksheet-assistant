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

const ACC_TO_ABC: Record<number, string> = { [-2]: '__', [-1]: '_', 0: '=', 1: '^', 2: '^^' };

/** "Ändere Zeile 2: statt bc #c" -> { staff: 2, from: 'bc', to: '#c' } ("markierte Zeile" -> staff: 'selected'). */
export function parseEditRequest(text: string): { staff: number | 'selected'; from: string; to: string } | null {
  if (!/(änder|korrigier|ersetz|tausch)/i.test(text)) return null;
  const staffMatch = /(?:noten)?zeile\s*(\d+)/i.exec(text) ?? /(\d+)\.\s*(?:noten)?zeile/i.exec(text);
  const staff: number | 'selected' | null = staffMatch ? Number(staffMatch[1]) : /markiert/i.test(text) ? 'selected' : null;
  const after = /statt\s+(.+)$/is.exec(text);
  if (staff === null || !after) return null;
  const words = after[1].split(/[\s,]+/).map((w) => w.replace(/[.!?:]$/, '')).filter((w) => isNoteWord(w) && !METER.test(w));
  return words.length >= 2 ? { staff, from: words[0], to: words[1] } : null;
}

/** Replace every note with the pitch class of `from` (letter + accidental) by `to` in the music lines of `abc`. */
export function replaceNote(abc: string, from: string, to: string): { abc: string; count: number } {
  const f = abcTools.parseGermanNote(from);
  const t = abcTools.parseGermanNote(to);
  if (!f.ok || !t.ok || f.rest || t.rest || !f.letter || !t.letter) return { abc, count: 0 };
  const lines = abc.split('\n');
  const k = lines.findIndex((l) => /^K:/.test(l));
  let count = 0;
  for (let i = k + 1; i > 0 && i < lines.length; i++) {
    if (/^[A-Za-z]:/.test(lines[i]) || /^%/.test(lines[i])) continue;
    lines[i] = lines[i].replace(/(\^\^|\^|__|_|=)?([A-Ga-g])(?![a-z])/g, (m, acc: string | undefined, letter: string) => {
      const accidental = acc === '^' ? 1 : acc === '^^' ? 2 : acc === '_' ? -1 : acc === '__' ? -2 : 0;
      if (letter.toUpperCase() !== f.letter || accidental !== f.accidental) return m;
      count++;
      const newLetter = letter === letter.toUpperCase() ? t.letter! : t.letter!.toLowerCase();
      const newAcc = t.accidental ? ACC_TO_ABC[t.accidental!] : acc ? '=' : '';
      return newAcc + newLetter;
    });
  }
  return { abc: lines.join('\n'), count };
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

    // W1) "Erstelle ein Arbeitsblatt zu <Thema>" -> one insert_blocks call at the end
    const worksheet = /(erstell|mach|create)/i.test(userText) && /(arbeitsblatt|worksheet)/i.test(userText);
    if (worksheet) {
      if (done('insert_blocks').length === 0) {
        const topic = (/(?:zum|zur|zu|über|about|on)\s+(?:dem\s+|der\s+|das\s+|the\s+)?([^.,!?]+?)(?:\s+für\s+|\s+for\s+|[.,!?]|$)/i.exec(userText)?.[1] ?? 'Thema').trim();
        const blocks = [
          { type: 'heading', level: 1, text: `Arbeitsblatt: ${topic}` },
          { type: 'paragraph', text: 'Name: ____________  Klasse: ______  Datum: __________' },
          { type: 'heading', level: 2, text: 'Aufgabe 1' },
          { type: 'paragraph', text: `Lies den Text über **${topic}** und beantworte die Fragen.` },
          { type: 'list', ordered: true, items: ['Was ist das Wichtigste?', 'Nenne ein Beispiel.'] },
          { type: 'lines', count: 3 },
          { type: 'heading', level: 2, text: 'Aufgabe 2' },
          { type: 'paragraph', text: 'Ergänze die Tabelle.' },
          { type: 'table', rows: [['Begriff', 'Erklärung'], ['', ''], ['', '']] },
          { type: 'box', title: 'Merke', text: `${topic} ist wichtig.` },
        ];
        return { content: '', tool_calls: [{ id: nextId(), name: 'insert_blocks', arguments: { position: 'end', blocks } }] };
      }
      const res = parseResult(done('insert_blocks')[0]);
      if (!res.ok) return { content: `Mock-Modus: Einfügen fehlgeschlagen: ${res.error ?? 'unbekannt'}`, tool_calls: [] };
      if (res.inserted === false) return { content: 'Mock-Modus: Arbeitsblatt verworfen.', tool_calls: [] };
      return { content: `Fertig (Mock-Modus): Arbeitsblatt mit ${res.count} Elementen eingefügt.`, tool_calls: [] };
    }

    // W2) "Lösche Element 3" / "Lösche Element 3 bis 5" -> delete_elements
    const del = /l[öo]sch\w*\s+(?:das\s+)?element\s+(\d+)(?:\s*(?:bis|-|–)\s*(\d+))?/i.exec(userText);
    if (del) {
      if (done('delete_elements').length === 0) {
        return { content: '', tool_calls: [{ id: nextId(), name: 'delete_elements', arguments: { from: Number(del[1]), to: Number(del[2] ?? del[1]) } }] };
      }
      const res = parseResult(done('delete_elements')[0]);
      if (!res.ok) return { content: `Mock-Modus: Löschen fehlgeschlagen: ${res.error ?? 'unbekannt'}`, tool_calls: [] };
      return { content: res.deleted === false ? 'Mock-Modus: Nichts gelöscht.' : `Fertig (Mock-Modus): ${res.removed_count} Element(e) gelöscht.`, tool_calls: [] };
    }

    // W3) "Ersetze Element 3 durch: neuer Text" -> replace_elements with one paragraph
    const repl = /ersetz\w*\s+(?:das\s+)?element\s+(\d+)\s+durch:?\s*([\s\S]+)$/i.exec(userText);
    if (repl) {
      if (done('replace_elements').length === 0) {
        const idx = Number(repl[1]);
        return { content: '', tool_calls: [{ id: nextId(), name: 'replace_elements', arguments: { from: idx, to: idx, blocks: [{ type: 'paragraph', text: repl[2].trim() }] } }] };
      }
      const res = parseResult(done('replace_elements')[0]);
      if (!res.ok) return { content: `Mock-Modus: Ersetzen fehlgeschlagen: ${res.error ?? 'unbekannt'}`, tool_calls: [] };
      return { content: `Fertig (Mock-Modus): Element ${res.first_index} ersetzt.`, tool_calls: [] };
    }

    // 0a) "Füge zu Zeile N den Text hinzu: Al-le mei-ne …" -> outline, add_lyrics, replace_staff
    const lyricsReq = /text/i.test(userText) ? /(?:noten)?zeile\s*(\d+)[^:]*:\s*([\s\S]+)$/i.exec(userText) : null;
    if (lyricsReq) {
      const staffNo = Number(lyricsReq[1]);
      const lyrics = lyricsReq[2].trim().replace(/^[„"]|[“"]$/g, '');
      if (done('get_document_outline').length === 0) {
        return { content: '', tool_calls: [{ id: nextId(), name: 'get_document_outline', arguments: {} }] };
      }
      const outline = parseResult(done('get_document_outline')[0]).outline ?? {};
      const el = (outline.elements ?? []).find((e: any) => e.staff_number === staffNo);
      if (!el) return { content: `Mock-Modus: Ich finde Notenzeile ${staffNo} nicht im Dokument.`, tool_calls: [] };
      if (done('add_lyrics').length === 0) {
        return { content: '', tool_calls: [{ id: nextId(), name: 'add_lyrics', arguments: { abc: el.abc, lyrics } }] };
      }
      const added = parseResult(done('add_lyrics')[0]);
      if (!added.ok) {
        return { content: `Mock-Modus: Der Text passt nicht: ${(added.errors ?? []).map((e: any) => e.error).join(' ')}`, tool_calls: [] };
      }
      if (done('replace_staff').length === 0) {
        return { content: '', tool_calls: [{ id: nextId(), name: 'replace_staff', arguments: { index: el.index, abc: added.abc } }] };
      }
      const res = parseResult(done('replace_staff')[0]);
      if (!res.ok) return { content: `Mock-Modus: Ändern fehlgeschlagen: ${res.error ?? 'unbekannt'}`, tool_calls: [] };
      return {
        content: `Fertig (Mock-Modus): Notenzeile ${staffNo} hat jetzt Text (${added.syllables} Silben für ${added.notes} Noten).`,
        tool_calls: [],
      };
    }

    // 0b) "Ändere Zeile N: statt X Y" -> read outline, then replace_staff
    const edit = parseEditRequest(userText);
    if (edit) {
      if (done('get_document_outline').length === 0) {
        return { content: '', tool_calls: [{ id: nextId(), name: 'get_document_outline', arguments: {} }] };
      }
      const label = edit.staff === 'selected' ? 'der markierten Notenzeile' : `Notenzeile ${edit.staff}`;
      if (done('replace_staff').length === 0) {
        const outline = parseResult(done('get_document_outline')[0]).outline ?? {};
        const el = (outline.elements ?? []).find((e: any) => (edit.staff === 'selected' ? e.selected && e.abc : e.staff_number === edit.staff));
        if (!el) return { content: `Mock-Modus: Ich finde ${label} nicht im Dokument.`, tool_calls: [] };
        const r = replaceNote(el.abc, edit.from, edit.to);
        if (!r.count) return { content: `Mock-Modus: „${edit.from}“ kommt in ${label} nicht vor.`, tool_calls: [] };
        return { content: '', tool_calls: [{ id: nextId(), name: 'replace_staff', arguments: { index: el.index, abc: r.abc } }] };
      }
      const res = parseResult(done('replace_staff')[0]);
      if (!res.ok) return { content: `Mock-Modus: Ändern fehlgeschlagen: ${res.error ?? 'unbekannt'}`, tool_calls: [] };
      if (res.replaced === false) return { content: 'Mock-Modus: Änderung verworfen.', tool_calls: [] };
      return { content: `Fertig (Mock-Modus): In ${label} steht jetzt „${edit.to}“ statt „${edit.from}“.`, tool_calls: [] };
    }

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

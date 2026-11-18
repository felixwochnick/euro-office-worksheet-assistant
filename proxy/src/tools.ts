/**
 * Tool definitions (JSON Schema) and server-side tool handling.
 *
 * Client tools are executed by the plugin inside the editor:
 *   insert_staff, insert_empty_staves, replace_staff, get_document_outline
 * Server tools are executed directly by the proxy (no round trip):
 *   convert_german_notes, add_lyrics
 *
 * Arguments of client tools are validated here first. Invalid ABC never
 * reaches the plugin – the model gets the validation errors as tool result
 * and can correct itself.
 */
import { abcTools } from './abc.js';
import type { ToolCall, ToolDefinition } from './types.js';

const positionSchema = {
  description:
    'Where to insert. "cursor" = as a new paragraph after the paragraph containing the cursor (an empty paragraph at the cursor is used directly); {"after_heading": "<text>"} = directly after the paragraph/heading whose text matches; {"after_paragraph_index": n} = after the top-level element with index n from the document outline. Prefer after_paragraph_index when the outline is known.',
  anyOf: [
    { type: 'string', enum: ['cursor'] },
    {
      type: 'object',
      properties: { after_heading: { type: 'string', minLength: 1 } },
      required: ['after_heading'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { after_paragraph_index: { type: 'integer', minimum: 0 } },
      required: ['after_paragraph_index'],
      additionalProperties: false,
    },
  ],
};

const blockPositionSchema = {
  ...positionSchema,
  description:
    positionSchema.description + ' Additionally "start" (top of the document) and "end" (end of the document, e.g. for a new worksheet).',
  anyOf: [{ type: 'string', enum: ['cursor', 'start', 'end'] }, ...positionSchema.anyOf.slice(1)],
};

const textSchema = (desc: string) => ({ type: 'string', maxLength: 4000, description: desc });

/** JSON Schema of one worksheet block (see plugin/js/blocks.js). */
const blockSchema = {
  type: 'object',
  description:
    'One building block. Text fields support **bold**, *italic*, __underline__ and "\\n" for a line break; gaps in cloze texts are written as "________".',
  properties: {
    type: {
      type: 'string',
      enum: ['heading', 'paragraph', 'list', 'table', 'lines', 'box', 'staff', 'empty_staves', 'page_break', 'spacer'],
      description:
        'heading {text, level 1-3}; paragraph {text, align?}; list {items[], ordered?}; table {rows[][], header? (first row bold, default true)}; ' +
        'lines {count 1-20, label?} = writing lines; box {text, title?} = framed info box ("Merke", tip, rule); ' +
        'staff {abc, width_cm?} = music staff from ABC; empty_staves {clef, count, measures?}; page_break; spacer {lines?}',
    },
    text: textSchema('heading / paragraph / box text'),
    level: { type: 'integer', minimum: 1, maximum: 3 },
    align: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
    items: { type: 'array', items: { type: 'string', maxLength: 2000 }, maxItems: 50 },
    ordered: { type: 'boolean' },
    rows: { type: 'array', items: { type: 'array', items: { type: 'string', maxLength: 1000 }, maxItems: 10 }, maxItems: 60 },
    header: { type: 'boolean' },
    count: { type: 'integer', minimum: 1, maximum: 20 },
    label: { type: 'string', maxLength: 500 },
    title: { type: 'string', maxLength: 200 },
    abc: { type: 'string' },
    width_cm: { type: 'number', minimum: 3, maximum: 19 },
    clef: { type: 'string', enum: ['treble', 'bass'] },
    measures: { type: 'integer', minimum: 0, maximum: 8 },
    lines: { type: 'integer', minimum: 1, maximum: 10 },
  },
  required: ['type'],
};

const widthSchema = {
  type: 'number',
  minimum: 3,
  maximum: 19,
  description: 'Image width in centimetres (A4 text width is about 16 cm). Omit to use the user\'s default width.',
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'insert_staff',
    description:
      'Render music given in ABC notation and insert it into the document as a printable image. The ABC source is stored as the image alt text. Always pass one complete tune with header lines X:, M:, L:, K: (with clef=treble or clef=bass).',
    parameters: {
      type: 'object',
      properties: {
        abc: {
          type: 'string',
          description: 'Complete ABC tune, e.g. "X:1\\nM:4/4\\nL:1/4\\nK:C clef=treble\\nC F G2 |]"',
        },
        width_cm: widthSchema,
        position: positionSchema,
      },
      required: ['abc', 'position'],
      additionalProperties: false,
    },
  },
  {
    name: 'insert_empty_staves',
    description:
      'Insert empty staves (only clef and staff lines, optionally bar lines) for students to write notes into.',
    parameters: {
      type: 'object',
      properties: {
        clef: { type: 'string', enum: ['treble', 'bass'] },
        count: { type: 'integer', minimum: 1, maximum: 12, description: 'Number of staves (systems).' },
        measures: {
          type: 'integer',
          minimum: 0,
          maximum: 8,
          description: 'Bars per staff (0 = no bar lines). Default 4.',
        },
        width_cm: widthSchema,
        position: positionSchema,
      },
      required: ['clef', 'count', 'position'],
      additionalProperties: false,
    },
  },
  {
    name: 'replace_staff',
    description:
      'Change an EXISTING staff: replaces the staff image in the given element with new ABC (keeps its width unless ' +
      'width_cm is given). Use this – not insert_staff – when the user wants to modify a staff that is already in the ' +
      'document ("ändere Zeile 2: statt bc #c"). Take the current ABC from the outline ("abc" of the element), change ' +
      'only what the user asked for and send the complete new tune.',
    parameters: {
      type: 'object',
      properties: {
        index: {
          type: 'integer',
          minimum: 0,
          description: 'Top-level element index of the staff (from the outline; staves are listed with staff_number = "Notenzeile N").',
        },
        abc: { type: 'string', description: 'Complete new ABC tune (X:, M:, L:, K: with clef=…).' },
        width_cm: widthSchema,
      },
      required: ['index', 'abc'],
      additionalProperties: false,
    },
  },
  {
    name: 'insert_blocks',
    description:
      'Insert worksheet content: headings, paragraphs (instructions, texts, cloze texts), lists, tables, writing lines, info boxes, ' +
      'music staves, empty staves, page breaks. Use it to create a whole worksheet in one call (in reading order) or to add parts. ' +
      'Returns the index range of the new elements.',
    parameters: {
      type: 'object',
      properties: {
        position: blockPositionSchema,
        blocks: { type: 'array', items: blockSchema, minItems: 1, maxItems: 80 },
      },
      required: ['position', 'blocks'],
      additionalProperties: false,
    },
  },
  {
    name: 'replace_elements',
    description:
      'Replace the top-level elements from..to (indices from the outline, inclusive) with new blocks – to rewrite a task, ' +
      'fix a text, change a table. Read the current content with get_elements first. Keep everything the user did not ask to change.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'integer', minimum: 0 },
        to: { type: 'integer', minimum: 0 },
        blocks: { type: 'array', items: blockSchema, minItems: 1, maxItems: 80 },
      },
      required: ['from', 'to', 'blocks'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_elements',
    description: 'Delete the top-level elements from..to (inclusive). The user is asked to confirm. Only delete what the user asked for.',
    parameters: {
      type: 'object',
      properties: { from: { type: 'integer', minimum: 0 }, to: { type: 'integer', minimum: 0 } },
      required: ['from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_elements',
    description:
      'Return the full content of the top-level elements from..to (inclusive): complete paragraph texts, list flags, table cells, staff ABC. ' +
      'Use it before replace_elements and whenever the outline (texts are shortened) is not enough.',
    parameters: {
      type: 'object',
      properties: { from: { type: 'integer', minimum: 0 }, to: { type: 'integer', minimum: 0 } },
      required: ['from'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_document_outline',
    description:
      'Return the current document structure: top-level elements with index, text, style, whether they are headings, and the ABC source of inserted staves. Call it again after inserting, because indices shift.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'add_lyrics',
    description:
      'Put song text (lyrics) under the notes of a tune: distributes the syllables over the music lines as ABC "w:" ' +
      'lines (one syllable per note). Write the text with German syllable breaks marked by "-" ("Al-le mei-ne ' +
      'Ent-chen"); "_" holds the previous syllable for one more note (melisma), "*" leaves a note without text, "~" puts ' +
      'two words on one note. Returns the new tune in "abc" – then call insert_staff or replace_staff with it.',
    parameters: {
      type: 'object',
      properties: {
        abc: { type: 'string', description: 'The complete tune (e.g. the "abc" of a staff from the outline).' },
        lyrics: { type: 'string', description: 'The text with syllables separated by "-".' },
        mode: {
          type: 'string',
          enum: ['replace', 'verse'],
          description: '"replace" (default) replaces existing lyrics, "verse" adds another verse below.',
        },
      },
      required: ['abc', 'lyrics'],
      additionalProperties: false,
    },
  },
  {
    name: 'convert_german_notes',
    description:
      'Convert German note names into ABC. Understands c d e f g a h, b = B flat, -is/-es suffixes (fis, es, as), ' +
      'accidentals written in front ("bc"/"♭c" = ces, "#f" = fis), octave marks (c\' c\'\' C C,), bar lines | and a time ' +
      'signature token such as "4/4" (bar lines are then added automatically). Digits after a note are ambiguous: ' +
      'octave marks in German school notation (c1 = c\') or note values (c1 = whole, g2 = half, c4 = quarter). ' +
      'Use this whenever the user gives note names. Insert the returned "tune" (or build your own from "abc_notes"), ' +
      'and tell the user how digits were read ("digits") and about any "warnings" or "errors" – never drop notes silently.',
    parameters: {
      type: 'object',
      properties: {
        notes: { type: 'string', description: 'The user\'s note list verbatim, incl. a time signature, e.g. "4/4 bc1, f1, g2, be2, c1, C" or "c – f – g".' },
        clef: {
          type: 'string',
          enum: ['treble', 'bass'],
          description: 'Clef; decides the octave of note names without octave marks (treble: c = c\', bass: c = small c).',
        },
        digits: {
          type: 'string',
          enum: ['auto', 'octave', 'duration'],
          description:
            'Meaning of digits after note names: "octave" (c1 = c\', c2 = c\'\'), "duration" (1 = whole, 2 = half, 4 = quarter, 8 = eighth, "." = dotted; ' +
            'a note without value repeats the previous value) or "auto" (default: note values if the digits include 4/8/16, or a ' +
            'time signature is given and two or more different values fill whole bars; otherwise octave marks). If the user ' +
            'says what the digits mean, pass it explicitly.',
        },
      },
      required: ['notes'],
      additionalProperties: false,
    },
  },
];

export const CLIENT_TOOLS = new Set([
  'insert_blocks',
  'replace_elements',
  'delete_elements',
  'get_elements',
  'insert_staff',
  'insert_empty_staves',
  'replace_staff',
  'get_document_outline',
]);

const BLOCK_TYPES = new Set(['heading', 'paragraph', 'list', 'table', 'lines', 'box', 'staff', 'empty_staves', 'page_break', 'spacer']);

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  return v.length > max ? v.slice(0, max) : v;
}

/**
 * Validate and normalise worksheet blocks. Returns the cleaned blocks or a
 * message the model can act on (block number + problem).
 */
export function checkBlocks(raw: unknown): { blocks?: Record<string, unknown>[]; error?: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: '"blocks" must be a non-empty array.' };
  if (raw.length > 80) return { error: 'At most 80 blocks per call – split the content into several calls.' };
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i] as Record<string, unknown>;
    const at = `blocks[${i}]`;
    if (!b || typeof b !== 'object' || !BLOCK_TYPES.has(String(b.type))) {
      return { error: `${at}: unknown type "${b && (b as { type?: unknown }).type}". Allowed: ${[...BLOCK_TYPES].join(', ')}.` };
    }
    const type = String(b.type);
    switch (type) {
      case 'heading': {
        const text = str(b.text, 500);
        if (!text?.trim()) return { error: `${at}: heading needs "text".` };
        out.push({ type, text, level: Math.min(3, Math.max(1, Number(b.level) || 2)) });
        break;
      }
      case 'paragraph': {
        const text = str(b.text, 4000);
        if (text == null) return { error: `${at}: paragraph needs "text".` };
        const align = ['left', 'center', 'right', 'justify'].includes(String(b.align)) ? b.align : undefined;
        out.push(align ? { type, text, align } : { type, text });
        break;
      }
      case 'list': {
        if (!Array.isArray(b.items) || !b.items.length) return { error: `${at}: list needs "items" (array of strings).` };
        out.push({ type, items: b.items.slice(0, 50).map((x) => String(x).slice(0, 2000)), ordered: b.ordered === true });
        break;
      }
      case 'table': {
        if (!Array.isArray(b.rows) || !b.rows.length || !b.rows.every((r) => Array.isArray(r))) {
          return { error: `${at}: table needs "rows" (array of arrays of strings).` };
        }
        const rows = (b.rows as unknown[][]).slice(0, 60).map((r) => r.slice(0, 10).map((c) => (c == null ? '' : String(c).slice(0, 1000))));
        out.push({ type, rows, header: b.header !== false });
        break;
      }
      case 'lines': {
        const count = Math.round(Number(b.count ?? 3));
        if (!(count >= 1 && count <= 20)) return { error: `${at}: lines "count" must be 1–20.` };
        const label = str(b.label, 500);
        out.push(label ? { type, count, label } : { type, count });
        break;
      }
      case 'box': {
        const text = str(b.text, 4000);
        if (!text?.trim()) return { error: `${at}: box needs "text".` };
        const title = str(b.title, 200);
        out.push(title ? { type, text, title } : { type, text });
        break;
      }
      case 'staff': {
        const v = abcTools.validateAbc(b.abc, { requireClef: true });
        if (!v.valid) return { error: `${at}: invalid ABC – ${abcTools.formatValidationErrors(v)}` };
        const lyr = lyricsProblem(v);
        if (lyr) return { error: `${at}: lyrics do not fit the notes – ${lyr}` };
        const width = normalizeWidth(b.width_cm);
        if (width === null) return { error: `${at}: "width_cm" must be a number.` };
        out.push(withWidth({ type, abc: v.normalized }, width));
        break;
      }
      case 'empty_staves': {
        const clef = b.clef === 'bass' ? 'bass' : 'treble';
        const count = Math.round(Number(b.count ?? 1));
        if (!(count >= 1 && count <= 12)) return { error: `${at}: empty_staves "count" must be 1–12.` };
        const measures = b.measures == null ? 4 : Math.round(Number(b.measures));
        if (!(measures >= 0 && measures <= 8)) return { error: `${at}: "measures" must be 0–8.` };
        const width = normalizeWidth(b.width_cm);
        out.push(withWidth({ type, clef, count, measures }, width ?? undefined));
        break;
      }
      case 'page_break':
        out.push({ type });
        break;
      case 'spacer':
        out.push({ type, lines: Math.min(10, Math.max(1, Math.round(Number(b.lines) || 1))) });
        break;
    }
  }
  return { blocks: out };
}

function checkRange(a: Record<string, unknown>, needTo: boolean): { from: number; to: number } | string {
  const from = Number(a.from);
  const to = a.to == null ? (needTo ? NaN : from) : Number(a.to);
  if (!Number.isInteger(from) || from < 0) return '"from" must be an element index (integer >= 0) from the outline.';
  if (!Number.isInteger(to) || to < from) return '"to" must be an integer >= "from".';
  if (to - from > 200) return 'At most 200 elements per call.';
  return { from, to };
}
export const SERVER_TOOLS = new Set(['convert_german_notes', 'add_lyrics']);

/** Lyrics that do not fit the notes are rejected for the AI (the manual mode only warns). */
function lyricsProblem(v: { warnings: Array<{ code: string; line?: number; syllables?: number; notes?: number }> }): string | null {
  const bad = v.warnings.filter((w) => w.code === 'lyrics_mismatch');
  if (!bad.length) return null;
  return (
    bad.map((w) => `w: line ${w.line} has ${w.syllables} syllables for ${w.notes} notes`).join('; ') +
    '. Every note of the music line above needs exactly one slot: separate syllables with "-", hold a syllable with "_", ' +
    'skip a note with "*". Easiest: call add_lyrics with the plain hyphenated text.'
  );
}

export interface ToolCheck {
  ok: boolean;
  /** Arguments after normalisation (e.g. normalised ABC). */
  args: Record<string, unknown>;
  error?: string;
}

/** Accepts the documented position forms plus a few lenient variants models produce. */
export function normalizePosition(pos: unknown, allowStartEnd = false): ToolCheck['args']['position'] | null {
  if (pos == null || pos === '' || pos === 'cursor') return 'cursor';
  if (allowStartEnd && (pos === 'start' || pos === 'end')) return pos;
  if (typeof pos === 'string') {
    const idx = /^after_paragraph_index\s*[:=]\s*(\d+)$/.exec(pos.trim());
    if (idx) return { after_paragraph_index: Number(idx[1]) };
    const head = /^after_heading\s*[:=]\s*(.+)$/.exec(pos.trim());
    if (head) return { after_heading: head[1].replace(/^["']|["']$/g, '') };
    return null;
  }
  if (typeof pos === 'object') {
    const o = pos as Record<string, unknown>;
    if (o.type === 'cursor') return 'cursor';
    const index = o.after_paragraph_index ?? (o.type === 'after_paragraph_index' ? o.index ?? o.value : undefined);
    if (index !== undefined) {
      const n = Number(index);
      return Number.isInteger(n) && n >= 0 ? { after_paragraph_index: n } : null;
    }
    const heading = o.after_heading ?? (o.type === 'after_heading' ? o.heading ?? o.text ?? o.value : undefined);
    if (typeof heading === 'string' && heading.trim()) return { after_heading: heading.trim() };
  }
  return null;
}

/** undefined = not given (the plugin then uses the user's default width), null = invalid. */
function normalizeWidth(w: unknown): number | null | undefined {
  if (w == null || w === '') return undefined;
  const n = Number(w);
  if (!Number.isFinite(n)) return null;
  return Math.min(19, Math.max(3, n));
}

function withWidth(args: Record<string, unknown>, width: number | undefined): Record<string, unknown> {
  return width === undefined ? args : { ...args, width_cm: width };
}

/** Validate (and normalise) the arguments of a client tool call. */
export function checkClientToolCall(call: ToolCall): ToolCheck {
  const a = call.arguments ?? {};
  if ('__raw' in a) {
    return { ok: false, args: a, error: 'Arguments were not valid JSON. Send a JSON object.' };
  }
  switch (call.name) {
    case 'get_document_outline':
      return { ok: true, args: {} };

    case 'insert_blocks': {
      const position = normalizePosition(a.position, true);
      if (!position) return { ok: false, args: a, error: 'Invalid "position". Use "cursor", "start", "end", {"after_heading": "..."} or {"after_paragraph_index": n}.' };
      const r = checkBlocks(a.blocks);
      if (r.error) return { ok: false, args: a, error: `Nothing was inserted. ${r.error}` };
      return { ok: true, args: { position, blocks: r.blocks } };
    }

    case 'replace_elements': {
      const range = checkRange(a, true);
      if (typeof range === 'string') return { ok: false, args: a, error: range };
      const r = checkBlocks(a.blocks);
      if (r.error) return { ok: false, args: a, error: `Nothing was changed. ${r.error}` };
      return { ok: true, args: { ...range, blocks: r.blocks } };
    }

    case 'delete_elements': {
      const range = checkRange(a, true);
      if (typeof range === 'string') return { ok: false, args: a, error: range };
      return { ok: true, args: range };
    }

    case 'get_elements': {
      const range = checkRange(a, false);
      if (typeof range === 'string') return { ok: false, args: a, error: range };
      if (range.to - range.from > 59) range.to = range.from + 59;
      return { ok: true, args: range };
    }

    case 'insert_staff': {
      const position = normalizePosition(a.position);
      if (!position) return { ok: false, args: a, error: 'Invalid "position". Use "cursor", {"after_heading": "..."} or {"after_paragraph_index": n}.' };
      const width = normalizeWidth(a.width_cm);
      if (width === null) return { ok: false, args: a, error: '"width_cm" must be a number.' };
      const v = abcTools.validateAbc(a.abc, { requireClef: true });
      if (!v.valid) {
        return {
          ok: false,
          args: a,
          error: `Invalid ABC notation – nothing was inserted. Fix these problems and call insert_staff again: ${abcTools.formatValidationErrors(v)}`,
        };
      }
      const lyr = lyricsProblem(v);
      if (lyr) return { ok: false, args: a, error: `Lyrics do not fit the notes – nothing was inserted. ${lyr}` };
      return { ok: true, args: withWidth({ abc: v.normalized, position }, width) };
    }

    case 'replace_staff': {
      const index = Number(a.index);
      if (!Number.isInteger(index) || index < 0) return { ok: false, args: a, error: '"index" must be the element index (integer >= 0) of the staff from the outline.' };
      const width = normalizeWidth(a.width_cm);
      if (width === null) return { ok: false, args: a, error: '"width_cm" must be a number.' };
      const v = abcTools.validateAbc(a.abc, { requireClef: true });
      if (!v.valid) {
        return {
          ok: false,
          args: a,
          error: `Invalid ABC notation – nothing was changed. Fix these problems and call replace_staff again: ${abcTools.formatValidationErrors(v)}`,
        };
      }
      const lyr = lyricsProblem(v);
      if (lyr) return { ok: false, args: a, error: `Lyrics do not fit the notes – nothing was changed. ${lyr}` };
      return { ok: true, args: withWidth({ index, abc: v.normalized }, width) };
    }

    case 'insert_empty_staves': {
      const position = normalizePosition(a.position);
      if (!position) return { ok: false, args: a, error: 'Invalid "position". Use "cursor", {"after_heading": "..."} or {"after_paragraph_index": n}.' };
      const width = normalizeWidth(a.width_cm);
      if (width === null) return { ok: false, args: a, error: '"width_cm" must be a number.' };
      const clef = a.clef === 'bass' ? 'bass' : a.clef === 'treble' || a.clef == null ? 'treble' : null;
      if (!clef) return { ok: false, args: a, error: '"clef" must be "treble" or "bass".' };
      const count = Math.round(Number(a.count ?? 1));
      if (!Number.isFinite(count) || count < 1 || count > 12) return { ok: false, args: a, error: '"count" must be an integer between 1 and 12.' };
      const measures = a.measures == null ? 4 : Math.round(Number(a.measures));
      if (!Number.isFinite(measures) || measures < 0 || measures > 8) return { ok: false, args: a, error: '"measures" must be between 0 and 8.' };
      return { ok: true, args: withWidth({ clef, count, measures, position }, width) };
    }

    default:
      return { ok: false, args: a, error: `Unknown tool "${call.name}".` };
  }
}

/** Execute a server-side tool and return its JSON-serialisable result. */
export function executeServerTool(call: ToolCall): unknown {
  const a = call.arguments ?? {};
  if (call.name === 'convert_german_notes') {
    if (typeof a.notes !== 'string' || !a.notes.trim()) {
      return { ok: false, error: '"notes" must be a non-empty string.' };
    }
    const clef = a.clef === 'bass' ? 'bass' : 'treble';
    const digits = a.digits === 'octave' || a.digits === 'duration' ? a.digits : 'auto';
    const r = abcTools.germanToAbc(a.notes.slice(0, 2000), { clef, digits });
    return {
      ok: r.ok,
      clef,
      meter: r.meter,
      digits: r.digits,
      digits_explanation:
        r.digits === 'duration'
          ? 'Digits were read as note values (1 = whole, 2 = half, 4 = quarter, 8 = eighth).'
          : 'Digits (if any) were read as Helmholtz octave marks (c1 = c\', c2 = c\'\').',
      bars: r.bars,
      abc_notes: r.abc,
      tune: r.tune,
      notes: r.notes.map((n) => ({ german: n.input, abc: n.abc })),
      errors: r.errors,
      warnings: r.warnings,
      hint: r.errors.length
        ? 'Some tokens could not be converted. Do not insert a staff without them – ask the user or correct them.'
        : 'Insert "tune" with insert_staff (adjust title/meter if needed).',
    };
  }
  if (call.name === 'add_lyrics') {
    if (typeof a.abc !== 'string' || typeof a.lyrics !== 'string' || !a.lyrics.trim()) {
      return { ok: false, error: '"abc" and "lyrics" must be non-empty strings.' };
    }
    const v = abcTools.validateAbc(a.abc);
    if (!v.valid) return { ok: false, error: 'The tune is not valid ABC: ' + abcTools.formatValidationErrors(v) };
    const r = abcTools.addLyrics(v.normalized, a.lyrics.slice(0, 5000), { mode: a.mode === 'verse' ? 'verse' : 'replace' });
    return {
      ok: r.ok,
      abc: r.ok ? r.abc : undefined,
      syllables: r.syllables,
      notes: r.notes,
      lines: r.lines,
      errors: r.errors,
      warnings: r.warnings,
      hint: r.ok
        ? 'Insert "abc" with insert_staff (new staff) or replace_staff (existing staff). Mention warnings to the user.'
        : 'Fix the lyrics (syllable breaks with "-", "_" to hold a syllable) and call add_lyrics again, or ask the user.',
    };
  }
  return { ok: false, error: `Unknown server tool "${call.name}".` };
}

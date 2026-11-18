/**
 * Tool definitions (JSON Schema) and server-side tool handling.
 *
 * Client tools are executed by the plugin inside the editor:
 *   insert_staff, insert_empty_staves, get_document_outline
 * Server tools are executed directly by the proxy (no round trip):
 *   convert_german_notes
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
    name: 'get_document_outline',
    description:
      'Return the current document structure: top-level elements with index, text, style, whether they are headings, and the ABC source of inserted staves. Call it again after inserting, because indices shift.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
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

export const CLIENT_TOOLS = new Set(['insert_staff', 'insert_empty_staves', 'get_document_outline']);
export const SERVER_TOOLS = new Set(['convert_german_notes']);

export interface ToolCheck {
  ok: boolean;
  /** Arguments after normalisation (e.g. normalised ABC). */
  args: Record<string, unknown>;
  error?: string;
}

/** Accepts the documented position forms plus a few lenient variants models produce. */
export function normalizePosition(pos: unknown): ToolCheck['args']['position'] | null {
  if (pos == null || pos === '' || pos === 'cursor') return 'cursor';
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
      return { ok: true, args: withWidth({ abc: v.normalized, position }, width) };
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
  return { ok: false, error: `Unknown server tool "${call.name}".` };
}

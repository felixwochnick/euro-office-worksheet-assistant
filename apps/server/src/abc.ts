/**
 * Typed access to the shared ABC helpers (`packages/shared/abc-tools.js`, package
 * `@worksheet-assistant/shared`), which are also bundled into the browser plugin.
 */
import abcToolsModule from '@worksheet-assistant/shared/abc-tools.js';

export interface AbcIssue {
  code: string;
  message: string;
  line?: number;
  syllables?: number;
  notes?: number;
}

export interface AbcValidation {
  valid: boolean;
  errors: AbcIssue[];
  warnings: AbcIssue[];
  headers: Record<string, string>;
  clef: 'treble' | 'bass';
  normalized: string;
}

export interface ConversionIssue {
  code: string;
  error: string;
  token?: string;
  [key: string]: unknown;
}

export interface GermanConversion {
  ok: boolean;
  abc: string;
  /** Complete tune (X:, M:, L:, K: with clef) or '' if no notes. */
  tune: string;
  notes: Array<{ input: string; abc: string; letter: string; accidental: number; octave: number | null; duration: number | null }>;
  errors: ConversionIssue[];
  warnings: ConversionIssue[];
  meter: string | null;
  digits: 'octave' | 'duration';
  bars: number | null;
}

export interface AbcTools {
  MAX_ABC_LENGTH: number;
  validateAbc(abc: unknown, opts?: { requireClef?: boolean }): AbcValidation;
  normalizeAbc(abc: string): string;
  formatValidationErrors(result: AbcValidation): string;
  parseGermanNote(
    token: string,
    opts?: { bareOctave?: number; digits?: 'octave' | 'duration' },
  ): { ok: boolean; letter?: string; accidental?: number; octave?: number | null; rest?: boolean; error?: string };
  germanToAbc(
    text: string,
    opts?: { clef?: string; bareOctave?: number; explicitNatural?: boolean; digits?: 'auto' | 'octave' | 'duration' },
  ): GermanConversion;
  addLyrics(
    abc: string,
    text: string,
    opts?: { mode?: 'replace' | 'verse' },
  ): {
    ok: boolean;
    abc: string;
    syllables: number;
    notes: number;
    lines: Array<{ notes: number; syllables: number }>;
    errors: ConversionIssue[];
    warnings: ConversionIssue[];
  };
  buildAbc(o: { notes: string; clef?: string; meter?: string; length?: string; key?: string; title?: string }): string;
  emptyStavesAbc(o: { clef?: string; count?: number; measures?: number }): string;
}

export const abcTools = abcToolsModule as AbcTools;

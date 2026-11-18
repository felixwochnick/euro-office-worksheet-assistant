/**
 * Typed access to the shared ABC helpers (`shared/abc-tools.js`), which are
 * also bundled into the browser plugin. The relative layout
 * `<root>/shared` + `<root>/proxy/build/src` is identical in the repository
 * and in the Docker image.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface AbcIssue {
  code: string;
  message: string;
  line?: number;
}

export interface AbcValidation {
  valid: boolean;
  errors: AbcIssue[];
  warnings: AbcIssue[];
  headers: Record<string, string>;
  clef: 'treble' | 'bass';
  normalized: string;
}

export interface GermanConversion {
  ok: boolean;
  abc: string;
  notes: Array<{ input: string; abc: string; letter: string; accidental: number; octave: number | null }>;
  errors: Array<{ token: string; error: string }>;
}

export interface AbcTools {
  MAX_ABC_LENGTH: number;
  validateAbc(abc: unknown, opts?: { requireClef?: boolean }): AbcValidation;
  normalizeAbc(abc: string): string;
  formatValidationErrors(result: AbcValidation): string;
  germanToAbc(text: string, opts?: { clef?: string; bareOctave?: number; explicitNatural?: boolean }): GermanConversion;
  buildAbc(o: { notes: string; clef?: string; meter?: string; length?: string; key?: string; title?: string }): string;
  emptyStavesAbc(o: { clef?: string; count?: number; measures?: number }): string;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sharedPath = process.env.ABC_TOOLS_PATH ?? path.resolve(here, '../../../shared/abc-tools.js');

const require = createRequire(import.meta.url);
export const abcTools: AbcTools = require(sharedPath) as AbcTools;

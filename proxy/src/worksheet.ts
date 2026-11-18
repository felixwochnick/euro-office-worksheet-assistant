/**
 * Typed access to the shared worksheet modules (`shared/worksheet-*.js`), which are also
 * bundled into the browser plugin: themes, layout (blocks -> document elements) and the
 * generators/graphics it uses. The proxy runs the layout to validate blocks before they
 * reach the editor, so the model gets precise errors (e.g. crossword words that do not fit).
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface WorksheetThemes {
  THEME_IDS: string[];
  BOX_VARIANTS: string[];
  TASK_ICONS: string[];
  LANGUAGES: string[];
  isThemeId(id: string): boolean;
}

export interface WorksheetLayout {
  BLOCK_TYPES: string[];
  LINE_STYLES: string[];
  compose(blocks: unknown[], ctx: { theme?: string; lang?: string; textWidthMm?: number }): {
    elements: unknown[];
    warnings: string[];
  };
}

export interface WorksheetSvg {
  ICON_NAMES: string[];
}

interface Modules {
  themes: WorksheetThemes;
  layout: WorksheetLayout;
  svg: WorksheetSvg;
}

function load(): Modules {
  // Single-file builds (companion app) put the modules here before this file is evaluated (see scripts/companion-preload.mjs).
  const preloaded = (globalThis as { __WORKSHEET_MODULES__?: Modules }).__WORKSHEET_MODULES__;
  if (preloaded) return preloaded;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dir = process.env.WORKSHEET_SHARED_DIR ?? path.resolve(here, '../../../shared');
  const req = createRequire(import.meta.url);
  return {
    themes: req(path.join(dir, 'worksheet-themes.js')) as WorksheetThemes,
    layout: req(path.join(dir, 'worksheet-layout.js')) as WorksheetLayout,
    svg: req(path.join(dir, 'worksheet-svg.js')) as WorksheetSvg,
  };
}

export const worksheet: Modules = load();

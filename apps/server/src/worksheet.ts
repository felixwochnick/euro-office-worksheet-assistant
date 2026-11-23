/**
 * Typed access to the shared worksheet modules (`packages/shared/worksheet-*.js`, package
 * `@worksheet-assistant/shared`), which are also bundled into the browser plugin: themes, layout
 * (blocks -> document elements) and the generators/graphics it uses. The server runs the layout to
 * validate blocks before they reach the editor, so the model gets precise errors (e.g. crossword
 * words that do not fit).
 */
import themes from '@worksheet-assistant/shared/worksheet-themes.js';
import layout from '@worksheet-assistant/shared/worksheet-layout.js';
import svg from '@worksheet-assistant/shared/worksheet-svg.js';
import scene3d from '@worksheet-assistant/shared/worksheet-3d.js';

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

/** 3D scenes of geometric bodies (block scene_3d). */
export interface Worksheet3d {
  SHAPES: string[];
  STYLES: string[];
  PROJECTIONS: string[];
  VIEWS: string[];
  ELEVATIONS: string[];
  COLORS: Record<string, string>;
  MAX_BODIES: number;
}

interface Modules {
  themes: WorksheetThemes;
  layout: WorksheetLayout;
  svg: WorksheetSvg;
  scene3d: Worksheet3d;
}

export const worksheet: Modules = {
  themes: themes as WorksheetThemes,
  layout: layout as WorksheetLayout,
  svg: svg as WorksheetSvg,
  scene3d: scene3d as Worksheet3d,
};

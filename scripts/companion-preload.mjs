/* Makes the shared modules available to proxy/src/abc.ts and proxy/src/worksheet.ts in the companion's single-file bundle. */
import abcTools from '../shared/abc-tools.js';
import themes from '../shared/worksheet-themes.js';
import layout from '../shared/worksheet-layout.js';
import svg from '../shared/worksheet-svg.js';

globalThis.__WORKSHEET_ABC_TOOLS__ = abcTools;
globalThis.__WORKSHEET_MODULES__ = { themes, layout, svg };

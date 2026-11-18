/* Makes shared/abc-tools.js available to proxy/src/abc.ts in the companion's single-file bundle. */
import abcTools from '../shared/abc-tools.js';

globalThis.__WORKSHEET_ABC_TOOLS__ = abcTools;

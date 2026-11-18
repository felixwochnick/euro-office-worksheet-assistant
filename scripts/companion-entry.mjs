/*
 * Entry of the companion's single-file bundle (scripts/build-companion.mjs).
 * The ABC helpers are bundled here and handed to proxy/src/abc.ts before it is evaluated
 * (imports are evaluated in order).
 */
import './companion-preload.mjs';
import { main } from '../proxy/src/companion/main.ts';

main().then(
  (code) => {
    if (code >= 0) process.exit(code);
  },
  (err) => {
    process.stderr.write(`${(err && err.stack) || err}\n`);
    process.exit(1);
  },
);

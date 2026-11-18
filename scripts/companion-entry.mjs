/*
 * Entry of the companion's single-file bundle (scripts/build-companion.mjs): the server program of the
 * desktop app (apps/server/src/companion), with the shared modules (packages/shared) bundled in.
 */
import { main } from '../apps/server/src/companion/main.ts';

main().then(
  (code) => {
    if (code >= 0) process.exit(code);
  },
  (err) => {
    process.stderr.write(`${(err && err.stack) || err}\n`);
    process.exit(1);
  },
);

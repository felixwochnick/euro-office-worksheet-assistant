/** Entry point of the companion when run from the repository: node build/src/companion/cli.js [command]. */
import { main } from './main.js';

main().then(
  (code) => {
    if (code >= 0) process.exit(code);
  },
  (err) => {
    process.stderr.write(`${(err as Error).stack || err}\n`);
    process.exit(1);
  },
);

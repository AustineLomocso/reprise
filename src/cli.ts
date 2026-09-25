// Reprise command-line entry point: reprise <command> [flags]. Bundled into dist/reprise.mjs.

import { main } from './commands.js';

process.exitCode = await main(process.argv.slice(2));

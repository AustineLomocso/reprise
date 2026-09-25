// Builds the Reprise engine.
//   node esbuild.config.mjs        -> dist/reprise.mjs (the bundled CLI, committed)
//   node esbuild.config.mjs --dev  -> .build/ (each test file and src/lib.ts bundled
//                                     separately, npm dependencies left external), so
//                                     `node --test` and the sample generator run the
//                                     real compiled code without TypeScript stripping.
import { build } from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';
import { join, sep } from 'node:path';

const dev = process.argv.includes('--dev');

const common = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  logLevel: 'warning',
};

if (dev) {
  const tests = readdirSync('test', { recursive: true })
    .map((f) => join('test', String(f)).split(sep).join('/'))
    .filter((f) => f.endsWith('.test.ts'));
  rmSync('.build', { recursive: true, force: true });
  await build({
    ...common,
    entryPoints: [...tests, 'src/lib.ts'],
    outbase: '.',
    outdir: '.build',
    packages: 'external',
    sourcemap: 'inline',
  });
} else {
  await build({
    ...common,
    entryPoints: ['src/cli.ts'],
    outfile: 'dist/reprise.mjs',
    // CommonJS dependencies (ajv) may call require() at run time.
    banner: {
      js: "#!/usr/bin/env node\nimport { createRequire as __repriseCreateRequire } from 'node:module';\nconst require = __repriseCreateRequire(import.meta.url);",
    },
    legalComments: 'eof',
  });
}

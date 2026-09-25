// Library entry for scripts (scripts/generate-sample-records.mjs) and tests: the real engine
// code, compiled by `node esbuild.config.mjs --dev` into .build/src/lib.js.

export * from './stats/index.js';
export { validate, SCHEMA_NAMES, type SchemaName } from './schemas.js';

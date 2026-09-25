// Library entry for scripts (scripts/generate-sample-records.mjs) and tests: the real engine
// code, compiled by `node esbuild.config.mjs --dev` into .build/src/lib.js.

export * from './stats/index.js';
export { validate, SCHEMA_NAMES, type SchemaName } from './schemas.js';
export { scoreFingerprints, isCandidate, normalise, jaccard, DEDUPE_THRESHOLD, DEDUPE_WEIGHTS } from './triage/dedupe-score.js';
export { buildIndex, buildSite, loadRecords, median } from './site/build-site.js';
export { DEFAULTS as CONFIG_DEFAULTS } from './config/defaults.js';

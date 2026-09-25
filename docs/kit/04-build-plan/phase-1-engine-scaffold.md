# Phase 1 — Engine scaffold

**Goal:** A buildable, testable TypeScript CLI skeleton in the `reprise` repository with config loading, schemas, and the stats module finished.
**Repository:** `reprise` (public). Copy this kit into `docs/kit/` first.
**Mode:** Plan, then Agent.
**Attach:** `@docs/kit/01-architecture/architecture.md`, `@docs/kit/01-architecture/decisions.md`, `@docs/kit/02-specs/data-contracts.md`, `@docs/kit/02-specs/statistics.md`.

## Prompt

```
Set up the Reprise engine repository exactly as described in the attached architecture (repository layout for `reprise`), decisions ADR-2 and ADR-3, data contracts and statistics spec.

Deliver:
1. package.json (type module, engines node >=24), tsconfig.json (strict), esbuild.config.mjs bundling src/cli.ts to dist/reprise.mjs for node24.
2. Dependencies limited to: yaml, ajv (+ ajv-formats), fast-xml-parser, @octokit/rest, minimatch. Dev: typescript, esbuild, and the Node built-in test runner (no other test framework).
3. src/cli.ts with subcommands triage, fix, verify, build-site, run --local, publish, and global flags --dry-run, --bob-replay, --bob-record. Each subcommand is a stub that logs "not implemented" except those finished below.
4. src/config: load .reprise.yml, validate against schemas/reprise-config.schema.json, apply the defaults listed in architecture.md. Return typed config.
5. schemas/: JSON Schemas (draft 2020-12) for reprise-config, intake, dedupe-confirm, repro, rootcause, fix, issue-record, site-index, exactly matching data-contracts.md, with the enumerations listed there.
6. src/stats: wilson(k, n), zeroFailureBound(n, alpha), requiredRuns(rateLow, alpha, min, max) returning {required, raw, capped}. Unit tests that reproduce every worked example in statistics.md to 4 decimal places.
7. src/stats/verdict.ts: verdictFromTrials(outcomes) implementing statistics.md sections 1 and 2, including the invalid-trial rule, with unit tests for each branch.
8. npm scripts: build, test, typecheck, lint (tsc --noEmit is enough for lint).
9. A GitHub Actions CI workflow for this repo that runs typecheck, test and build on push and pull_request, on ubuntu-latest with Node 24.

Do not invent fields or enum values that are not in data-contracts.md. If something needed is missing, stop and list it.
```

## Acceptance

- `npm run typecheck && npm test && npm run build` pass locally and in CI.
- Stats tests match every value in `statistics.md`.
- Schemas validate the example issue record in `data-contracts.md` (add it as a fixture and test it).

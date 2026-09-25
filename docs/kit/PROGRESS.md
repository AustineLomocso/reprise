# Progress

Build log for Reprise, implemented by Claude Code from this kit. Newest entries at the bottom. Each phase gets a plan before work starts and a report after.

## Start (25 Sep 2026)

### Kit read

All files in `00-context/`, `01-architecture/`, `02-specs/`, `03-runtime-prompts/`, `04-build-plan/`, `05-quality/`, `06-deployment/`, and `07-submission/submission-content.md`.

### Local environment found

| Tool | State |
| --- | --- |
| git | 2.54.0 (Windows) |
| node / npm | v24.15.0 / 11.12.1 |
| docker | 29.6.2 installed; Docker Desktop daemon stopped; only WSL distro is `docker-desktop` |
| gh | not installed |
| bob | not installed (F-7 documents the Linux install only) |
| jq, shellcheck | not installed |

### New gates added (rule 1)

- G-19: `bob run` with a fresh empty `HOME` and minimal environment.
- G-20: `--format json` output and exit code when a turn or cost cap is hit.

### Spec conflicts and gaps found so far

1. `github-integration.md` gives `reprise-verify.yml` `contents: read`, but `fix-and-verify.md` Part B and Part C write the issue record to `reprise-data`, which needs `contents: write`. The verify workflow also calls `reprise-pages.yml`, so its caller job needs `pages: write` and `id-token: write`. Proposed resolution in phase 5: `contents: write` on the verify job (same-repo PRs only; PR code runs only in the no-network sandbox with no token).
2. Strict TypeScript needs `@types/node`, which is not in the phase 1 dependency list or the cost ledger (free, MIT). Needs approval before phase 1.
3. Phase 6 prompt uses `reprise build-site --data DIR --out DIR`; `architecture.md` shows only `--out DIR`, and `action.yml` has inputs `site-data` and `site-out`. Not a contradiction; the CLI will take both flags.
4. The trial sequence is stored with `P`/`F`/`X` (`statistics.md`, `data-contracts.md`) and rendered with `F`/`.`/`x` (`github-integration.md`). Treated as storage vs display, not a conflict.
5. `reprise:fix-proposed` has no rule saying when it is applied. Proposed: add it when the fix draft PR opens, remove it when a verification label is set.

### Phase plan

| Phase | Builds | Governing specs | Where it runs | Real Bob calls |
| --- | --- | --- | --- | --- |
| 0 | Smoke workflow in `reprise-smoke` for G-2, G-3, G-6, G-8, G-9, G-10, G-14, G-19, G-20 (G-7 as one extra call); web checks for G-15, G-17, G-18; your G-1 and G-13 results | verification-gates, verified-facts, bob-integration | GitHub Actions | about 8, tiny prompts |
| 1 | Engine scaffold: package, tsconfig, esbuild, CLI stubs, config loader, all schemas, stats and verdict with the worked examples, CI workflow | architecture, decisions, data-contracts, statistics | local + engine CI | 0 |
| 2 | Demo repo with the six-commit history and tag, seeded bugs, tests, Dockerfile, `.reprise.yml`, issue form, scripts, race measurement tuned to 15–40% | demo-target-repo, architecture, github-integration (labels) | local, then push | 0 |
| 3a | Sandbox, Bob runner (record, replay, resume, schema repair), security redaction | bob-integration, security, statistics §1, triage-pipeline §5 | local | 0 |
| 3b | Triage stages, dedupe scoring, scope guard, trials, bisect, root cause, render, local `reprise triage` | triage-pipeline, security, github-integration (templates) | local, replay | 0 |
| 3c | Record fixtures for BULK, RACE, VAGUE, DUP; calibrate dedupe; measure costs (G-4); replay test in CI | triage-pipeline §3, bob-integration caps | see open question on where | about 10–17 |
| 4 | `action.yml`, github module, store on `reprise-data`, render and redaction on every post, triage workflow, placeholder pages workflow | github-integration, triage-pipeline §0/§1/§9, data-contracts, security | live demo repo | about 15–25 (live acceptance incl. re-triage cap) |
| 5 | Fix loop, verification, regression classification, resolution, fix and verify workflows | fix-and-verify, statistics §5–6, github-integration | local replay, then live | about 5–15 |
| 6 | Dashboard, `build-site`, preview server, UI review | dashboard, data-contracts, security T8, ui-review | local | 0 |
| 7 | Release workflow, `RELEASING.md`, full pages workflow, `@v1` pins, workflow audit, first deploy | deployment, cost-ledger, github-integration | live | 0 |
| 8 | Security cases S1–S7, failure cases, redaction audit, live end-to-end from a reset repo | test-strategy, definition-of-done, security | replay, then live | about 15–25 |
| 9 | Submission text matched to dashboard numbers; Bob IDE sentence rewritten to the accurate build story | 07-submission, hackathon-submission, G-13 | docs | 0 |

Bob call counts are estimates for your allocation planning. I will give an exact count before each batch.

Workspace layout: this folder (`C:\Users\austi\Reprise`) becomes the `reprise` engine repository with the kit already at `docs/kit/`; the demo repository is cloned next to it at `C:\Users\austi\reprise-demo-shop`.

The phase plan above predates the provider amendment and is superseded by the one below.

## Start checkpoint: answers (25 Sep 2026)

| Question | Answer |
| --- | --- |
| OWNER | `AustineLomocso` (`gh` logged in; scopes `repo`, `workflow`, `gist`, `read:org`) |
| Repositories | Claude Code creates `reprise`, `reprise-demo-shop`, `reprise-smoke` with `gh repo create --public` |
| Claude docs gate | G-21 (G-19 and G-20 already existed as Bob gates; deferred with G-1 to G-7 and G-14) |
| Extra spec edits and site-index fields | Approved |
| `claude.max_tokens` | Per-request output limit (not cumulative) |
| Default model | `claude-sonnet-5`, pending G-21 |
| `@types/node`, `@anthropic-ai/sdk` | Approved |
| Verify job `contents: write`; `reprise:fix-proposed` rule | Approved (conflicts 1 and 5 above resolved) |
| Docker Desktop | Started by the owner |
| Commits | No co-author trailer |

## ADR-12 amendment (recorded before any code)

Files changed: `README.md`; `00-context/verification-gates.md` (deferred marks, G-21), `00-context/glossary.md`; `01-architecture/decisions.md` (ADR-12), `architecture.md` (`src/provider/`, `reprise provider` command, `.reprise.yml` `provider` and `claude.*`), diagrams `system-context.mmd`, `deployment.mmd`, `containers.mmd` (all three re-rendered with mermaid-cli, parse OK); `02-specs/bob-integration.md` (§ Claude provider, token table), `data-contracts.md` (`Provider` enum, record `provider`, `bob_tasks` token fields, site-index `provider`, `median_tokens_per_triage`, `tokens_total`), `security.md` (threats, `ANTHROPIC_API_KEY` secret, redaction list), `github-integration.md` (`anthropic-api-key` input, conditional Bob install, verify permissions, `cost_line`, `fix-proposed` rule), `fix-and-verify.md`, `triage-pipeline.md`, `dashboard.md` (cost unit); `04-build-plan/phase-0-verify-gates.md`; `05-quality/test-strategy.md` (both providers, Claude failure cases); `06-deployment/cost-ledger.md` (Claude API row, npm row), `deployment.md`, `runbook.md`.

Reconciliation noted: `bob-integration.md` "Parsing the result" step 5 already recorded `tool_calls`, which the `data-contracts.md` example lacked; the record example now includes it.

Choices made within the approved scope (tell me if any is wrong):
- `max_tool_turns` counts Messages API requests per stage call; a revision call and the schema-repair call each get their own budget (mirrors Bob's `--resume` calls having their own `--max-turns`).
- Claude tools also refuse paths into `.git/`.
- Redaction pattern `sk-ant-` is provisional until G-21 records the documented key prefix.
- `--bob-replay`/`--bob-record` and `test/fixtures/bob/` keep their names for both providers.

## Phase 0 plan

Gates run now: G-8, G-9, G-10 (smoke workflow in `reprise-smoke`), G-15, G-17, G-18, G-21 (official docs and npm registry), G-21 smoke (one Claude call, after the owner sets the secret). G-13 from the owner. Deferred: G-1 to G-7, G-14, G-19, G-20. Later phases: G-16 (4), G-12 (5), G-11 (7).

Steps:
1. `git init` this folder as `reprise`, add `.gitattributes` (LF everywhere), commit the kit amendment, create `AustineLomocso/reprise` (public) and push `main`. Create `reprise-demo-shop` empty (public) for phase 2.
2. Create `AustineLomocso/reprise-smoke` (public) with `.github/workflows/smoke.yml` (`workflow_dispatch`): jobs for G-8, G-9, G-10 that print PASS or FAIL, and a separate `claude-smoke` job gated on the secret being present.
3. Web checks G-15, G-17, G-18, G-21; record facts with sources in `verified-facts.md` and results in `verification-gates.md`.
4. Checkpoint: the owner sets `ANTHROPIC_API_KEY` in `reprise-smoke` and gives G-13 results; then run the Claude smoke job.

## Phase 0 status (in progress, stopped at checkpoint)

Done:
- Repositories created (public): `AustineLomocso/reprise` (kit pushed), `AustineLomocso/reprise-demo-shop` (empty), `AustineLomocso/reprise-smoke`.
- G-15 PASS, G-17 PASS, G-21 docs PASS (facts F-19 to F-29 in `verified-facts.md`). Commands: `gh api repos/<action>/releases/latest` for each action; `gh api repos/IBM/plex/license`; `gh api repos/actions/checkout/readme`; `npm view @anthropic-ai/sdk`; official docs pages cited in the facts table.
- G-18 FAIL: all five actions have newer majors (F-27). Release notes read for each major since the kit's version: nothing affects the inputs the specs use (`node-version`, `fetch-depth`, `persist-credentials`, `ref`, `path`); checkout v7 blocks fork-PR checkout under `pull_request_target`/`workflow_run` (neither is used); upload-pages-artifact v4+ excludes dotfiles (the dashboard has none). Waiting for the owner's go-ahead on the fallback.
- `reprise-smoke` prepared locally (committed, not pushed): `smoke.yml` with G-8, G-9, G-10 jobs and a `claude` job behind a `run_claude` dispatch input; `claude-smoke/smoke.mjs` uses `@anthropic-ai/sdk` 0.128.0 (pinned, lockfile) with one confined `read_file` tool, prints PASS/FAIL and token usage, never the key. Checked locally: `node --check`, and a run without a key fails cleanly with no stack trace. The workflow uses the newest majors, so it is pushed only after the G-18 go-ahead.

Waiting on the owner:
1. G-18 go-ahead to use the newest majors.
2. `ANTHROPIC_API_KEY` secret in `reprise-smoke` (single-workspace key, spend limit set).
3. G-13 results.

---

# Web-only slice (started 25 Sep 2026)

The owner narrowed the next build to a web-only first slice: the engine scaffold (phase 1), the dashboard and `reprise build-site` (phase 6), generated sample records, and a zero-cost Pages deployment (Pages parts of phase 7), then the dashboard parts of phase 8. No AI or model API code, no triage, fix or verify pipelines, no sandbox. Stub commands exit 2. This supersedes the phase plan above for now; the phases it does not cover remain for the full product (listed in the final report).

## Start checkpoint answers (owner: "all recommended")

| # | Question | Answer |
| --- | --- | --- |
| 1 | OWNER and repositories | Reuse `AustineLomocso` and the existing public repositories; `reprise-demo-shop` gets only a README and `reprise-pages.yml` |
| 2 | ADR number for `data_source` | ADR-13 (ADR-12 is the provider amendment) |
| 3 | G-18 fallback | Use the newest majors: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5 |
| 4 | `@types/node` | Allowed as a third dev dependency (strict TypeScript needs Node's types) |
| 5 | Sample provider and illustrative values | `provider: "claude"` (tokens); tokens, durations, timestamps and SHAs are chosen by hand and checked for consistency by the generator; every statistic comes from `src/stats` |
| 6 | Absent and null values | Approved; written into `02-specs/data-contracts.md` |
| 7 | Verification strips when runs failed | Grouped by outcome, "run order not recorded"; written into `02-specs/dashboard.md` |
| 8 | Rounding | `statistics.md` §7 (one decimal) everywhere; §4 and §6 examples corrected |
| 9 | Links in sample mode | Issue, PR, commit and branch references are plain text (ADR-13) |
| 10 | Duplicate scores | Computed by a real pure implementation of `triage-pipeline.md` §3 |
| 11 | Pinned ref | `reprise-pages.yml` pins `reprise` to a full commit SHA; `dist/reprise.mjs` is committed on `main` and CI fails if it differs from a fresh build |
| 12 | G-11 | Temporary `issue_comment` workflow in `reprise-demo-shop` that calls `reprise-pages.yml`, run once, then removed |
| 13 | Lighthouse | `npx lighthouse` once against the preview (not added to `package.json`) |
| 14 | Local `reprise-smoke` | Left untouched and unpushed |

## Slice plan

| Step | Builds | Checkpoints |
| --- | --- | --- |
| 0 | Gates G-18 (fallback), G-22, G-23 (docs parts); ADR-13; contract and spec amendments | none |
| 1 | Phase 1 scaffold: package, strict tsconfig, esbuild bundle, CLI with stubs, config loader, all schemas, `src/stats` with tests, `src/provider` interface only, `prompts/` copy, CI (typecheck, test, build, dist drift, Node 24 assert for G-8) | none |
| 2 | Phase 6: `src/site` build-site, `dashboard/`, fonts, dedupe scoring function, sample generator and records, preview server, tests, browser review, `ui-review.md` table | none |
| 3 | Pages: `action.yml` (build-site only), `reprise-demo-shop` README and `reprise-pages.yml`, G-22 run, G-11 | Pages settings; first live deploy |
| 4 | Phase 8 dashboard parts: S7 in the browser, definition-of-done ticks, final report | none |

## Step 0 — gates and kit amendments

Plan: apply the G-18 fallback, check the two facts this slice needs (G-22 cross-repository checkout, G-23 Pages API source field) against official sources, and record ADR-13 and the approved clarifications before any code.

Done:
- G-18: fallback applied; `02-specs/github-integration.md` uses checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5.
- G-22 added; docs part PASS (F-30): `gh api repos/actions/checkout/readme` shows `repository` and `ref` ("The branch, tag or SHA to checkout") inputs, and a token is needed only for private or internal secondary repositories. The run part is checked by the first `reprise-pages` run.
- G-23 added; docs part PASS (F-31): https://docs.github.com/en/rest/pages/pages documents `build_type` `workflow`. `gh api repos/AustineLomocso/reprise-demo-shop/pages` currently returns 404 (Pages not enabled).
- ADR-13 in `01-architecture/decisions.md`.
- `02-specs/data-contracts.md`: `data_source` in the site index; absent and null values; medians over records that have the value.
- `02-specs/dashboard.md`: "Sample data (ADR-13)" section with the banner copy; verification strip grouping.
- `02-specs/statistics.md`: one-decimal display everywhere; §4 example is now "about 13.9%", §6 example "1.5% against r = 0.9%".
- `01-architecture/architecture.md`: layout adds `src/site/`, `scripts/generate-sample-records.mjs`, `scripts/preview.mjs`, `test/fixtures/sample-records/`.

Deviations and notes:
- The null-values clarification also makes an iteration's `head_sha` null while `FIXING` (no commit exists yet), and an index entry's `sequence` null when there is no repro; both follow directly from approved item 6.
- `median_bobcoins_per_triage` will be computed over records whose `provider` is `bob` with at least one triage-stage task, because under Claude the Bobcoin fields are 0 by contract (not a measured value). With `claude` samples it is `null`.

## Step 1 — phase 1 engine scaffold (plan)

- `package.json` (type module, engines `>=24`, exact versions): runtime `yaml`, `ajv`, `ajv-formats`; dev `typescript`, `esbuild`, `@types/node` (24.x, matching the runtime).
- `tsconfig.json` strict, `module`/`moduleResolution` `nodenext`, no emit (esbuild compiles).
- `esbuild.config.mjs`: default mode bundles `src/cli.ts` into `dist/reprise.mjs` (node24, ESM, schemas inlined); `--dev` bundles each test file and `src/lib.ts` into `.build/` (dependencies external) so `node --test` runs compiled JavaScript and the sample generator can import the real stats code. Nothing relies on Node's TypeScript stripping.
- `src/cli.ts`: hand-written argument parser, `--help` for every command. `build-site` is wired in step 2; `triage`, `fix`, `verify`, `run --local`, `publish`, `provider` exit 2 with "Not implemented in the web-only build: <command>".
- `src/config/`: load `.reprise.yml` with `yaml`, validate with `schemas/reprise-config.schema.json`, apply the defaults from `architecture.md`.
- `schemas/`: reprise-config, intake, dedupe-confirm, repro, rootcause, fix, issue-record, site-index (with `data_source`), draft 2020-12, `additionalProperties: false`.
- `src/stats/`: `wilson`, `zeroFailureBound`, `requiredRuns`, `verdictFromTrials`, claim and bound sentences, display formatting.
- `src/provider/index.ts`: the `runStage` interface and the stage table from `bob-integration.md`, no implementation.
- `prompts/`: copy of `03-runtime-prompts/`, unchanged.
- Tests: every worked example in `statistics.md` to 4 decimals; every verdict branch; config (missing, invalid, defaults); schemas (the examples in `data-contracts.md` validate, unknown enum fails); CLI stubs exit 2.
- CI `.github/workflows/ci.yml`: Node 24 assert (G-8), `npm ci`, typecheck, test, build, `git diff --exit-code dist/`.

## Step 1 — report

Built:
- `package.json` with exact versions: `yaml` 2.9.1, `ajv` 8.20.0, `ajv-formats` 3.0.1; dev `typescript` 7.0.2, `esbuild` 0.28.2, `@types/node` 24.13.6. No other dependencies.
- `tsconfig.json` (strict, `noUncheckedIndexedAccess`, `nodenext`), `esbuild.config.mjs` (dist bundle, and `--dev` for tests and scripts).
- `src/cli.ts` (entry) and `src/commands.ts` (command table, parser, help, dispatch). Stubs: `triage`, `fix`, `verify`, `run --local`, `publish`, `provider`, each "Not implemented in the web-only build: <command>" on stderr, exit 2. Usage errors exit 1.
- `src/config/` (loader, defaults equal to the `architecture.md` example), `src/schemas.ts` (Ajv 2020 with formats, strict mode), `schemas/*.schema.json` (8 files), `src/types.ts`.
- `src/stats/index.ts` (`wilson`, `zeroFailureBound`, `requiredRuns`, formatting, `claimSentence`, `boundSentence`), `src/stats/verdict.ts` (`verdictFromTrials`, `trialSymbol`).
- `src/provider/index.ts`: interface and stage table only, marked NOT IMPLEMENTED.
- `prompts/`: byte-identical copy of `03-runtime-prompts/` (`diff -r` clean).
- `.github/workflows/ci.yml`: checkout v7, setup-node v7, G-8 assert, `npm ci`, typecheck, test, build, `git diff --exit-code -- dist/`.

Commands and results:
- `npx tsc --noEmit -p .`: no errors.
- `npm test`: 47 tests, 47 pass (stats worked examples to 4 decimals including the 4/20 power check; every verdict branch and the invalid-trial edge at exactly 10%; config missing, invalid, unknown key, bad YAML, defaults; schemas: the `data-contracts.md` examples parsed from the spec itself, unknown enum, unknown field, null values, array cap, stage outputs from `triage-pipeline.md`; CLI stubs, help, flag errors).
- Two local builds give the same `dist/reprise.mjs` SHA-256; CI's fresh Linux build matches the committed Windows build.
- CI run 36092737464: success. G-8 PASS (`v24.21.0`).

Deviations and decisions:
- The schemas carry three nullable points beyond the approved list, each following the same "stage did not run" rule: `triage.fingerprint` (an `ERROR` during intake), `verification.repro.evidence` (only meaningful when every run passed), and `duplicate.behaviour_check`, whose type the spec never gave: it is `null` or a `TrialOutcome` (the result of running the candidate's repro test once). Tell me if you want any of these changed.
- `rootcause.confidence` is a free string: the spec shows only the value `"high"` and defines no enumeration.
- The site-index example uses `""` placeholders for `state`, `verdict` and `updated_at`; the schema test fills them in rather than weakening the schema.
- `sandbox.dockerfile` and `version` are the only required config keys; `architecture.md` marks the Dockerfile "required" and gives defaults for everything else.

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

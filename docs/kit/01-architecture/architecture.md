# Architecture

Diagrams: `diagrams/system-context.mmd`, `diagrams/containers.mmd`, `diagrams/deployment.mmd`. Decisions referenced as ADR-n are in `decisions.md`.

## Overview

Reprise is a TypeScript command-line engine packaged as a composite GitHub Action (ADR-2). A target repository installs it by adding three workflow files and a `.reprise.yml` config. GitHub events trigger the engine on a GitHub-hosted runner. The engine calls its configured reasoning provider for reasoning stages: Bob Shell (`bob run`, ADR-3) or the Claude API (ADR-12), runs all tests inside a Docker sandbox with no network (ADR-5), writes results back to GitHub (comments, labels, branches, pull requests), stores one JSON record per issue on a `reprise-data` branch (ADR-6), and redeploys a static dashboard to GitHub Pages (ADR-7).

## Repositories

Two public repositories (ADR-1).

### `reprise` (engine)

```
reprise/
  action.yml                  composite action: setup Node 24, install Bob Shell only when provider is bob, run dist/reprise.mjs
  package.json
  tsconfig.json
  esbuild.config.mjs          bundles src/cli.ts into dist/reprise.mjs
  dist/reprise.mjs            committed build output for tagged releases
  src/
    cli.ts                    entry point: reprise <command> [flags]
    config/                   load and validate .reprise.yml, defaults
    github/                   event parsing, trust check, comments, labels, branches, pull requests
    provider/                 runStage interface (ADR-12); bob.ts spawns bob run; claude.ts calls the Messages API; tools.ts confined workspace tools
    sandbox/                  docker build and run, per-run timeout, JUnit parsing
    triage/                   intake, dedupe, repro, trials, bisect, rootcause, verdict
    fix/                      propose, edit-scope enforcement, iteration loop
    verify/                   repro check, regression comparison
    stats/                    wilson interval, zero-failure bound, required runs
    store/                    issue record read/write on reprise-data, schema validation
    render/                   Markdown templates for comments
    security/                 minimal env, secret redaction, output scanning
    site/                     build-site: validate records, copy dashboard, generate data/index.json
  prompts/                    runtime prompts (copied from kit 03-runtime-prompts/)
  schemas/                    JSON Schemas for every data contract
  dashboard/                  static site: index.html, app.js, styles.css, fonts/
  scripts/                    generate-sample-records.mjs (ADR-13), preview.mjs (local static server)
  test/                       unit tests, fixtures, recorded provider responses (test/fixtures/bob/),
                              sample records (test/fixtures/sample-records/issues/*.json, ADR-13)
  docs/kit/                   this kit
```

### `reprise-demo-shop` (target and demo)

```
reprise-demo-shop/
  src/                        pricing.js, inventory.js, cart.js, shipping.js
  test/                       node:test suites
  test/reprise/               repro tests added by Reprise (.gitkeep initially)
  Dockerfile.reprise          sandbox image
  .reprise.yml                Reprise config
  .github/workflows/
    reprise-triage.yml
    reprise-fix.yml
    reprise-verify.yml
    reprise-pages.yml         reusable workflow (workflow_call) that builds and deploys the dashboard
  .github/ISSUE_TEMPLATE/bug.yml
  scripts/seed-demo.sh        creates the four demo issues
  scripts/reset-demo.sh       returns the repo to a clean demo state
```

## Engine commands

| Command | Triggered by | Does |
| --- | --- | --- |
| `reprise triage --issue N` | `issues` opened/labeled, `/reprise triage`, reporter reply on a `NEEDS_INFO` issue | Intake → dedupe → environment → repro → trials → verdict → diagnosis |
| `reprise fix --issue N` | `/reprise fix` on an issue with verdict `CONFIRMED` or `FLAKY` | Bob fix loop → open PR → inline verification |
| `reprise verify --pr N` | `pull_request` opened/synchronize/reopened, `/reprise verify` | Repro check + regression comparison on a PR linked with `Fixes #N` |
| `reprise publish` | End of each workflow | Commit the issue record to `reprise-data` |
| `reprise build-site --out DIR` | `reprise-pages.yml` | Merge dashboard assets with records into a static site |
| `reprise run --local ...` | Developer machine (gate G-1 fallback, Bob provider) | Same stages, Bob authenticated by the local login instead of `BOB_API_KEY` |
| `reprise provider` | `action.yml`, before installing Bob | Prints the `provider` value from `.reprise.yml` (default `claude`), so the action installs Bob Shell only when it is `bob` (ADR-12) |

Global flags: `--dry-run` (no writes to GitHub), `--bob-replay DIR` (use recorded provider responses, for either provider; used by tests and CI of the engine, costs no Bobcoins or tokens), `--bob-record DIR`.

## Target repo contract: `.reprise.yml`

```yaml
version: 1
sandbox:
  dockerfile: Dockerfile.reprise      # required; missing file => BLOCKED_ENV
  run_timeout_seconds: 60             # per test run
tests:
  all: "node --test --test-reporter=junit --test-reporter-destination=/out/junit.xml test/"
  single: "node --test --test-reporter=junit --test-reporter-destination=/out/junit.xml {file}"
  report: junit                       # junit | tap (see gate G-10)
  repro_dir: test/reprise
edit_scope:
  repro: ["test/reprise/**"]
  fix: ["src/**", "test/**"]
  never: ["test/reprise/**", ".github/**", ".reprise.yml", "Dockerfile.reprise"]   # fix stage may never touch these
triage:
  trials: 20
  max_repro_attempts: 3
  max_auto_retriage: 3
  bisect: true
fix:
  max_iterations: 3
verify:
  min_runs: 3
  max_runs: 200
  regression_reruns: 3
provider: claude                      # claude | bob (ADR-12); default claude until the Bob switch, then bob
bob:
  max_cost:  { intake: 1, dedupe: 1, repro: 4, rootcause: 2, fix: 6 }   # Bobcoins; placeholder values, set from gate G-4
  max_turns: { intake: 6, dedupe: 4, repro: 20, rootcause: 12, fix: 30 }
claude:
  model: claude-sonnet-5              # confirmed by gate G-21
  max_tokens:     { intake: 4096, dedupe: 2048, repro: 8192, rootcause: 4096, fix: 16000 }   # per request; placeholders, set in phase 3c
  max_tool_turns: { intake: 6, dedupe: 4, repro: 20, rootcause: 12, fix: 30 }
```

A repository without `.reprise.yml` or without the Dockerfile receives `BLOCKED_ENV` naming the missing file. Commands in `tests.*` run inside the sandbox with the repository mounted at `/work` and an output directory at `/out`.

## Module responsibilities and boundaries

- `provider/` is the only module that talks to a reasoning provider. `provider/bob.ts` is the only code that spawns `bob`: it builds the argument list from the stage table in `02-specs/bob-integration.md`, passes a minimal environment, feeds the prompt on stdin, parses the JSON result, validates `last_message` against the stage schema, and records `stats`. `provider/claude.ts` is the only code that calls the Claude API, with the confined tools in `provider/tools.ts` (`02-specs/bob-integration.md` § "Claude provider").
- `sandbox/` is the only module that executes repository code. The model never executes anything (Bob: the `execute` group is disabled in every stage; Claude: no command tool exists).
- `stats/` is pure functions with unit tests against the worked examples in `02-specs/statistics.md`.
- `store/` is the only module that writes to `reprise-data`. Records are validated against `schemas/issue-record.schema.json` before every write.
- `render/` produces every Markdown comment from templates in `02-specs/github-integration.md`; all text passes through `security/redact` first.

## Why the pieces are split this way

Reasoning (reading code, writing tests, proposing fixes) is where Bob is strong. Counting, timing, comparing and deciding verdicts must be reproducible and cheap, so they are plain code. That split makes every number on the dashboard auditable and keeps spend bounded per stage (`--max-cost` for Bob; per-request token limits and tool-turn caps for Claude).

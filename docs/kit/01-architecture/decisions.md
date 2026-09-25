# Architecture Decision Records

Each record: context, decision, consequences. Change a decision only by adding a new record that supersedes it.

## ADR-1 Two public repositories

Context: The submission needs an Application URL and a demo. Reprise should look installable in any repository. Actions and Pages are free only for public repositories on GitHub Free (F-13, F-15).
Decision: `reprise` holds the engine; `reprise-demo-shop` is the target with seeded bugs, the workflows, and the Pages site. Both public.
Consequences: Anyone can read the demo. Bob stages are restricted to trusted actors to protect the Bobcoin allocation (see `02-specs/security.md`).

## ADR-2 Composite GitHub Action wrapping a bundled CLI

Context: Bob Shell requires Node 24 (F-7). A composite action can install Node 24 and Bob Shell before running our code.
Decision: `action.yml` is a composite action: `actions/setup-node` with Node 24 (gate G-8), install Bob Shell with the official script (F-7), run `node dist/reprise.mjs`. The CLI is bundled with esbuild so no `npm install` happens at runtime.
Consequences: The same CLI runs locally (`reprise run --local`), which is also the fallback for gates G-1 and G-2.

## ADR-3 Bob via `bob run` with JSON output

Context: `bob run --format json` returns a result object with cost and token stats (F-2) and supports turn and cost caps (F-3).
Decision: Every Bob stage is one `bob run` call (plus `--resume` for revision loops, gate G-14). Structured answers are returned as JSON in `last_message` and validated against a schema.
Consequences: No custom Bob modes or skills are needed at runtime, so no unverified configuration formats are involved.

## ADR-4 Bob never executes commands

Context: In `bob run` all tools are pre-approved (F-4), and issue text is untrusted input.
Decision: Every stage passes `--disable-tool-groups execute,mcp,subagent,mode,skill` and `--disable-mcp` and `--disable-subagents`. Read-only stages also disable `edit` and `todo`. The engine runs all tests in the sandbox and feeds results back to Bob.
Consequences: A prompt-injected issue cannot run commands. Bob's edits are checked against `edit_scope` and anything out of scope is reverted and reported.

## ADR-5 Docker sandbox with no network

Context: Repro tests and fixes are generated code.
Decision: Build the image from the target's `Dockerfile.reprise`; run every test with `--network none`, a per-run timeout, a read-only mount of a scratch copy of the repository plus a writable `/out`. No secrets are passed into the container.
Consequences: The target repo must provide a Dockerfile. Missing Dockerfile gives `BLOCKED_ENV`. Gate G-9 must pass.

## ADR-6 Issue records on a `reprise-data` branch

Context: Zero-cost persistence that the dashboard can read.
Decision: One file per issue, `issues/<number>.json`, on an orphan branch `reprise-data`. No shared index file is stored; the site build generates it. Commits retry on non-fast-forward by refetching, since each job touches only its own issue file.
Consequences: Full history in git; no database; concurrent jobs do not conflict.

## ADR-7 Static dashboard rebuilt by a reusable workflow

Context: Pushes made with `GITHUB_TOKEN` may not trigger other workflows (gate G-12). Pages allows unlimited builds from custom Actions workflows (F-15).
Decision: Each Reprise workflow ends with a job that calls `reprise-pages.yml` (`workflow_call`), which checks out `reprise-data`, runs `reprise build-site`, and deploys with the official Pages actions. Concurrency group `pages`, cancel in progress.
Consequences: The dashboard updates within minutes of every event, with no dependence on push triggers. Gate G-11 confirms environment rules allow this.

## ADR-8 Verification is deterministic and needs no Bob

Context: Verification should be trustworthy and should also work for human PRs.
Decision: `reprise verify` uses only the sandbox and the statistics module. Bob is not called.
Consequences: Verification costs no Bobcoins and would work on fork PRs once commenting is solved (out of scope).

## ADR-9 Dedupe on fingerprints, confirmed by behaviour

Context: Reports describing one bug use different words.
Decision: Bob extracts a fingerprint; the engine scores it against stored fingerprints (see `02-specs/triage-pipeline.md`); the top candidate above threshold is confirmed by Bob, and, when the candidate has a repro test, by running that test on the current code.
Consequences: No embedding service or extra cost. Scores are explainable in the comment.

## ADR-10 Demo target in plain Node with `node:test`

Context: Zero dependencies keeps the sandbox fast and bisect reliable across commits.
Decision: `reprise-demo-shop` uses Node 24, CommonJS or ES modules without packages, and the built-in test runner. Its Dockerfile uses the official Node 24 image.
Consequences: Reprise's support for other stacks is expressed through `.reprise.yml` commands and is not demonstrated beyond Node in the hackathon.

## ADR-11 Dashboard typography and assets are self-hosted

Context: Zero external requests and zero cost.
Decision: IBM Plex Sans and IBM Plex Mono woff2 files committed to `dashboard/fonts/` (gate G-15), no CDN, no analytics.
Consequences: The dashboard works offline once loaded and has no third-party tracking.

## ADR-12 Pluggable reasoning provider

Context: The five reasoning stages (intake, dedupe, repro, rootcause, fix) are specified against IBM Bob Shell (`bob run`, ADR-3). Bob access for the team was not available when the build started, and the engine must be buildable and testable before the Bob key exists. Bob remains the target provider for the hackathon submission.
Decision: The engine calls reasoning stages only through one interface in `src/provider/`: `runStage(stage, promptVars, opts) -> { json, stats, editedFiles }`. Two implementations sit behind it:

- `bob`: exactly as `../02-specs/bob-integration.md` specifies (ADR-3, ADR-4).
- `claude`: the Anthropic Messages API with tool use through the official Anthropic TypeScript SDK, specified in `../02-specs/bob-integration.md` § "Claude provider". The engine implements the only tools Claude gets (`read_file`, `list_files`, `search_files`, and `write_file` in the repro and fix stages only); there is never a tool that executes commands.

Both use the same prompts from `prompts/`, the same output schemas, validation, single schema-repair retry, redaction, record and replay fixtures, and the same stage table (which stages are read-only, which may edit, and the edit scopes). `.reprise.yml` selects the provider with `provider: claude | bob`. The default is `claude` until the Bob switch checkpoint (before phase 9), then `bob`.
Consequences: Wherever the kit says "Bob" for a runtime stage, read "the configured provider". Bob-only gates (G-1 to G-7, G-14, G-19, G-20) are deferred until the Bob switch and must pass then. Claude API usage is billed (see `../06-deployment/cost-ledger.md`); it is bounded by per-request token limits, per-stage tool-turn caps and a spend limit set by the owner in the Claude Console. Cost is recorded in tokens under Claude and in Bobcoins under Bob, and is never converted to currency. The submission text must say which provider actually ran.

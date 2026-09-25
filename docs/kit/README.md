# Reprise — Bob Build Kit

This directory is the single source of truth for building **Reprise** with IBM Bob 2.0 during the IBM Bob 2.0 Hackathon (25–27 Sep 2026). It holds the product definition, architecture, specs, diagrams, runtime prompts, a phase-by-phase build plan written as prompts for Bob, quality gates, zero-cost deployment steps, and submission material.

## What Reprise is (one paragraph)

Reprise is a bug-lifecycle agent that runs inside GitHub. When a bug report arrives, Reprise checks it for duplicates, rebuilds the environment in a sandbox, writes a reproduction test, and runs it 20 times to decide whether the bug is **confirmed**, **flaky** (with a measured rate), a **duplicate**, **needs info** (with the one question worth asking), or **blocked by the environment**. It does not stop there. For confirmed and flaky bugs it posts a root-cause brief (and, for deterministic bugs, the first bad commit), and on request it has Bob propose a fix as a pull request. Every fix, whether Bob's or a human's, is then verified: the reproduction test must pass enough times to statistically rule the bug out, and the full test suite is compared against the base branch to prove the fix introduced no regressions. Results appear on the issue, on the PR, and on a public dashboard hosted for free on GitHub Pages.

## How to use this kit with Bob

1. Read `00-context/verification-gates.md` first. Nothing gets built on an unverified fact.
2. Work through `04-build-plan/` in order. Each phase file contains a copy-paste prompt, the files to attach, the Bob mode to use, acceptance criteria, and stop conditions.
3. For every phase: start Bob in **Plan** mode with the phase prompt, review the plan, then switch to **Agent** mode to implement. Attach the listed kit files by path (for example with `@00-context/project-brief.md`).
4. Copy this whole kit into the engine repository under `docs/kit/` so Bob always has it in repository context.

## Ground rules for Bob (include these in every session)

- **No assumptions.** If a task needs a fact that is not in `00-context/verified-facts.md` or decided in `01-architecture/decisions.md`, stop, add it to `00-context/verification-gates.md` with a proposed check, and ask the team.
- **Specs win over prompts.** If a phase prompt and a spec disagree, the spec in `02-specs/` is correct; flag the conflict.
- **Names are contracts.** Verdict names, label names, file paths, JSON field names and command names are defined once in `02-specs/data-contracts.md` and `02-specs/github-integration.md`. Do not rename them.
- **Zero cost.** Do not add any service, dependency, or hosting that is not listed in `06-deployment/cost-ledger.md`.

## Provider amendment (ADR-12)

Reprise's runtime reasoning stages run behind a pluggable provider (`provider: claude | bob` in `.reprise.yml`, `01-architecture/decisions.md` ADR-12). The build starts on the Claude API and switches to IBM Bob at a mandatory checkpoint before phase 9. Wherever this kit says "Bob" for a runtime stage, read "the configured provider". Reprise itself is being implemented by Claude Code from this kit (see `PROGRESS.md`).

## Directory map

| Path | Contents |
| --- | --- |
| `00-context/` | Product brief, hackathon requirements, verified facts with sources, verification gates, glossary |
| `01-architecture/` | Architecture overview, decision records, and all Mermaid diagrams (`diagrams/*.mmd`) |
| `02-specs/` | Detailed specs: triage, fix and verify, statistics, data contracts, GitHub integration, Bob integration, security, dashboard, demo target repo |
| `03-runtime-prompts/` | The prompts Reprise itself sends to Bob at runtime (versioned with the engine) |
| `04-build-plan/` | Ordered build phases, each a ready prompt for Bob |
| `05-quality/` | Test strategy, definition of done, UI review template |
| `06-deployment/` | Zero-cost deployment guide, cost ledger, operations runbook |
| `07-submission/` | Submission text, video script, slide outline, cover image brief |

## Diagram index

All `.mmd` files were checked with Mermaid's parser and parse without errors. To view one, paste it into a Mermaid renderer, or wrap it in a ```` ```mermaid ```` block inside a Markdown file on GitHub, which renders Mermaid blocks.

| File | Shows |
| --- | --- |
| `01-architecture/diagrams/system-context.mmd` | Actors, GitHub, Bob service, dashboard |
| `01-architecture/diagrams/containers.mmd` | Engine modules and how they connect |
| `01-architecture/diagrams/triage-pipeline.mmd` | Triage flow from issue to verdict |
| `01-architecture/diagrams/repro-loop.mmd` | Bob write/run/revise loop for the reproduction test |
| `01-architecture/diagrams/fix-verify-sequence.mmd` | Fix proposal and verification sequence |
| `01-architecture/diagrams/regression-classification.mmd` | How each test is classified during regression checking |
| `01-architecture/diagrams/issue-lifecycle.mmd` | State machine of an issue under Reprise |
| `01-architecture/diagrams/data-model.mmd` | Issue record structure |
| `01-architecture/diagrams/deployment.mmd` | Repos, workflows, branches, Pages |

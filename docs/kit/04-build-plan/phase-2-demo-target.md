# Phase 2 — Demo target repository

**Goal:** `reprise-demo-shop` with the exact git history, seeded bugs, tests, sandbox files and scripts from the spec.
**Repository:** `reprise-demo-shop` (public, new).
**Mode:** Plan, then Agent.
**Attach:** `@02-specs/demo-target-repo.md`, `@01-architecture/architecture.md`, `@02-specs/github-integration.md` (labels section).

## Prompt

```
Build the demo repository described in the attached demo-target-repo spec.

1. Create the modules and tests listed under "Modules" and "Existing tests", with prices in integer centavos. All existing tests must pass on the first commit.
2. Create the git history exactly as in "Git history plan", one commit per step with the given messages, and tag v0.1.0 on commit 1. Bug A is introduced in commit 3 and Bug B in commit 4, exactly as described. Do not add tests that cover the deliberate gaps.
3. Write scripts/measure-race.mjs that runs the two-concurrent-reservation scenario 200 times and prints the oversell rate. Stop after creating it; I will run it and we will tune store.js delays together until the rate is between 15% and 40%. Record the final values in the spec table.
4. Add Dockerfile.reprise and .reprise.yml exactly as specified (leave bob.max_cost at the placeholder values for now).
5. Add .github/ISSUE_TEMPLATE/bug.yml as specified.
6. Add scripts/create-labels.sh (gh label create --force for every label in the labels table, with colours), scripts/seed-demo.sh with subcommands stage1 and stage2 (gh issue create with the titles and full bodies from the spec; print the issue numbers), scripts/prepare-bad-fix.sh, and scripts/reset-demo.sh (close all open issues and PRs, delete branches starting with reprise/ and demo/, reset the reprise-data branch to a single empty commit containing a README). Scripts use gh and git only and fail on any error (set -euo pipefail).

Do not add the workflow files yet; phase 4 does that.
```

## Acceptance

- `node --test test/` passes on every commit of the history (check with a loop over `git rev-list`).
- A hand-written test for exactly 10 units fails on commits 3 onward and passes on commit 1 and 2.
- `measure-race.mjs` reports a rate between 15% and 40%, recorded in the spec.
- Scripts pass `bash -n` and `shellcheck` if available.

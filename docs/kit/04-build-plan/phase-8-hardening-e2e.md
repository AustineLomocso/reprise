# Phase 8 — Hardening and end-to-end run

**Goal:** Prove the product holds up: security cases, failure states, idempotency, and one clean end-to-end demo run from a reset repository.
**Repositories:** both.
**Mode:** Plan, then Agent for the automated tests; manual E2E.
**Attach:** `@docs/kit/05-quality/test-strategy.md`, `@docs/kit/05-quality/definition-of-done.md`, `@docs/kit/02-specs/security.md`.

## Prompt

```
Add the hardening tests listed in test-strategy.md under "Security cases" and "Failure cases" to the engine, using recorded or hand-written Bob replay fixtures so they cost nothing. For each case assert the exact expected behaviour from security.md or the specs. Then review the engine code for any path where a string from an issue, from Bob, or from test output reaches a GitHub comment, a commit, a branch name, or the dashboard without passing through redaction, and fix it. List every place you changed.
```

## Manual end-to-end run

1. `scripts/reset-demo.sh`.
2. `scripts/seed-demo.sh stage1`; wait for three verdicts; `scripts/seed-demo.sh stage2`; wait for the duplicate verdict.
3. `/reprise fix` on BULK and on RACE; open the prepared bad-fix PR.
4. Check every row of the "Demo outcomes" table in `05-quality/definition-of-done.md`.
5. Record the full run with screen capture as the video backup (see `07-submission/video-script.md`).

## Acceptance

All definition-of-done items ticked, including the E2E table, and the backup recording saved.

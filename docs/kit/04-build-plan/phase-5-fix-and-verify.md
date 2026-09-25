# Phase 5 — Fix assistance and verification

**Goal:** `/reprise fix` opens a verified fix PR; any PR linked with `Fixes #N` is verified with repro runs and regression comparison; merges resolve the record.
**Repositories:** `reprise`, `reprise-demo-shop`.
**Mode:** Plan, then Agent.
**Attach:** `@docs/kit/02-specs/fix-and-verify.md`, `@docs/kit/02-specs/statistics.md`, `@docs/kit/02-specs/github-integration.md`, `@docs/kit/02-specs/data-contracts.md`, `@docs/kit/01-architecture/diagrams/regression-classification.mmd`, `@docs/kit/01-architecture/diagrams/fix-verify-sequence.mmd`, `@docs/kit/03-runtime-prompts/propose-fix.md`, `@docs/kit/03-runtime-prompts/revise-fix.md`.

## Prompt

```
Implement fix assistance, verification and resolution exactly as in fix-and-verify.md.

1. src/fix: preconditions; branch reuse or creation; scratch clone with the repro test committed first; iteration loop with propose-fix then revise-fix via --resume; scope guard including the repro test hash check and edit_scope.never; quick check; FIX_ABANDONED when every iteration is empty; commit, push, open a draft PR with the specified title and body; then run verification inline.
2. src/verify: linked-issue parsing with the given regex; repro test hash check or injection from reprise/repro-N; required runs from statistics.md section 5 using the triage Wilson low bound; repro check outcomes; regression comparison with the classification in regression-classification.mmd, including the 3 extra reruns on base and head for pass-to-fail tests; verdict precedence; the claim sentences from statistics.md section 6.
3. Outputs: PR comment by marker, commit status context reprise/verify, labels on PR and issue, issue status comment update, record update with a fix iteration of source bob or human.
4. src/github resolve: handle pull_request closed+merged per Part C, including the duplicate notifications.
5. Unit tests: classification for every class with synthetic base/head results; verdict precedence; linked-issue regex (Fixes, fixes, Closes, resolved, multiple issues, no issue); scope guard with a forbidden path and a modified repro test.

In reprise-demo-shop add reprise-fix.yml and reprise-verify.yml exactly as in github-integration.md.
```

## Manual checks (the demo, rehearsed)

1. `/reprise fix` on BULK → draft PR, verification comment `FIX_VERIFIED`, status check green.
2. `scripts/prepare-bad-fix.sh`, then open a PR from `demo/bad-fix-bulk` with body `Fixes #<BULK>` → `REGRESSION_DETECTED` naming the 9-unit test; status red.
3. `/reprise fix` on RACE → `FIX_VERIFIED` with the required run count from its triage rate and the claim sentence.
4. Merge the BULK fix PR → record `RESOLVED`; the DUP issue gets a comment linking the PR.
5. Record in G-12 whether the PR opened by the workflow also started a `pull_request` run, and if it did, make the verify job skip when the same head SHA was already verified inline.

## Acceptance

All five checks pass; unit tests pass; replay fixtures recorded for the fix stage.

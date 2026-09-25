# Definition of Done

Tick every box before phase 9.

## Engine

- [ ] `npm run typecheck`, `npm test`, `npm run build` pass in CI.
- [ ] Every unit area in `test-strategy.md` has tests.
- [ ] Replay test asserts the full demo outcome without Bobcoins.
- [ ] Security cases S1–S7 and all failure cases pass.
- [ ] No string reaches GitHub, git, or the dashboard without redaction (phase 8 review list attached to the PR).
- [ ] Release `v1` tagged; `dist/reprise.mjs` matches a fresh build.

## Demo repository

- [ ] History matches the plan; bisect for BULK lands on the refactor commit.
- [ ] Race rate measured and recorded.
- [ ] Workflows use `@v1`, minimal permissions, `persist-credentials: false`, no `pull_request_target`.
- [ ] Labels created; secrets set; Pages source is GitHub Actions.

## Demo outcomes (end-to-end run from a reset repository)

| Step | Expected | Observed | OK |
| --- | --- | --- | --- |
| BULK triage | `CONFIRMED`, 20/20, first bad commit = refactor commit | | [ ] |
| RACE triage | `FLAKY`, k/20 with interval | | [ ] |
| VAGUE triage | `NEEDS_INFO`, one question | | [ ] |
| DUP triage | `DUPLICATE` of BULK with score and reason | | [ ] |
| `/reprise fix` BULK | Draft PR, `FIX_VERIFIED`, green status | | [ ] |
| Bad-fix PR | `REGRESSION_DETECTED`, names the 9-unit test, red status | | [ ] |
| `/reprise fix` RACE | `FIX_VERIFIED`, run count matches `statistics.md` for the observed k | | [ ] |
| Merge BULK fix | `RESOLVED`; DUP issue gets a link to the PR | | [ ] |
| Dashboard | Shows all of the above within one workflow run of each event | | [ ] |

## Dashboard

- [ ] UI review table in `ui-review.md` complete with every issue resolved.
- [ ] Light and dark, 360 px and 1440 px, keyboard-only walkthrough done.
- [ ] Motion rules verified, including reduced motion and keyboard navigation without animation.

## Documentation

- [ ] Both repository READMEs explain what Reprise does, how to install it in another repo (`.reprise.yml`, Dockerfile, workflows, secret), and link the dashboard.
- [ ] Every gate has a recorded result.
- [ ] `06-deployment/cost-ledger.md` verified column complete.

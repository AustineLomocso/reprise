# Slide Outline

Ten slides, ordered by the judging criteria. Use the dashboard's palette and type from `02-specs/dashboard.md` so the slides and product look like one thing.

1. **Reprise** — from filed to fixed, with proof. Team names. Dashboard URL.
2. **The problem** — about 17% of bug reports can't be reproduced (Rahman et al., EMSE 2022), and causes overlap: duplicates, intermittency, missing info, ambiguous specs. Proving a fix is still manual.
3. **What Reprise answers** — the verdicts as trial strips: reproduced, reproduced sometimes, duplicate, needs one answer.
4. **Beyond the verdict** — diagnosis, first bad commit, Bob-proposed fix PR, verification with repeat runs and regression comparison. Lifecycle diagram from `issue-lifecycle.mmd`.
5. **Application of IBM Bob 2.0** — five `bob run` stages with their tool restrictions and caps (table from `bob-integration.md`); Bob never executes commands; built with Bob IDE from this kit.
6. **Architecture** — `system-context.mmd` and `deployment.mmd`; zero cost on GitHub's free tier.
7. **Proof, not vibes** — the statistics in one slide: Wilson interval, the runs-required rule, and the claim sentence; regression classes.
8. **Demo results** — the table from the definition of done with real observed values; median time and Bobcoins per report.
9. **Originality** — acts before a developer opens the ticket; refuses to call anything fixed without evidence; catches plausible-but-wrong human fixes.
10. **Next steps and ask** — trackers, fork PRs, more languages, flaky-rate feed into CI.

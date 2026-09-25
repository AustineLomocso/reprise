# Submission Content

Placeholders in angle brackets are filled from the live dashboard in phase 9. Do not publish any number that is not on the dashboard, in a verified fact, or in the research brief.

## Project title

Reprise

## Short description

Reprise takes a bug report from "just filed" to "fixed, with proof". Built on IBM Bob 2.0, it reproduces the bug as a failing test with a measured failure rate, helps fix it, and verifies the fix with repeated runs and a full regression check.

## Long description

**The problem.** Some bug reports can't be reproduced by the developer who picks them up; research on Firefox and Eclipse cites roughly 17% of reports, caused by duplicates, intermittent failures, missing details and ambiguous specs. Developers lose hours finding that out. Even when a bug is real, finding the cause, writing a fix, and proving the fix didn't break anything else is all manual.

**What Reprise does.** Reprise runs inside GitHub. When a maintainer opts a report in, Reprise:

1. Structures the report and checks it against earlier reports by what they describe, not how they're worded.
2. Builds the project's test environment in an isolated sandbox.
3. Has IBM Bob write a reproduction test, runs it, and lets Bob revise it until it fails for the reported reason.
4. Runs that test 20 times and answers with one of: reproduced every time, reproduced sometimes (with a rate and confidence interval), duplicate of an earlier issue, or needs one specific answer from the reporter.
5. For real bugs, explains the likely cause, finds the commit that introduced it, and gives developers a ready prompt for Bob IDE.
6. On request, has Bob propose a fix as a pull request, testing and revising it before opening the PR.
7. Verifies every fix, whether Bob's or a person's: the reproduction test must pass enough times to statistically rule the bug out, and the whole test suite is compared against the base branch so any newly broken test blocks the fix.

**How IBM Bob 2.0 is used.** Reprise calls Bob Shell's headless `bob run` with JSON output for five reasoning steps: intake, duplicate confirmation, reproduction test writing, root-cause diagnosis, and fix proposals. Each step has its own cost and turn caps and a restricted tool set: Bob never executes commands (Reprise runs everything in the sandbox and feeds results back), and edits outside the allowed files are reverted. Bob's cost statistics are recorded per issue. The team also built Reprise with Bob IDE, driven by a written architecture and phase-by-phase prompts.

**Results in the demo.** Across <N> demo reports, Reprise reached a verdict in a median of <time> for <Bobcoins> Bobcoins per report. It confirmed a pricing bug and traced it to the commit that introduced it, measured a race condition at <k>/20, caught a duplicate worded completely differently, and asked one precise question on a vague report. Bob's fixes were verified with no regressions, and a plausible-looking human fix was blocked because it broke an existing test.

**Cost.** Hosted entirely on GitHub's free tier for public repositories: Actions for the pipeline, a data branch for records, and GitHub Pages for the dashboard.

**Next steps.** Jira and other trackers, fork pull requests, more languages through the same `.reprise.yml` contract, and posting flaky-test rates into CI dashboards.

## Technology and category tags

IBM Bob, Bob Shell, Agentic AI, Developer Tools, Software Testing, Quality Assurance, Bug Triage, Debugging, GitHub Actions, TypeScript

## Links

- Application URL: `https://OWNER.github.io/reprise-demo-shop/`
- Engine: `https://github.com/OWNER/reprise`
- Demo repository: `https://github.com/OWNER/reprise-demo-shop`

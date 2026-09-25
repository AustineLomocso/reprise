# Project Brief — Reprise

## Problem

A meaningful share of bug reports cannot be reproduced by the developer who picks them up, and the hours spent discovering that are wasted. Rahman et al. (*Works for Me! Cannot Reproduce*, Empirical Software Engineering, 2022; 1,990 reports from Firefox Core and Eclipse JDT) cite roughly 17% of submitted bugs as non-reproducible and break the causes down as duplication 29%, intermittency 14%, missing information 8%, ambiguous specification 8%, with 25% having more than one cause. Even when a bug is reproduced, the developer still has to find the cause, write the fix, prove the fix works, and prove it broke nothing else. Each of those steps is done by hand today.

Source for the figures: the team research brief `claude/developer-workflow-pain-points-research.md`, section 5. The ~17% rate is cited by that study from prior work; the cause breakdown is the study's own.

## Product

Reprise carries a bug report from "just filed" to "fix verified" inside GitHub, using IBM Bob 2.0 for every step that needs reasoning about code and plain deterministic code for every step that needs counting, running, or comparing.

### Lifecycle

1. **Intake.** Bob converts the raw report (text, pasted logs, attached text files) into a structured fingerprint.
2. **Dedupe.** The fingerprint is compared against every earlier issue's fingerprint. A strong candidate is confirmed by Bob and, where the earlier issue has a repro test, by running that test.
3. **Environment.** The sandbox image is built from the target repo's `Dockerfile.reprise`. If the repo has no Reprise config or the image fails to build, the verdict is `BLOCKED_ENV` with the exact missing piece.
4. **Reproduction.** Bob writes a repro test and a failure signature. The engine runs it; Bob revises it with the results, up to 3 attempts. A failure only counts if it matches the signature.
5. **Trials.** The accepted repro test runs 20 times. The result is a rate with a confidence interval.
6. **Verdict.** One of `CONFIRMED`, `FLAKY`, `DUPLICATE`, `NEEDS_INFO`, `BLOCKED_ENV`.
7. **Diagnosis** (confirmed and flaky only). Bob writes a root-cause brief: suspected location, explanation, suggested fix direction. For `CONFIRMED` bugs the engine runs `git bisect` with the repro test to find the first bad commit.
8. **Fix assistance.** A maintainer comments `/reprise fix`. Bob proposes a fix; the engine tests it and feeds results back to Bob, up to 3 iterations; the engine opens a pull request containing the fix and the repro test. A developer who prefers to fix it themselves gets a ready prompt for Bob IDE in the diagnosis comment and can open their own PR with `Fixes #N`.
9. **Verification.** On every fix PR, the engine (a) runs the repro test enough times to rule out the bug statistically, and (b) runs the full suite on the base and the fix, classifying every test. Result: `FIX_VERIFIED`, `FIX_INCOMPLETE`, or `REGRESSION_DETECTED`, posted as a PR comment with evidence.
10. **Resolution.** Merging stays a human decision. When the PR merges and the issue closes, the record moves to `RESOLVED`.

### What the user sees

- Labels and one evidence-rich comment per stage on the issue or PR.
- A public dashboard on GitHub Pages listing every issue, its verdict, its trial strip, fix and verification results, time taken, and Bobcoins spent.

## Users

- **Reporter** — files the issue; may be asked one precise question.
- **Maintainer** — trusted actor who opts issues in, triggers fixes, reviews and merges PRs.
- **Developer** — fixes a bug, with or without Bob's proposed patch, and gets automatic verification.
- **Visitor or judge** — browses the dashboard and the public demo repository.

## Scope for the hackathon

In scope: one engine repository, one demo target repository with seeded bugs, GitHub Actions triggers, GitHub Pages dashboard, JavaScript (Node 24, `node:test`) target projects configured through `.reprise.yml`.

Out of scope (stated as next steps in the pitch): Jira and other trackers, fork pull requests, languages beyond what `.reprise.yml` commands can express, automatic merging, image analysis of screenshots unless gate G-7 passes.

## Non-goals

- Reprise never merges code.
- Reprise never closes an issue as "not a bug". `NEEDS_INFO` states what was tried and asks one question.
- Reprise never edits the repro test to make a fix pass. A modified repro test fails verification.

## Success criteria for the demo

- Four seeded issues produce the four main verdicts in one pass.
- `/reprise fix` on the confirmed issue produces a PR that is verified with no regressions.
- A prepared human "bad fix" PR is caught with `REGRESSION_DETECTED`, naming the broken test.
- The flaky bug's fix is verified with a stated statistical claim.
- The dashboard shows all of it at a public URL with zero hosting cost.

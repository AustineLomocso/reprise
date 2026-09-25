# Build Plan

Ten phases. Each file is a ready prompt for Bob with the files to attach, the mode to use, acceptance criteria, and stop conditions. Do them in order; phases 5 and 6 can run in parallel on two machines once phase 4 is done.

| Phase | File | Priority | Depends on |
| --- | --- | --- | --- |
| 0 | `phase-0-verify-gates.md` | Must | — |
| 1 | `phase-1-engine-scaffold.md` | Must | 0 |
| 2 | `phase-2-demo-target.md` | Must | 0 |
| 3 | `phase-3-triage-core.md` | Must | 1, 2 |
| 4 | `phase-4-github-triage.md` | Must | 3 |
| 5 | `phase-5-fix-and-verify.md` | Must | 4 |
| 6 | `phase-6-dashboard.md` | Must | 4 (data contract) |
| 7 | `phase-7-deploy.md` | Must | 4, 6 |
| 8 | `phase-8-hardening-e2e.md` | Must (E2E), Should (rest) | 5, 7 |
| 9 | `phase-9-submission.md` | Must | 8 |

## How to run a phase with Bob

1. Open the engine repo (or demo repo, as the phase says) in Bob IDE.
2. Start a new task in **Plan** mode. Paste the prompt block. Attach the listed files.
3. Read Bob's plan. Check it against the acceptance criteria. Correct it before moving on.
4. Switch to **Agent** mode and let Bob implement.
5. Run the acceptance checks yourself. Tick them in `../05-quality/definition-of-done.md`.
6. Commit with a message naming the phase.

## Cut line if time runs short

Keep: triage for all four demo issues, `/reprise fix` for BULK, verification with regression detection, dashboard overview and detail pages, deployment. Drop in this order: dedupe behaviour check, bisect, fix for RACE on camera (keep it recorded), How it works page, resolution handling, duplicate notifications.

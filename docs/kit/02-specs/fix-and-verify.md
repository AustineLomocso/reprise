# Fix Assistance and Verification Spec

Diagrams: `../01-architecture/diagrams/fix-verify-sequence.mmd`, `../01-architecture/diagrams/regression-classification.mmd`, `../01-architecture/diagrams/issue-lifecycle.mmd`.

Reprise assists in three ways once a bug is `CONFIRMED` or `FLAKY`:

1. **Diagnosis** in the triage comment: root-cause brief, first bad commit (confirmed bugs), how to run the repro test locally, and a ready prompt for Bob IDE.
2. **Proposed fix** on request: `/reprise fix` makes Bob write a fix, tests it, iterates, and opens a pull request.
3. **Verification** of any fix PR, whoever wrote it.

## Part A — `/reprise fix`

### Preconditions

- Comment on an issue (not a PR), body starts with `/reprise fix`, commenter is a trusted actor.
- Record state is one of `CONFIRMED`, `FLAKY`, `FIX_ABANDONED`, `FIX_INCOMPLETE`, `REGRESSION_DETECTED`.
- Otherwise reply once explaining which state is required and exit.

### Branch and workspace

- If an open PR from branch `reprise/fix-<N>` exists, continue on that branch (new commits). Else create `reprise/fix-<N>` from the default branch head.
- Bob works in a scratch clone with no stored credentials. The repro test file from `reprise/repro-<N>` is copied in and committed as the first commit on a new branch.
- Base suite result: run `tests.all` once on the base commit (or reuse the triage baseline if the default branch head is unchanged).

### Iteration loop (maximum `fix.max_iterations`, default 3)

1. Bob, `propose-fix` prompt (first iteration) or `revise-fix` prompt via `--resume` (later iterations). Inputs: root-cause brief, repro test path and failing output, bisect diff if any, base suite summary, edit rules. Edit group enabled; everything else as in `bob-integration.md`.
2. Bob returns `{ "summary": "...", "files_changed": [...], "risk_notes": "...", "tests_added": [...] }`.
3. Scope guard on `git diff --name-only`:
   - Files outside `edit_scope.fix` or inside `edit_scope.never` are reverted and listed as violations.
   - If the repro test's SHA-256 differs from the record, it is restored and the violation is reported to Bob in the next iteration.
   - If no in-scope change remains, the iteration counts as empty.
4. Quick check in the sandbox: repro test `min(10, required_runs)` times, and `tests.all` once. The candidate passes the quick check when there are zero `FAIL_MATCH` or invalid repro outcomes and no test goes from pass on base to fail on head.
5. Pass → leave the loop. Fail → next iteration with the results.

### After the loop

- Every iteration empty (Bob produced no usable change) → state `FIX_ABANDONED`, label `reprise:fix-incomplete`, comment with Bob's last explanation. No PR.
- Otherwise commit the last candidate (commit message `Fix #<N>: <summary>`), push, and open a **draft** PR titled `Fix #<N>: <summary>` whose body contains: summary, root cause, files changed, risk notes, tests added, "Fixes #<N>", iteration count, cost used (tokens under the Claude provider, Bobcoins under Bob; ADR-12), and a note that verification follows. Add label `reprise:fix-proposed` to the issue.
- Run Part B inline in the same job (so the result does not depend on whether `GITHUB_TOKEN`-created PRs trigger workflows, gate G-12).
- Git identity for commits: the `github-actions[bot]` identity as documented by GitHub (confirm the exact email in phase 4, gate G-17).

Merging is always left to a human. Reprise never marks a PR ready for review; the maintainer does.

## Part B — Verification

### Triggers

| Event | Condition |
| --- | --- |
| `pull_request` opened, synchronize, reopened | PR head is in the same repository; body links at least one issue with a Reprise record in a fixable or verifying state. |
| `issue_comment` on a PR | Body starts with `/reprise verify`, commenter trusted. |
| Inline | End of `/reprise fix`. |

Linked issues: case-insensitive regex `\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\s+#(\d+)\b` on the PR body. PRs with no linked Reprise issue exit silently.

### Inputs

- `base_sha` = `pull_request.base.sha`; `head_sha` = `pull_request.head.sha`.
- Repro test: if present on head, its SHA-256 must equal the record; a mismatch makes the result `FIX_INCOMPLETE` with reason "the reproduction test was modified". If absent, inject it from `reprise/repro-<N>` into the head workspace (not committed) and add a note recommending that the PR include it, with a link.

### Step 1 — Repro check

Run the repro test `required_runs` times on head (`statistics.md` §5). Any `FAIL_MATCH` → not fixed, report k/n. Any invalid outcome → not fixed, reason "the reproduction test no longer runs" with output. All `PASS` → fixed, with evidence `strong` or `limited` and the claim sentence from `statistics.md` §6.

### Step 2 — Regression comparison

1. Run `tests.all` once on base and once on head (base result may be reused from the fix job if `base_sha` matches).
2. Match tests by id `<file>::<full test name>`.
3. Classify every id with the rules in `regression-classification.mmd`:

| Class | Blocks? |
| --- | --- |
| `UNCHANGED_PASS` | no |
| `NEWLY_PASSING` | no (reported as good news) |
| `PRE_EXISTING_FAILURE` | no (reported, not blamed) |
| `PRE_EXISTING_FLAKY` | no (reported with base and head counts) |
| `ADDED_PASSING` | no |
| `ADDED_FAILING` | yes |
| `REMOVED` | yes (a fix PR should not delete tests; renames show as removed plus added and must be explained by a human) |
| `REGRESSION` | yes |

The injected repro test is excluded from this comparison; it is judged in Step 1.

### Verdict

Precedence: any blocking class → `REGRESSION_DETECTED`; else repro not fixed → `FIX_INCOMPLETE`; else `FIX_VERIFIED` (with evidence strength).

### Outputs

- PR comment with marker `<!-- reprise:verify -->`, updated in place, using the verification template.
- Commit status on `head_sha`, context `reprise/verify`: `success` for `FIX_VERIFIED`, `failure` otherwise, with a one-line description.
- Labels on the PR and the issue: `reprise:fix-verified`, `reprise:fix-incomplete`, or `reprise:regression` (remove the other two, and remove `reprise:fix-proposed`).
- Issue status comment updated with a link to the PR and the result.
- Record: a new `fix.iterations[]` entry (source `bob` or `human`) with the verification object; state updated.

## Part C — Resolution

On `pull_request.closed` with `merged: true` for a PR linked to a Reprise issue:

- If the last verification for that head SHA was `FIX_VERIFIED` → state `RESOLVED`.
- Otherwise → state `RESOLVED` with `resolution_note: "merged without passing verification"`, shown on the dashboard.
- Issues whose record says `DUPLICATE` of this issue receive a comment linking the merged PR.

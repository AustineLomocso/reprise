# Triage Pipeline Spec

Diagrams: `../01-architecture/diagrams/triage-pipeline.mmd`, `../01-architecture/diagrams/repro-loop.mmd`. Contracts: `data-contracts.md`. Bob flags: `bob-integration.md`. Prompts: `../03-runtime-prompts/`.

## 0. Trigger rules

Triage starts when any of these happens, evaluated by the engine (the workflow `if` only filters obvious non-matches):

| Event | Condition |
| --- | --- |
| `issues.opened` | Issue author is a trusted actor. |
| `issues.labeled` | Label is `reprise` and the labeler is a trusted actor. |
| `issue_comment.created` | Body starts with `/reprise triage` and commenter is a trusted actor. |
| `issue_comment.created` | Commenter is the issue author, issue has label `reprise:needs-info`, and the record's automatic re-triage count is below `triage.max_auto_retriage`. |

Anything else exits with no Bob call and no comment. Pull request comments are ignored by triage.

## 1. Acknowledge

Post (or update) the status comment with marker `<!-- reprise:status -->`: "Reprise is looking at this report." Add label `reprise:triaging`. Record event `triage.started`.

## 2. Intake (Bob, read-only)

Input: issue title, body, and up to 3 text attachments (`.log`, `.txt`, `.json`, `.md`), each truncated to 200 KB (gate G-16). Image attachments are listed by name only unless gate G-7 passes (under the Claude provider they are always listed as "present, not analysed"; ADR-12). The report is inserted into the prompt inside an untrusted-content block (see `security.md`). The component list given to Bob is the list of files under the target's `src/` directory.

Output schema `intake.schema.json`:

```json
{
  "fingerprint": {
    "component": "pricing",
    "functions": ["applyBulkDiscount"],
    "symptom": "bulk discount not applied at quantity 10",
    "trigger": "cart with exactly 10 units of one sku",
    "expected": "10% discount applied",
    "actual": "full price charged",
    "error_signature": ""
  },
  "attempt_possible": true,
  "missing": [],
  "question": ""
}
```

Rules: `component` must be one of the listed components or `"unknown"`. `functions` contains only identifiers that exist in the repository (the engine drops any that `grep` cannot find). If `attempt_possible` is false, `question` must be one sentence and the verdict is `NEEDS_INFO` immediately.

## 3. Dedupe

Compare the new fingerprint with every record whose triage verdict is not `DUPLICATE` and whose issue number is lower.

Normalisation: lowercase, split on non-alphanumerics and on camelCase boundaries, drop tokens of length 1 and this stopword list: `a an and are as at be but by for from has have in is it of on or that the this to was were when with`.

Field scores:

| Field | Method | Weight |
| --- | --- | --- |
| `component` | 1 if equal and not `unknown`, else 0 | 0.20 |
| `functions` | Jaccard of identifier sets (exact, case-sensitive) | 0.30 |
| `symptom` | Jaccard of normalised tokens | 0.20 |
| `trigger` | Jaccard of normalised tokens | 0.15 |
| `error_signature` | Jaccard of normalised tokens | 0.15 |

A field counts only if it is non-empty on both sides; the score is the weighted sum divided by the sum of weights of counted fields. Candidates are records with score ≥ 0.60. These weights and the threshold are starting values: phase 3 calibrates them on the demo fixtures (the seeded duplicate must score ≥ threshold, and every other seeded pair must score below it) and records the final values here.

Confirmation for the top candidate only:

1. Bob (read-only, `dedupe-confirm` prompt) answers `{ "same_bug": true|false, "reason": "..." }`.
2. If the candidate has a repro test, run it once on the current code. Result is reported as supporting evidence. If it now **passes** (the earlier bug is fixed), the new report is not treated as a duplicate; triage continues and the comment mentions the candidate.

Verdict `DUPLICATE` requires `same_bug: true` and no contradicting behaviour check. Comment names the original issue, the score with per-field breakdown, Bob's reason, and the behaviour check result.

## 4. Environment

1. Load `.reprise.yml`. Missing or invalid → `BLOCKED_ENV` naming the file or the schema error.
2. `docker build -f <sandbox.dockerfile>` with a 10-minute timeout. Failure → `BLOCKED_ENV` with the last 50 lines of build output.
3. Run `tests.all` once on the current default branch head to get the baseline suite result (stored for later verification and shown in the comment as "suite before any change: X passing, Y failing").

## 5. Reproduction loop (Bob, edit allowed in `edit_scope.repro` only)

1. Bob receives the `write-repro-test` prompt with the fingerprint, report, component source paths, and the conventions: file `test/reprise/issue-<N>.test.js`, test name starting with `reprise #<N>:`, `node:test` and `node:assert/strict` only, no network, no mocking of the code under test, no reliance on wall-clock time except when the report is about timing.
2. Bob returns `{ "test_file": "...", "signature": { "kind": "...", "pattern": "..." }, "rationale": "..." }` where `kind` is one of `assertion_message`, `error_type`, `output_regex`, `timeout`.
3. The engine reverts every change outside `edit_scope.repro` and records them as `scope_violations`.
4. The engine runs the test once (see `sandbox` in `bob-integration.md` for the command). Outcome classification as in `statistics.md` §1.
5. Accept when the outcome is `FAIL_MATCH`. Otherwise resume the same Bob task with the `revise-repro-test` prompt containing the outcome, the JUnit failure message, and the last 100 lines of output. Maximum `triage.max_repro_attempts` (3) attempts in total.
6. If no attempt is accepted → `NEEDS_INFO`. The question comes from a final read-only Bob call to the `intake` prompt in "question only" mode, given what was tried.

A signature `pattern` is a JavaScript regular expression source string, matched case-sensitively against the JUnit failure message, then against the captured output. It must be at most 200 characters, compile, and not match an empty string.

## 6. Trials

Run the accepted test `triage.trials` (20) times, each in a fresh container, up to 4 in parallel. Classify every trial. Apply the invalid-trial rule and the verdict table in `statistics.md` §1–2. Store the sequence, counts, rate, and Wilson interval.

## 7. Bisect (CONFIRMED only)

1. Candidate good commit: the most recent tag reachable from the default branch head; if there is no tag, the root commit.
2. At the candidate, copy the repro test into a scratch worktree and run it once. It must `PASS`. Otherwise status `no_good_commit` with the observed outcome.
3. `git bisect start <head> <good>` and `git bisect run` with a script that copies the repro test in and runs it: exit 0 on `PASS`, 1 on `FAIL_MATCH`, 125 (skip) on anything else.
4. Limit: 15 minutes. Record `first_bad_sha`, subject, author name, date, and the commit URL. Always `git bisect reset`.

For `FLAKY` the status is `skipped` with reason "bisect is unreliable for intermittent failures".

## 8. Root cause (Bob, read-only)

Input: fingerprint, repro test source, one failing output, the first bad commit diff if available (truncated to 20 KB). Output schema `rootcause.schema.json`:

```json
{
  "summary": "applyBulkDiscount uses > instead of >= so exactly 10 units never qualifies",
  "locations": [ { "file": "src/pricing.js", "start_line": 12, "end_line": 14, "reason": "comparison excludes the threshold" } ],
  "fix_direction": "compare with >= against BULK_MIN_QTY",
  "confidence": "high"
}
```

The engine checks every `file` exists and every line range is within the file; invalid locations are dropped and noted.

## 9. Publish

- Push the accepted repro test to branch `reprise/repro-<N>` (one commit on top of the default branch head).
- Update the status comment using the template for the verdict (`github-integration.md`), set the verdict label, remove `reprise:triaging`.
- For `CONFIRMED` and `FLAKY`, the comment includes the root-cause brief, bisect result, local run command, the copy-paste Bob IDE prompt (`ide_prompt`, built from a template, not generated), and the `/reprise fix` hint.
- Write the record, then call the Pages workflow.

## Failure handling

Any stage error, Bob `status: "error"`, cost or turn limit event, Claude stage error (`bob-integration.md` § "Claude provider", Stage call step 4), or workflow timeout → state `ERROR`, label `reprise:error`, comment stating which stage and why, and "Comment `/reprise triage` to try again." Partial evidence gathered before the error is kept in the record.

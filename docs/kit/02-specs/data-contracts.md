# Data Contracts

Every contract has a JSON Schema in the engine at `schemas/<name>.schema.json` (draft 2020-12). The engine validates Bob outputs on receipt and issue records before every write. Field names below are final.

## Enumerations

```
State:            NEW | TRIAGING | CONFIRMED | FLAKY | DUPLICATE | NEEDS_INFO | BLOCKED_ENV | ERROR
                  | FIXING | FIX_ABANDONED | VERIFYING | FIX_VERIFIED | FIX_INCOMPLETE | REGRESSION_DETECTED | RESOLVED
TriageVerdict:    CONFIRMED | FLAKY | DUPLICATE | NEEDS_INFO | BLOCKED_ENV
VerifyVerdict:    FIX_VERIFIED | FIX_INCOMPLETE | REGRESSION_DETECTED
TrialOutcome:     PASS | FAIL_MATCH | FAIL_OTHER | ERROR
SignatureKind:    assertion_message | error_type | output_regex | timeout
BisectStatus:     found | no_good_commit | skipped | timeout | error
Evidence:         strong | limited
FixSource:        bob | human
TestClass:        UNCHANGED_PASS | NEWLY_PASSING | PRE_EXISTING_FAILURE | PRE_EXISTING_FLAKY | ADDED_PASSING | ADDED_FAILING | REMOVED | REGRESSION
Stage:            intake | dedupe | repro | rootcause | fix
Provider:         claude | bob                                   (ADR-12)
EventType:        triage.started | triage.verdict | bisect.done | rootcause.done | fix.started | fix.iteration | fix.pr_opened
                  | fix.abandoned | verify.started | verify.verdict | resolved | error
```

## Stage outputs (Bob: in `last_message`; Claude: the final response text)

| Schema | Stage | Shape |
| --- | --- | --- |
| `intake` | intake | see `triage-pipeline.md` §2 |
| `dedupe-confirm` | dedupe | `{ "same_bug": boolean, "reason": string }` |
| `repro` | repro (write and revise) | `{ "test_file": string, "signature": { "kind": SignatureKind, "pattern": string }, "rationale": string }` |
| `rootcause` | rootcause | see `triage-pipeline.md` §8 |
| `fix` | fix (propose and revise) | `{ "summary": string, "files_changed": string[], "risk_notes": string, "tests_added": string[] }` |

## Issue record — `issues/<N>.json` on `reprise-data`

```json
{
  "schema": 1,
  "repo": "OWNER/reprise-demo-shop",
  "issue": 1,
  "title": "Bulk discount not applied when buying exactly 10 units",
  "url": "https://github.com/OWNER/reprise-demo-shop/issues/1",
  "provider": "claude",
  "state": "FIX_VERIFIED",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "triage_runs": 1,
  "auto_retriage_count": 0,
  "triage": {
    "verdict": "CONFIRMED",
    "started_at": "ISO-8601",
    "finished_at": "ISO-8601",
    "duration_ms": 0,
    "fingerprint": { "component": "", "functions": [], "symptom": "", "trigger": "", "expected": "", "actual": "", "error_signature": "" },
    "duplicate": { "of": null, "score": null, "fields": {}, "reason": "", "behaviour_check": null },
    "question": "",
    "baseline_suite": { "sha": "", "passed": 0, "failed": 0 },
    "repro": {
      "test_file": "test/reprise/issue-1.test.js",
      "test_sha256": "",
      "branch": "reprise/repro-1",
      "signature": { "kind": "assertion_message", "pattern": "" },
      "attempts": 1,
      "scope_violations": [],
      "trials": 20, "failed": 20, "invalid": 0,
      "sequence": "FFFFFFFFFFFFFFFFFFFF",
      "rate": 1.0, "wilson_low": 0.8389, "wilson_high": 1.0
    },
    "bisect": { "status": "found", "good_sha": "", "first_bad_sha": "", "subject": "", "author": "", "date": "", "url": "", "reason": "" },
    "root_cause": { "summary": "", "locations": [], "fix_direction": "", "confidence": "high", "ide_prompt": "" }
  },
  "fix": {
    "iterations": [
      {
        "n": 1,
        "source": "bob",
        "pr": 5,
        "branch": "reprise/fix-1",
        "base_sha": "",
        "head_sha": "",
        "bob_iterations": 1,
        "scope_violations": [],
        "summary": "",
        "verification": {
          "verdict": "FIX_VERIFIED",
          "finished_at": "ISO-8601",
          "repro": { "runs_required": 3, "runs": 3, "failed": 0, "invalid": 0, "evidence": "strong", "claim": "", "injected": false },
          "regression": {
            "tests_total": 0,
            "counts": { "UNCHANGED_PASS": 0, "NEWLY_PASSING": 0, "PRE_EXISTING_FAILURE": 0, "PRE_EXISTING_FLAKY": 0, "ADDED_PASSING": 0, "ADDED_FAILING": 0, "REMOVED": 0, "REGRESSION": 0 },
            "blocking": [ { "id": "", "class": "REGRESSION", "base": "4/4 pass", "head": "0/4 pass", "message": "" } ],
            "notable": [ { "id": "", "class": "NEWLY_PASSING" } ]
          }
        }
      }
    ]
  },
  "resolution_note": "",
  "cost": { "bobcoins_total": 0, "by_stage": { "intake": 0, "dedupe": 0, "repro": 0, "rootcause": 0, "fix": 0 }, "bob_tasks": [ { "stage": "intake", "task_id": "", "session_costs": 0, "duration_ms": 0, "total_tokens": 0, "input_tokens": 0, "output_tokens": 0, "tool_calls": 0 } ] },
  "events": [ { "at": "ISO-8601", "type": "triage.started", "detail": "" } ]
}
```

Provider fields (ADR-12): `provider` is the provider configured in `.reprise.yml` for the most recent run that wrote this record. Every `bob_tasks` entry records `input_tokens` and `output_tokens` (both providers; `total_tokens` is their sum under Claude). Under Claude, `session_costs`, `cost.by_stage.*` and `cost.bobcoins_total` are 0; token totals are summed from `bob_tasks`. Neither unit is ever converted to currency. `tool_calls` is the count from Bob's `stats` (F-2) or the number of tool calls Claude made in the stage call.

Rules: `events` is append-only. Strings coming from Bob or from issue text are stored after redaction (`security.md`). Arrays have documented caps: `events` 200, `bob_tasks` 100, `blocking` 50, `notable` 50.

## Site index — `data/index.json` (generated at site build, never stored on `reprise-data`)

```json
{
  "generated_at": "ISO-8601",
  "repo": "OWNER/reprise-demo-shop",
  "provider": "claude",
  "totals": {
    "issues": 0,
    "by_state": { "CONFIRMED": 0 },
    "median_time_to_verdict_ms": 0,
    "median_bobcoins_per_triage": 0,
    "median_tokens_per_triage": 0,
    "fixes_verified": 0,
    "regressions_caught": 0
  },
  "issues": [ { "issue": 1, "title": "", "state": "", "verdict": "", "rate": 1.0, "sequence": "", "updated_at": "", "bobcoins_total": 0, "tokens_total": 0, "pr": 5 } ]
}
```

`regressions_caught` counts verifications with verdict `REGRESSION_DETECTED`.

ADR-12 fields: `provider` is the `provider` of the most recently updated record. `issues[].tokens_total` is the sum of `input_tokens + output_tokens` over the record's `bob_tasks`. `median_tokens_per_triage` is the median, over records with at least one triage-stage task (`intake`, `dedupe`, `repro`, `rootcause`), of that record's triage-stage tokens. The dashboard shows tokens when `provider` is `claude` and Bobcoins when it is `bob`.

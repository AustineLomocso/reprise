# Test Strategy

Principle: everything that decides a verdict is deterministic code with unit tests; everything the reasoning provider does (Bob or Claude, ADR-12) is exercised through recorded replays, so the engine's CI never spends Bobcoins or API tokens; the real system is proven by one scripted end-to-end run.

## Layers

| Layer | Where | Runs in | Costs Bobcoins or tokens |
| --- | --- | --- | --- |
| Unit | `reprise/test/unit/` | Engine CI on every push | No |
| Pipeline replay | `reprise/test/replay/` using `test/fixtures/bob/` | Engine CI on every push | No |
| Demo repo suite | `reprise-demo-shop/test/` | Locally and inside the sandbox | No |
| End-to-end | Live demo repository | Manually, phase 8 and before recording | Yes (bounded by caps) |

## Unit coverage required

- `stats`: every worked example in `02-specs/statistics.md`.
- `verdictFromTrials`: all rows of the verdict table and the invalid-trial rule.
- `classifyTrial`: each outcome for each signature kind, including a failure that does not match.
- Dedupe scoring: normalisation, empty-field renormalisation, threshold edge (exactly 0.60).
- Scope guard: allowed path, forbidden path, `never` path, modified repro test.
- Regression classification: one case per class; verdict precedence.
- Linked-issue regex: all keyword forms, several issues, none.
- Redaction: exact secret values (including `ANTHROPIC_API_KEY`), `ghp_`/`ghs_`/`github_pat_`/`sk-ant-` patterns, secrets split across lines.
- Provider interface (ADR-12): both providers through replay fixtures; the Claude tools' confinement (absolute path, `..`, `.git/`, symlink escape), `write_file` edit-scope refusal, tool-turn cap, output-limit stop, schema-repair retry in the same conversation, revision continuing the same history.
- Config: missing file, invalid schema, defaults applied.
- Render: each template with realistic values; no unreplaced `{{` in output.
- Schemas: example records validate; a record with an unknown enum value fails.

## Replay fixtures

Recorded in phase 3 (triage) and phase 5 (fix) with `--bob-record`. The replay test runs the full pipeline against a local checkout of the demo repo at a pinned commit and asserts: the four triage verdicts, the bisect result for BULK, the fix verdicts for BULK and RACE, and that the bad-fix branch yields `REGRESSION_DETECTED`. For RACE, assert the verdict class, not the exact rate.

When a runtime prompt changes, re-record the affected fixtures and review the diff of Bob's outputs in the PR.

## Security cases (phase 8)

Each is a hand-written issue event plus a replay fixture, run once with a Bob fixture and once with a Claude fixture (ADR-12). For the Claude provider, S1 and S5 are expected to be refused at `write_file` (reported as a scope violation) and the post-stage guard must find nothing left to revert:

| Case | Input | Expected |
| --- | --- | --- |
| S1 | Issue body instructs Bob to edit `.github/workflows/reprise-triage.yml` | Fixture edits that file; engine reverts it, lists a scope violation, verdict unaffected |
| S2 | Fixture's model output contains the fake `BOB_API_KEY` value (Bob) or fake `ANTHROPIC_API_KEY` value (Claude) | Post aborted, state `ERROR`, the value appears nowhere in comments, records or logs |
| S3 | Issue body contains `</untrusted_report>` | Escaped in the prompt |
| S4 | Non-collaborator opens an issue | No Bob call, no comment |
| S5 | Fix fixture modifies the repro test | Change reverted, reported to Bob; if still modified at verify time, `FIX_INCOMPLETE` with the stated reason |
| S6 | Fix fixture deletes an existing test | Verification `REGRESSION_DETECTED` with class `REMOVED` |
| S7 | Issue title with `<img src=x onerror=alert(1)>` | Dashboard shows the text literally; no script runs; no CSP violation. Checked in two layers, because no DOM dependency is allowed: CI asserts that the dashboard sources use no HTML-parsing DOM API, inline handler, inline script or inline style, and that the S7 record in `test/fixtures/security/` reaches the site unchanged; a browser check (Playwright against `node scripts/preview.mjs --data test/fixtures/security --data-source live --port 4174`) confirms literal text, no created elements, no dialog and no CSP violation, recorded in `ui-review.md` |

## Failure cases (phase 8)

| Case | Expected |
| --- | --- |
| Bob result `status: "error"` | `ERROR` state, stage named in comment |
| Stream reports cost limit reached | `ERROR` with "cost cap reached in stage X" |
| Claude: tool-turn budget exhausted | `ERROR` with "tool-turn cap reached in stage X" |
| Claude: response stopped at the output token limit | `ERROR` with "output token limit reached in stage X" |
| Claude: API error (authentication, rate limit, server error) | `ERROR` naming the stage and the error class; the key never appears |
| Invalid JSON twice | `ERROR` after exactly one repair attempt |
| Docker build fails | `BLOCKED_ENV` with build output tail |
| `.reprise.yml` missing | `BLOCKED_ENV` naming the file |
| More than 2 invalid trials, attempts exhausted | `ERROR` with invalid outputs attached |
| Record push conflict | Retries, then succeeds; no lost events |
| Same event delivered twice | One comment (updated in place), one record, events not duplicated beyond the second `triage.started` |

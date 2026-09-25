---
stage: repro
schema: repro
variables: [issue_number, attempt, max_attempts, outcome, failure_message, output_tail, scope_violations]
---
Reprise ran your test for issue #{{issue_number}} (attempt {{attempt}} of {{max_attempts}}).

Outcome: {{outcome}}
Failure message (if any): {{failure_message}}
Last lines of output:
{{output_tail}}
Changes outside the allowed file that were reverted: {{scope_violations}}

What the outcome means:
- `PASS`: the test passed, so it does not capture the bug. Re-read the report and the code and target the condition more precisely.
- `FAIL_OTHER`: it failed, but your signature did not match, so it failed for a different reason (often a wrong import path, wrong function name, or wrong expected value).
- `ERROR`: it did not run (syntax error, import error, or timeout).

Revise the same test file under the same requirements as before and return the same JSON structure.

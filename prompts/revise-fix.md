---
stage: fix
schema: fix
variables: [issue_number, iteration, max_iterations, repro_result, suite_result, new_failures, scope_violations]
---
Reprise tested your change for issue #{{issue_number}} (iteration {{iteration}} of {{max_iterations}}).

Reproduction test runs: {{repro_result}}
Full suite compared with the base commit: {{suite_result}}
Tests that passed on base and fail with your change:
{{new_failures}}
Changes that were reverted because they were out of scope: {{scope_violations}}

Revise your change so the reproduction test passes every run and no test that passed on base fails. Follow the same rules as before and return the same JSON structure.

# Runtime Prompts

These are the prompts the Reprise engine sends to Bob with `bob run`. They are copied into the engine at `reprise/prompts/` and versioned with it. Rules for every file:

- Front matter lists every variable. The runner fails if a variable is missing (`../02-specs/bob-integration.md`).
- Reporter-supplied text only ever appears inside `{{untrusted_report}}`, which the runner wraps in the untrusted block (`../02-specs/security.md`).
- The runner appends the stage's JSON schema and "Reply with one JSON object and nothing else." Do not repeat it in the prompt body.
- Keep prompts short and concrete. When a prompt changes, re-record the replay fixtures (`../05-quality/test-strategy.md`).

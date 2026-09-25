# Glossary

| Term | Meaning in this project |
| --- | --- |
| Engine | The Reprise program (TypeScript, Node 24) that orchestrates every stage. Lives in the `reprise` repository and runs inside GitHub Actions. |
| Target repo | The repository whose issues Reprise triages. For the hackathon this is `reprise-demo-shop`. |
| Sandbox | A Docker container built from the target repo's `Dockerfile.reprise`, run with no network, in which all tests execute. |
| Stage | One step of the pipeline (intake, dedupe, repro, trials, bisect, root cause, fix, verify). |
| Bob stage | A reasoning stage: intake, dedupe, repro, rootcause, fix. It calls the configured provider (`bob run`, or the Claude API under ADR-12). All other stages are plain deterministic code. |
| Provider | The service that runs reasoning stages, selected by `provider: claude \| bob` in `.reprise.yml` (ADR-12). |
| Tokens | The unit the Claude provider records (`input_tokens`, `output_tokens` per stage call). Shown instead of Bobcoins when the provider is `claude`; never converted to currency. |
| Fingerprint | Structured summary of a bug report (component, symptom, trigger, expected, actual, error signature) extracted by Bob. Used for dedupe. |
| Repro test | The test Bob writes that must fail on the current code for the reason described in the report. |
| Signature | A machine-checkable description of the expected failure (an assertion message or error pattern). A failure that does not match the signature does not count as a reproduction. |
| Trial | One execution of the repro test in a fresh sandbox run. Triage performs 20 trials by default. |
| Failure rate | Failed trials divided by valid trials, reported with a Wilson 95% interval. |
| Verification | Checks on a fix: repro-test runs on the fix, plus a full-suite regression comparison against the base commit. |
| Regression | A test that passes on the base commit in every run and fails at least once on the fix commit. |
| Issue record | The JSON document for one issue stored on the `reprise-data` branch. The dashboard is built from these records. |
| Bobcoins | The unit `bob run --max-cost` uses and `stats.session_costs` reports. Reprise records it and does not convert it to currency (see gate G-4). |
| Trusted actor | A GitHub user whose `author_association` is `OWNER`, `MEMBER` or `COLLABORATOR`. Only trusted actors can start Bob stages. |

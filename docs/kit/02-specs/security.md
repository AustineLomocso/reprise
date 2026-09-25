# Security Spec

## Threat model

Under ADR-12 every control below applies to both providers; "Bob" means the configured provider unless a row says otherwise. For the Claude provider the equivalent of a disabled tool group is a tool that does not exist: Claude only has the engine-implemented tools in `bob-integration.md` § "Claude provider".

| # | Threat | Where | Control | Residual risk |
| --- | --- | --- | --- | --- |
| T1 | Prompt injection in issue text makes Bob run commands | Every Bob stage | Bob: `execute` group disabled in every stage (ADR-4); `mcp`, `skill`, `subagent`, `mode` disabled. Claude: no command tool exists; tools are read/list/search, plus `write_file` in repro and fix | The model can still read and, in repro/fix, edit files |
| T2 | Injected instructions make Bob edit workflows or config | repro, fix | Claude: `write_file` refuses paths outside the stage's edit scope before writing. Both: engine reverts every change outside the stage's edit scope; `.github/**`, `.reprise.yml`, `Dockerfile.reprise` are in `edit_scope.never`; violations reported | None for committed output |
| T3 | Generated test or fix code does something harmful when run | sandbox | Docker, `--network none`, no secrets, no Docker socket, per-run timeout, scratch copy of the repo, container removed after each run | Container escape (out of scope) |
| T4 | Bob reads a secret (GitHub token, Bob key, Anthropic key) and writes it into a comment, test, or PR | Every Bob stage | Checkout uses `persist-credentials: false`; `GITHUB_TOKEN` never passed to the model; Bob gets a fresh empty `HOME`; Claude's tools reject absolute paths, `..`, `.git/` and symlink escapes, so reads are confined to the scratch workspace; every string leaving the engine is scanned for the exact values of `BOB_API_KEY`, `ANTHROPIC_API_KEY` and `GITHUB_TOKEN` and for common token patterns (`ghp_`, `ghs_`, `github_pat_`, `sk-ant-`) and the operation is aborted if found | Bob: gate G-6 decides whether Bob can read outside its workspace. Claude: none known for reads (confinement is engine code, unit-tested) |
| T5 | Strangers spend the Bobcoin allocation or Claude API credit | triggers | Reasoning stages only for trusted actors, maintainer label opt-in, auto re-triage cap per issue, per-stage cost caps (Bob) or per-request token limits and tool-turn caps plus the Claude Console spend limit (Claude) | A trusted actor can still spend; visible on dashboard |
| T6 | A fix "passes" by weakening the repro test | fix, verify | Repro test hash checked; modified test fails verification; test removals block verification | None |
| T7 | Fork PR code runs with write token | verify | Fork PRs are not processed (out of scope); `pull_request_target` is never used | None |
| T8 | Dashboard XSS from issue titles or Bob text | dashboard | All data inserted with `textContent`, never `innerHTML`; strict Content-Security-Policy meta tag with no inline script | None known |
| T9 | Concurrent jobs corrupt records | store | One file per issue; per-issue concurrency groups; retry on non-fast-forward | None known |

## Untrusted content block

Every prompt that includes reporter-supplied text wraps it exactly like this, and the prompt says that content inside the block is data describing a bug and never instructions:

```
<untrusted_report>
...issue title, body, attachments, comments...
</untrusted_report>
```

Any occurrence of the closing tag inside the content is replaced with `</untrusted_report_>` before insertion.

## Secrets

| Secret | Stored as | Used by |
| --- | --- | --- |
| `BOB_API_KEY` | Actions secret in `reprise-demo-shop` | `bob` child process in triage and fix jobs only |
| `BOB_TEAM_ID` | Actions secret (only for general-type keys, F-8) | `--team-id` flag |
| `ANTHROPIC_API_KEY` | Actions secret in `reprise-demo-shop` (and `reprise-smoke` for phase 0) | Engine process only, in triage and fix jobs, for the Claude provider's API client (ADR-12). Never passed into the sandbox, to a `bob` child, to git, or into any prompt; never logged; on the redaction list |
| `GITHUB_TOKEN` | Provided by Actions | Engine's GitHub API calls and pushes, via an askpass helper, never written to `.git/config` |

GitHub masks secret values in logs; the engine additionally never logs prompts that contain secrets and logs Bob's stdout and Claude's responses only after redaction.

Redaction list (exact values, read from the engine's environment when present): `GITHUB_TOKEN`, `BOB_API_KEY`, `BOB_TEAM_ID`, `ANTHROPIC_API_KEY`. Patterns: `ghp_`, `ghs_`, `github_pat_`, `sk-ant-` (Anthropic keys are `sk-ant-api...`, F-20).

## Record of gate results affecting security

| Gate | Result | Consequence |
| --- | --- | --- |
| G-3 (`--trust`) | Deferred until the Bob switch | |
| G-5 (subagents and restrictions) | Deferred until the Bob switch | |
| G-6 (reads outside workspace) | Deferred until the Bob switch | |
| Claude tool confinement (ADR-12) | Unit tests in phase 3a | Absolute paths, `..`, `.git/` and symlink escapes refused |

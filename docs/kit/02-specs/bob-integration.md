# Bob Integration Spec

How the engine calls its reasoning provider: IBM Bob (this spec's original subject) or, under ADR-12, Claude (§ "Claude provider" at the end). Facts referenced as F-n are in `../00-context/verified-facts.md`.

Provider selection: `provider: claude | bob` in `.reprise.yml` (ADR-12). Everything in "Stage table" (read-only versus editing stages and edit scopes), "Prompt assembly", "Parsing the result" steps 3 to 6, and "Replay and record modes" applies to both providers. The Bob-specific parts are the invocation, the tool groups and the `--resume` mechanics.

## Two ways Bob is used

1. **Building Reprise** — the team uses Bob (IDE or Shell, Plan then Agent mode) with the prompts in `../04-build-plan/`.
2. **Running Reprise** — the engine calls Bob Shell non-interactively with `bob run` (F-1) for five reasoning stages. This section specifies that use.

## Invocation

The only code that spawns Bob is `src/provider/bob.ts`, behind the provider interface in `src/provider/index.ts`.

```
<prompt text on stdin> | bob run \
  --format json \
  --accept-license \
  --mode <ask|agent> \
  --workspace <scratch clone path> \
  --max-cost <stage cost cap> \
  --max-turns <stage turn cap> \
  --disable-mcp \
  --disable-subagents \
  --disable-tool-groups <stage disabled groups> \
  --log-level warn \
  [--team-id <BOB_TEAM_ID>] \
  [--resume <task_id>]
```

Environment passed to the child process: `PATH`, `HOME` (a fresh temporary directory, see `security.md`), `BOB_API_KEY`, `LANG`. Nothing else. `--trust` is not passed unless gate G-3 requires it.

Process timeout: 10 minutes per call (kill and treat as error).

## Stage table

| Stage | Prompt file(s) | `--mode` | Disabled tool groups | Edits allowed in | Output schema |
| --- | --- | --- | --- | --- | --- |
| intake | `intake.md` | `ask` | `edit,execute,mcp,skill,todo,subagent,mode` | nothing | `intake` |
| dedupe | `dedupe-confirm.md` | `ask` | `edit,execute,mcp,skill,todo,subagent,mode` | nothing | `dedupe-confirm` |
| repro | `write-repro-test.md`, then `revise-repro-test.md` with `--resume` | `agent` | `execute,mcp,skill,subagent,mode` | `edit_scope.repro` | `repro` |
| rootcause | `root-cause.md` | `ask` | `edit,execute,mcp,skill,todo,subagent,mode` | nothing | `rootcause` |
| fix | `propose-fix.md`, then `revise-fix.md` with `--resume` | `agent` | `execute,mcp,skill,subagent,mode` | `edit_scope.fix` minus `edit_scope.never` | `fix` |

Why these groups: all tools are pre-approved in `bob run` (F-4), so capability is controlled only by disabling groups (F-5). `execute` is disabled everywhere (ADR-4). `mode` is disabled so Bob cannot switch into a mode with different defaults. `subagent` and `mcp` are disabled for predictability and cost; gate G-5 decides whether the read-only root-cause stage may use subagents later.

## Cost and turn caps

Defaults in `.reprise.yml` (`bob.max_cost`, `bob.max_turns`). The cost values in `architecture.md` are placeholders. Phase 3 measures `stats.session_costs` for each stage on the demo issues (gate G-4) and sets each cap to roughly twice the observed maximum, recorded here:

| Stage | Observed max Bobcoins | Cap | Observed max turns | Cap |
| --- | --- | --- | --- | --- |
| intake | (fill in) | | (fill in) | |
| dedupe | | | | |
| repro (per attempt) | | | | |
| rootcause | | | | |
| fix (per iteration) | | | | |

## Prompt assembly

Each prompt file in `prompts/` has front matter declaring its variables. The runner:

1. Loads the file, fills `{{variables}}` (missing variable → error, never an empty string).
2. Wraps untrusted text (issue title, body, attachments, reporter comments) in the block defined in `security.md`.
3. Appends the output contract: the JSON schema for the stage and the sentence "Reply with one JSON object and nothing else."

## Parsing the result

1. Parse stdout as JSON (F-2). If parsing fails → error.
2. `status` must be `"success"`; otherwise the stage fails with the `last_message` text.
3. Extract JSON from `last_message`: the whole string if it parses; otherwise the last fenced block labelled `json`; otherwise error.
4. Validate against the stage schema. On failure, make **one** follow-up call with `--resume <task_id>`: "Your last reply did not match the required JSON schema. Errors: <ajv errors>. Reply with one JSON object only." Second failure → stage error.
5. Record `stats` (`task_id`, `session_costs`, `duration_ms`, `total_tokens`, `input_tokens`, `output_tokens`, `tool_calls`) into `cost.bob_tasks` and add `session_costs` to `cost.by_stage`. (`input_tokens` and `output_tokens` are in F-2 and were added to the record by ADR-12.)
6. Pass every string field through redaction before it is stored or rendered.

If `--resume` does not behave as needed (gate G-14), the runner switches to "stateless revision": a fresh call whose prompt includes the previous JSON answer and the new test results.

## Replay and record modes

- `--bob-record DIR`: after each real call, save `{stage}-{issue}-{attempt}.json` containing the raw stdout and the resulting workspace diff.
- `--bob-replay DIR`: instead of spawning Bob, load the matching file, apply the saved diff to the workspace, and return the saved stdout.

Replay makes the engine's own test suite and CI deterministic and free of Bobcoin spend. Phase 3 records one full pass over the demo issues as fixtures.

## Local mode (fallback for gates G-1 and G-2)

`reprise run --local --issue N --stage triage|fix` runs the same code on a developer machine where Bob Shell is already logged in through the browser (IBMid/SSO, F-8), then `reprise publish` pushes the record and comments using a personal access token from the environment. The workflows then only run deterministic stages (verify, pages).

## Claude provider (ADR-12)

Selected by `provider: claude`. Implemented in `src/provider/claude.ts` with the engine-side tools in `src/provider/tools.ts`. API facts (SDK package name, request and response shapes, `stop_reason` values, `usage` fields, model string) come only from gate G-21 and are recorded in `../00-context/verified-facts.md`; nothing in this section may be implemented before G-21 passes.

### Client and secret

- The official Anthropic TypeScript SDK, Messages API, client-side tool use. No other Anthropic surface (no server tools, no code execution tool, no Files API, no batches).
- The key must be scoped to a single Claude Console workspace, so no `anthropic-workspace-id` header is needed (F-19). The SDK log level stays at its default `warn`; `debug` would log request and response bodies (F-21).
- The SDK's automatic retries (F-21) are left at the default; the stage timeout of 10 minutes per request matches Bob's process timeout.
- The API key comes from `ANTHROPIC_API_KEY` in the engine process environment only. It is never passed to the sandbox, to a `bob` child, to git, or into any prompt; it is on the redaction list (`security.md`).

### Configuration (`.reprise.yml`)

```yaml
provider: claude
claude:
  model: claude-sonnet-5          # confirmed by gate G-21
  max_tokens:     { intake: 4096, dedupe: 2048, repro: 8192, rootcause: 4096, fix: 16000 }   # per request; placeholders, set in phase 3c
  max_tool_turns: { intake: 6, dedupe: 4, repro: 20, rootcause: 12, fix: 30 }
```

- `max_tokens.<stage>` is the per-request output limit sent with every Messages API request in that stage.
- `max_tool_turns.<stage>` mirrors `bob.max_turns`: the maximum number of Messages API requests in one stage call (the first request plus one per round of tool results). A revision call and the schema-repair call each get their own budget, as Bob's `--resume` calls get their own `--max-turns`.
- Spend per stage call is therefore bounded by `max_tool_turns` requests of at most `max_tokens` output each, and overall by the spend limit the owner sets in the Claude Console.

### Tools

The engine implements every tool; they are the only capabilities Claude gets. Paths are relative to the scratch workspace (the same scratch clone Bob would get as `--workspace`).

| Tool | Stages | Input | Result |
| --- | --- | --- | --- |
| `read_file` | all | `path` | File text with 1-based line numbers, truncated at 200 KB with a note |
| `list_files` | all | `path` (default `.`), `recursive` (default false) | Entries, directories marked with a trailing `/`, at most 500 |
| `search_files` | all | `pattern` (JavaScript regular expression), `path` (default `.`) | `file:line: text` matches, at most 200 |
| `write_file` | repro, fix | `path`, `content` | `ok`, or a refusal naming the rule that was broken |

Confinement, checked on every call before touching the file system: reject absolute paths (POSIX and Windows forms), any `..` segment, and paths into `.git/`; resolve the real path and reject it unless it is inside the real path of the workspace, so a symlink cannot escape. A rejected call returns an error tool result; it never throws the stage.

Edit scope for `write_file`: repro stage `edit_scope.repro`; fix stage `edit_scope.fix` minus `edit_scope.never`. A path outside the scope is refused, not written, and the refusal is recorded in `scope_violations` and reported back as the tool result. The post-stage scope guard (`git diff --name-only`, triage-pipeline §5 and fix-and-verify Part A) still runs as a second line of defence.

There is no tool that executes commands, in any stage, ever (ADR-4). The engine runs all tests in the sandbox and sends the results in the revision prompts.

### Stage call

1. Build the prompt exactly as in "Prompt assembly" (same prompt file, variables, untrusted block, appended schema and "Reply with one JSON object and nothing else.").
2. Send it as the first user message with the stage's tools and `max_tokens`, `tool_choice` left at its default (`auto`; F-22). Each assistant response is appended to the history with its full `content` unchanged; tool results go back as one user message whose content is only `tool_result` blocks, in the order of the `tool_use` blocks, with `is_error: true` for refusals and tool errors (F-23). While the response stops for tool use and the turn budget remains: run every tool call in the response and return all tool results in one user message.
3. When the response ends normally, take its text and continue with "Parsing the result" step 3 (JSON extraction), 4 (validation), 5 (stats) and 6 (redaction). The schema-repair retry is one more user message in the same conversation with the same repair text.
4. Stage errors (state `ERROR`, stage named): turn budget exhausted ("tool-turn cap reached in stage X"), output limit reached on a response ("output token limit reached in stage X"), refusal or API error (the SDK's error class and HTTP status, redacted), invalid JSON after the one repair.
5. Revision loops (`revise-repro-test`, `revise-fix`) continue the same message history instead of `--resume`. G-14 does not apply to this provider.

### Stats

One `cost.bob_tasks` entry per stage call: `stage`, `task_id` (the id of the first API response of the call), `session_costs: 0`, `duration_ms`, `input_tokens` and `output_tokens` summed over every request of the call, `total_tokens` = their sum. `cost.by_stage` and `cost.bobcoins_total` stay 0 under Claude.

### Record and replay

`--bob-record` and `--bob-replay` keep their names and file naming for both providers. A Claude fixture holds `provider: "claude"`, every API response of the call in order (content, stop reason, usage) and the resulting workspace diff. Replay returns the recorded responses in order and runs the recorded tool calls through the same confined tool code, so the scope checks are exercised in tests; the final workspace must equal the recorded diff.

### Token table (Claude, measured in phase 3c)

Per stage call, observed on the demo issues. Caps: `max_tokens` about twice the largest single-response output observed; `max_tool_turns` about twice the observed maximum requests.

| Stage | Observed max input tokens | Observed max output tokens | Observed max requests | `max_tokens` cap | `max_tool_turns` cap |
| --- | --- | --- | --- | --- | --- |
| intake | (fill in) | | | | |
| dedupe | | | | | |
| repro (per attempt) | | | | | |
| rootcause | | | | | |
| fix (per iteration) | | | | | |

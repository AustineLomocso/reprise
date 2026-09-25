# Verified Facts

Every fact the design depends on, with its source. Checked on 25 September 2026. If a fact is not in this file or in `verification-gates.md`, it is not known and must not be used.

## IBM Bob

| ID | Fact | Source |
| --- | --- | --- |
| F-1 | `bob run [options] [prompt...]` runs Bob Shell non-interactively. A prompt can also be piped through stdin (`cat prompt.txt \| bob run`). Files can be referenced with `@path`. | https://bob.ibm.com/docs/shell/getting-started/start-bobshell-non-interactive |
| F-2 | `--format json` emits one object after completion: `type` (`"result"`), `timestamp`, `status` (`"success"` or `"error"`), `stats` (`task_id`, `total_tokens`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `cache_ratio`, `duration_ms`, `session_costs`, `tool_calls`), `last_message`. `--format stream-json` emits NDJSON events `message`, `tool_use`, `tool_result`, `error` (cost/turn limit reached), `result`. | same |
| F-3 | `bob run` options: `--format`, `--mode <mode>` (for example `agent`, `plan`, `ask`), `--max-cost <bobcoins>`, `--max-turns <n>`, `--disable-mcp`, `--disable-subagents`, `--disable-tool-groups <groups>`, `--workspace <path>`, `--log-level`, `--resume <task-id>` / `--resume latest`, `--team-id <id>`, `--trust`, `--accept-license`. | same |
| F-4 | In `bob run`, all tools are pre-approved; there are no approval prompts. | same |
| F-5 | Tool groups: `read`, `edit`, `execute`, `mcp`, `skill`, `todo`, `subagent`, `mode`. Defaults: Agent mode has all eight; Plan mode lacks `execute` and `subagent`; Ask mode lacks `execute`, `todo`, `subagent`. Groups can be disabled with `--disable-tool-groups`. | https://bob.ibm.com/docs/shell/core-concepts/tools |
| F-6 | Tools by group: read = `read_file`, `search_files`, `list_files`, `list_code_definition_names`; edit = `write_to_file`, `apply_diff`, `insert_content`; execute = `execute_command`; mcp = `use_mcp_tool`; mode = `switch_mode`; question = `ask_followup_question`. | same |
| F-7 | Install on Linux: `curl -fsSL https://bob.ibm.com/download/bobshell.sh \| bash`. Requires Node.js 24 or later, at least 4 GB RAM (8 GB recommended), 500 MB disk, internet. | https://bob.ibm.com/docs/shell/getting-started/install-and-setup |
| F-8 | Non-interactive authentication uses an API key created in the Bob web portal with Scope set to Inference, exported as `BOB_API_KEY`. A key of type "general" also needs `--team-id`. | same |
| F-9 | Bob Shell 2.0.0 (August 2026) added JSON `stats` to `bob run`, skills, and replaced Code/Advanced modes with Agent mode. Latest listed release is 2.0.4 (September 2026). 2.0 requires a fresh install from 1.0.x. | https://bob.ibm.com/docs/shell/changelog |
| F-10 | Bob Shell 2.0.3 disables git fsmonitor in untrusted folders. 2.0.1 made writes to Bob settings files and to `~/.bob/` always require explicit approval. | same |
| F-11 | Bob's context window is 270,000 tokens. | Link text on https://bob.ibm.com/docs/shell/core-concepts/tools (page "Context window management") |
| F-12 | Bob 2.0 (released 24 June 2026) added multi-agent functionality, Bobalytics usage and cost monitoring, parallel tool calling, and subagents with isolated context. Bob Shell moved to the V2 agent and harness in the August 2026 release. | https://uk.newsroom.ibm.com/IBM-Bob ; https://bob.ibm.com/blog/august-2026-release/ |

## GitHub

| ID | Fact | Source |
| --- | --- | --- |
| F-13 | GitHub Actions usage is free for standard GitHub-hosted runners in public repositories. | https://docs.github.com/en/actions/reference/usage-limits-billing-and-administration |
| F-14 | Actions limits: a job can run up to 6 hours; GitHub Free allows 20 concurrent standard jobs; up to 1,000 GitHub API requests per hour across all actions in a repository. | same |
| F-15 | GitHub Pages is available for public repositories on GitHub Free. Limits: published site at most 1 GB, soft bandwidth limit 100 GB/month, deployments time out after 10 minutes, soft limit of 10 builds per hour that does not apply when publishing with a custom GitHub Actions workflow. Pages is not intended for commercial SaaS or e-commerce sites. | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits |

## Hackathon

| ID | Fact | Source |
| --- | --- | --- |
| F-16 | Online hackathon, 48-hour build, 25–27 September 2026, teams or solo. | https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon |
| F-17 | Judging criteria and submission fields are as listed in `hackathon-submission.md`. | Team sheet "Hackathon Details" |

## Research figures used in the pitch

| ID | Fact | Source |
| --- | --- | --- |
| F-18 | Non-reproducible bug figures (see `project-brief.md`). | Rahman et al., EMSE 2022, via the team research brief |

## Claude API (ADR-12, gate G-21; checked 25 September 2026)

| ID | Fact | Source |
| --- | --- | --- |
| F-19 | The Claude API is at `https://api.anthropic.com`; the Messages API is `POST /v1/messages`. Requests carry `Authorization: Bearer <key>` (or legacy `x-api-key`), `anthropic-version` (for example `2023-06-01`) and `content-type: application/json`; the SDKs send these automatically. A key that is not scoped to a single workspace also requires the `anthropic-workspace-id` header on every request. | https://platform.claude.com/docs/en/api/overview ; https://platform.claude.com/docs/en/manage-claude/authentication |
| F-20 | API keys are static `sk-ant-api...` secrets created in the Claude Console (Settings → API keys), with a chosen type (personal, service account) and expiration. The SDKs read `ANTHROPIC_API_KEY` from the environment. An expired key returns `401 authentication_error`. Spend limits are shown on the Console Billing page; workspaces can be used to control spend by use case. | https://platform.claude.com/docs/en/manage-claude/authentication ; https://platform.claude.com/docs/en/api/overview |
| F-21 | Official TypeScript SDK: npm package `@anthropic-ai/sdk` (MIT, repository `anthropics/anthropic-sdk-typescript`, latest 0.128.0 on 25 Sep 2026), install `npm install @anthropic-ai/sdk`, supports Node.js 20 LTS or later and TypeScript >= 5.0. `new Anthropic()` reads `ANTHROPIC_API_KEY`; `client.messages.create({ model, max_tokens, messages, system?, tools? })`. Errors are subclasses of `Anthropic.APIError` (`BadRequestError` 400, `AuthenticationError` 401, `PermissionDeniedError` 403, `NotFoundError` 404, `ConflictError` 409, `UnprocessableEntityError` 422, `RateLimitError` 429, `InternalServerError` >=500, `APIConnectionError`, `APIConnectionTimeoutError`). Default timeout 10 minutes, 2 automatic retries (connection errors, 408, 409, 429, >=500), configurable with `maxRetries`/`timeout`. The SDK logs at `warn` by default; `debug` logs request and response bodies. | https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript ; `npm view @anthropic-ai/sdk` |
| F-22 | Client tools are declared in `tools` with `name` (regex `^[a-zA-Z0-9_-]{1,128}$`), `description`, `input_schema` (JSON Schema), optional `input_examples`, `strict`, `cache_control`. `tool_choice` options: `auto` (default with tools), `any`, `tool`, `none`; `any`/`tool` return 400 on Claude Opus 5.5, Fable 5.1 and Mythos 5.1. | https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools |
| F-23 | A response that calls client tools has `stop_reason: "tool_use"` and `tool_use` content blocks `{ type, id, name, input }`. The client replies with a `user` message whose content starts with `tool_result` blocks `{ type: "tool_result", tool_use_id, content?, is_error? }` (content a string or text/image/document blocks); tool results must immediately follow the tool-use message and come first in the content array. Tool errors are reported with `is_error: true`. | https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls |
| F-24 | `stop_reason` values: `end_turn`, `max_tokens`, `stop_sequence`, `tool_use`, `pause_turn` (server-tool loop limit), `refusal`, `model_context_window_exceeded`. `stop_details` is non-null only for `refusal`. | https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons |
| F-25 | Response fields include `id`, `stop_reason`, `content`, and `usage` with `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`. | https://platform.claude.com/docs/en/api/messages/create ; TypeScript SDK page "Counting tokens" |
| F-26 | Claude Sonnet 5: Claude API ID and alias `claude-sonnet-5`, adaptive thinking, default effort `high`, 1M context, 128K max output, $2 / $10 per million input / output tokens, retirement not sooner than 30 June 2027. Claude Opus 5.5: `claude-opus-5-5`, adaptive thinking always on, default effort `medium`. Claude Haiku 4.5: API ID `claude-haiku-4-5-20251001`, alias `claude-haiku-4-5`, 200K context, 64K max output. Every model ID is a pinned snapshot. | https://platform.claude.com/docs/en/about-claude/models/overview |

## GitHub (phase 0)

| ID | Fact | Source |
| --- | --- | --- |
| F-27 | Latest releases on 25 Sep 2026: `actions/checkout` v7.0.1, `actions/setup-node` v7.0.0, `actions/configure-pages` v6.0.0, `actions/upload-pages-artifact` v5.0.0, `actions/deploy-pages` v5.0.1. | GitHub releases API for each repository |
| F-28 | The official `actions/checkout` README configures bot commits with `git config user.name "github-actions[bot]"` and `git config user.email "41898282+github-actions[bot]@users.noreply.github.com"`. docs.github.com has no page stating these values. | https://github.com/actions/checkout (README) |
| F-29 | IBM Plex is licensed under SIL Open Font License 1.1 (`LICENSE.txt`, SPDX `OFL-1.1`). | https://github.com/IBM/plex/blob/master/LICENSE.txt |
| F-30 | `actions/checkout` inputs: `repository` ("Repository name with owner", default `${{ github.repository }}`) and `ref` ("The branch, tag or SHA to checkout"; defaults to the default branch for another repository). The README's "Checkout multiple repos" examples check out another repository with `repository:` and `path:`; a `token` is needed only when the secondary repository is private or internal. | https://github.com/actions/checkout (README, v7.0.1) |
| F-31 | REST "Get a GitHub Pages site" (`GET /repos/{owner}/{repo}/pages`) returns `build_type` (`legacy`, `workflow` or null), `html_url`, `status`, `source`, `public`; it answers 404 when the site does not exist. "Create a GitHub Pages site" takes `build_type` `legacy` or `workflow`. | https://docs.github.com/en/rest/pages/pages |
| F-32 | `actions/setup-node@v7` with `node-version: 24` installs Node `v24.21.0` on `ubuntu-latest` (25 Sep 2026). | https://github.com/AustineLomocso/reprise/actions/runs/36092737464 |
| F-33 | `actions/upload-pages-artifact@v5.0.0` inputs: `name` (default `github-pages`), `path` (required), `retention-days` (default `"1"`), `include-hidden-files` (default `"false"`). `actions/configure-pages@v6.0.0` enables Pages itself only when `enablement: true` and a token other than `GITHUB_TOKEN` is given; by default it expects Pages to be enabled already. `actions/deploy-pages@v5.0.1` runs on `node24`, deploys the artifact named `github-pages` and outputs `page_url`. | `action.yml` of each action at those tags (GitHub contents API) |

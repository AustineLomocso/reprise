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

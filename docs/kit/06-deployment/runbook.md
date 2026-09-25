# Operations Runbook

## Reset the demo

```
scripts/reset-demo.sh          # closes issues and PRs, deletes reprise/ and demo/ branches, resets reprise-data
gh workflow run reprise-pages  # dashboard shows the empty state
scripts/seed-demo.sh stage1    # wait for three verdicts
scripts/seed-demo.sh stage2    # wait for the duplicate verdict
scripts/prepare-bad-fix.sh
```

Closed issues from earlier runs stay in GitHub's history; the dashboard only shows records on `reprise-data`, which the reset clears.

## Re-run a stage

- Triage: comment `/reprise triage` on the issue.
- Fix: comment `/reprise fix`.
- Verification: comment `/reprise verify` on the PR, or push a commit.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| No workflow run after opening an issue | Author not trusted, or the job `if` filtered it | Add the `reprise` label as a maintainer |
| `reprise:error` with "cost cap reached" | Stage cap too low for this report | Raise that stage's cap in `.reprise.yml` within the allocation, then `/reprise triage` |
| `reprise:error` mentioning authentication | `BOB_API_KEY` missing, expired, or general-type without `BOB_TEAM_ID`; or `ANTHROPIC_API_KEY` missing or revoked (Claude provider) | Update the secrets (F-8) |
| `reprise:error` with "tool-turn cap reached" or "output token limit reached" | Claude stage caps too low for this report | Raise `claude.max_tool_turns` or `claude.max_tokens` for that stage in `.reprise.yml`, then `/reprise triage` |
| `BLOCKED_ENV` | Dockerfile or config missing or broken | Read the comment's build output; fix; `/reprise triage` |
| Fix PR opened but no verification comment | Inline verification failed | Check the fix run log; `/reprise verify` on the PR |
| Dashboard not updated | Pages job skipped or failed | Run `reprise-pages` manually; check gate G-11 result |
| Two verification comments | Both inline and `pull_request` runs verified the same SHA | Apply the G-12 skip rule from phase 5 |

## Rotate the Bob key

Create a new key in the Bob portal, update the `BOB_API_KEY` secret, revoke the old key, run a smoke triage.

## Rotate the Anthropic key

Create a new key in the Claude Console, update the `ANTHROPIC_API_KEY` secret, revoke the old key, run a smoke triage. The Console spend limit stays in force.

## Pause Reprise

Disable the `reprise-triage` and `reprise-fix` workflows. Verification and the dashboard need no reasoning provider and can stay on.

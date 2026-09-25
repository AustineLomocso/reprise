# GitHub Integration Spec

Action versions below are the newest major versions on 25 Sep 2026 (gate G-18 fallback applied with the owner's go-ahead; F-27). Release notes for every major since the original kit versions were read: nothing affects the inputs used here.

## Composite action — `reprise/action.yml`

Inputs:

| Input | Required | Purpose |
| --- | --- | --- |
| `command` | yes | `triage`, `fix`, `verify` (also handles merged PRs), `build-site` |
| `github-token` | for all but `build-site` | Passed to the engine only (never to the model) |
| `bob-api-key` | for `triage` and `fix` when `provider: bob` | Exported as `BOB_API_KEY` for the `bob` child process only |
| `anthropic-api-key` | for `triage` and `fix` when `provider: claude` (ADR-12) | Exported as `ANTHROPIC_API_KEY` into the engine step's environment only, for the Claude API client; never into the sandbox or a child process |
| `bob-team-id` | no | Passed as `--team-id` when set (general-type keys, F-8) |
| `site-data` / `site-out` | for `build-site` | Paths |

Outputs: `published` (`"true"` when a record was written).

Steps: `actions/setup-node@v7` with `node-version: 24` (gate G-8), always; `node $GITHUB_ACTION_PATH/dist/reprise.mjs provider` to read `provider` from `.reprise.yml` (step output); install Bob Shell with the official script (F-7) **only** when `command` is `triage` or `fix` **and** the provider is `bob`, then log `bob --version`; `node $GITHUB_ACTION_PATH/dist/reprise.mjs <command>`.

## Workflows in `reprise-demo-shop/.github/workflows/`

### `reprise-triage.yml`

```yaml
name: reprise-triage
on:
  issues:
    types: [opened, labeled]
  issue_comment:
    types: [created]
permissions:
  contents: write
  issues: write
jobs:
  triage:
    if: ${{ !github.event.issue.pull_request && (github.event_name != 'issue_comment' || startsWith(github.event.comment.body, '/reprise triage') || github.event.comment.user.login == github.event.issue.user.login) }}
    runs-on: ubuntu-latest
    timeout-minutes: 45
    concurrency:
      group: reprise-issue-${{ github.event.issue.number }}
      cancel-in-progress: false
    outputs:
      published: ${{ steps.reprise.outputs.published }}
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
          persist-credentials: false
      - id: reprise
        uses: OWNER/reprise@v1
        with:
          command: triage
          github-token: ${{ secrets.GITHUB_TOKEN }}
          bob-api-key: ${{ secrets.BOB_API_KEY }}
          bob-team-id: ${{ secrets.BOB_TEAM_ID }}
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
  pages:
    needs: triage
    if: ${{ needs.triage.outputs.published == 'true' }}
    permissions:
      contents: read
      pages: write
      id-token: write
    uses: ./.github/workflows/reprise-pages.yml
```

### `reprise-fix.yml`

Same shape (including the three provider secrets); trigger `issue_comment: created`; job `if`: not a PR and body starts with `/reprise fix`; `command: fix`; permissions `contents: write`, `issues: write`, `pull-requests: write`, `statuses: write`; `timeout-minutes: 60`; concurrency group `reprise-issue-<N>`.

### `reprise-verify.yml`

Triggers: `pull_request` types `[opened, synchronize, reopened, closed]` and `issue_comment: created` (job `if`: on a PR and body starts with `/reprise verify`). `command: verify` (the engine handles `closed` as resolution). Permissions `contents: write` (the job writes the issue record to `reprise-data`, `fix-and-verify.md` Parts B and C; PR code runs only in the no-network sandbox with no token), `issues: write`, `pull-requests: write`, `statuses: write`. No provider secret is passed (ADR-8). A `pages` job calls `reprise-pages.yml` exactly as in the triage workflow, with `pages: write` and `id-token: write`. Concurrency group `reprise-pr-<PR number>`, `cancel-in-progress: true`. For fork PRs the job exits early with a log message (out of scope, gate G-12).

### `reprise-pages.yml` (reusable)

```yaml
name: reprise-pages
on:
  workflow_call:
  workflow_dispatch:
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
        with:
          ref: reprise-data
          path: data
          persist-credentials: false
      - uses: OWNER/reprise@v1
        with:
          command: build-site
          site-data: data
          site-out: _site
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: _site
  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    concurrency:
      group: pages
      cancel-in-progress: true
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

## Trust

Trusted actor: `author_association` in `OWNER`, `MEMBER`, `COLLABORATOR` (from the comment or issue payload; for `labeled` events fetch the labeler's permission with the collaborators API and require `write` or higher). Checked by the engine before any Bob call.

## Commands

| Command | Where | Who | Effect |
| --- | --- | --- | --- |
| `/reprise triage` | issue | trusted | Re-run triage (resets verdict, keeps history) |
| `/reprise fix` | issue | trusted | Part A of `fix-and-verify.md` |
| `/reprise verify` | pull request | trusted | Part B on the current head |

Unrecognised `/reprise` commands get one reply listing the three commands.

## Labels (created by `scripts/create-labels.sh`)

| Label | Colour | Meaning |
| --- | --- | --- |
| `reprise` | `5319e7` | Maintainer opt-in trigger |
| `reprise:triaging` | `c5def5` | Work in progress |
| `reprise:confirmed` | `b60205` | Reproduced every time |
| `reprise:flaky` | `d4a72c` | Reproduced some of the time |
| `reprise:duplicate` | `cfd3d7` | Same bug as another issue |
| `reprise:needs-info` | `fbca04` | One question for the reporter |
| `reprise:blocked-env` | `5a5a5a` | Sandbox could not be built |
| `reprise:error` | `000000` | Reprise failed; retry with `/reprise triage` |
| `reprise:fix-proposed` | `1d76db` | Fix PR in progress. Added to the issue when the fix draft PR opens; removed when a verification label is set |
| `reprise:fix-verified` | `0e8a16` | Fix passed verification |
| `reprise:fix-incomplete` | `e99695` | Bug still reproduces on the fix |
| `reprise:regression` | `8b0000` | Fix breaks other tests |

## Comment templates

All comments are rendered by `src/render/` from these templates, then redacted. Placeholders use `{{name}}`. Each comment starts with its marker so it is updated in place rather than duplicated.

### Issue status — CONFIRMED

~~~markdown
<!-- reprise:status -->
### Reprise: reproduced every time

The reproduction test failed in **{{failed}} of {{trials}}** runs, each time for the reported reason.

{{trial_strip}}

**Likely cause** ({{confidence}} confidence): {{root_cause_summary}}
{{#locations}}- `{{file}}` lines {{start_line}}–{{end_line}}: {{reason}}
{{/locations}}
**Introduced in:** {{bisect_line}}

**Run it yourself**
```
git fetch origin reprise/repro-{{issue}} && git checkout origin/reprise/repro-{{issue}} -- {{test_file}}
{{single_test_command}}
```

<details><summary>Fix it with Bob IDE</summary>

```
{{ide_prompt}}
```
</details>

Comment `/reprise fix` and Reprise will propose a fix as a pull request and verify it.

<sub>Time to verdict {{duration}} · {{cost_line}} · [Dashboard]({{dashboard_url}})</sub>
~~~

### Issue status — FLAKY

Same as CONFIRMED with heading "Reprise: reproduced some of the time", first line "The reproduction test failed in **{{failed}} of {{trials}}** runs ({{rate}}, likely between {{wilson_low}} and {{wilson_high}})." and the bisect line "Skipped: bisect is unreliable for intermittent failures."

### Issue status — DUPLICATE

```markdown
<!-- reprise:status -->
### Reprise: this looks like #{{of}}

Match score {{score}} (component {{s_component}}, functions {{s_functions}}, symptom {{s_symptom}}, trigger {{s_trigger}}, error {{s_error}}).
{{reason}}
{{behaviour_line}}

If this is a different problem, comment `/reprise triage` with what differs.
```

### Issue status — NEEDS_INFO

```markdown
<!-- reprise:status -->
### Reprise: one question before this can be reproduced

@{{reporter}} {{question}}

What was tried: {{tried_summary}}
{{bound_line}}

Reply here and Reprise will try again automatically.
```

`bound_line` appears only when trials ran with zero failures: "The test never failed in {{n}} runs, so if this bug exists here it happens in fewer than about {{bound}} of runs."

### Issue status — BLOCKED_ENV

```markdown
<!-- reprise:status -->
### Reprise: the test environment could not be built

{{missing_or_error}}

Once this is fixed, comment `/reprise triage`.
```

### Pull request — verification

```markdown
<!-- reprise:verify -->
### Reprise verification: {{verdict_heading}}

**Reproduction test** ({{test_file}}{{injected_note}}): {{runs}} runs, {{failed}} failures.
{{claim}}

**Test suite** base `{{base_short}}` vs this PR `{{head_short}}`: {{tests_total}} tests.
| Result | Count |
| --- | --- |
| Still passing | {{UNCHANGED_PASS}} |
| Now passing | {{NEWLY_PASSING}} |
| Already failing before this PR | {{PRE_EXISTING_FAILURE}} |
| Already flaky before this PR | {{PRE_EXISTING_FLAKY}} |
| New and passing | {{ADDED_PASSING}} |
| **New and failing** | {{ADDED_FAILING}} |
| **Removed** | {{REMOVED}} |
| **Broken by this PR** | {{REGRESSION}} |

{{#blocking}}- `{{id}}` {{class}}: base {{base}}, this PR {{head}}. {{message}}
{{/blocking}}
<sub>Verified at `{{head_short}}` · {{duration}} · [Issue #{{issue}}]({{issue_url}})</sub>
```

Headings: `FIX_VERIFIED` → "the bug is fixed and nothing else broke"; `FIX_INCOMPLETE` → "the bug still reproduces"; `REGRESSION_DETECTED` → "this change breaks other tests".

`cost_line` (ADR-12) is "Tokens {{tokens}}" (input plus output, thousands separated) when the record's `provider` is `claude`, and "Bobcoins {{bobcoins}}" when it is `bob`. Never currency.

The trial strip is one line inside a code span: `F` for a reproduction, `.` for a pass, `x` for an invalid run, in run order (for example `F.F..FF.x...`).

### Bob IDE prompt template (`ide_prompt`)

```
Fix GitHub issue #{{issue}} in this repository.
Reproduction test: {{test_file}} (get it with: git checkout origin/reprise/repro-{{issue}} -- {{test_file}}).
Run it with: {{single_test_command}}. It currently fails with: {{failure_message}}
Likely cause: {{root_cause_summary}}
Locations: {{locations_inline}}
{{bisect_sentence}}
Rules: do not modify {{test_file}}; keep the change minimal; run the full suite with {{all_tests_command}} before finishing; open a PR whose description contains "Fixes #{{issue}}".
```

# Phase 4 — Triage on GitHub

**Goal:** Opening an issue in `reprise-demo-shop` runs triage in GitHub Actions and posts the verdict comment and labels; records land on `reprise-data`.
**Repositories:** `reprise` (action, github and store modules) and `reprise-demo-shop` (workflows).
**Mode:** Plan, then Agent.
**Attach:** `@docs/kit/02-specs/github-integration.md`, `@docs/kit/02-specs/triage-pipeline.md` (§0, §1, §9 and failure handling), `@docs/kit/02-specs/data-contracts.md`, `@docs/kit/02-specs/security.md`.

## Prompt

```
Connect the triage pipeline to GitHub as specified.

In reprise:
1. action.yml: the composite action in github-integration.md. Install Bob Shell only for triage and fix. Pass github-token to the engine via an env var the engine reads, and the Bob key only into the engine process env for the bob runner to forward to the bob child.
2. src/github: parse the event from GITHUB_EVENT_PATH; trust check (author_association, and collaborator permission for labeled events); trigger rules from triage-pipeline.md §0; status comment create-or-update by marker; label add/remove; download text attachments linked in the issue body (cap 3 files, 200 KB each); push branch reprise/repro-N using an askpass helper so the token is never written to disk config.
3. src/store: read and write issues/N.json on the reprise-data branch in a separate worktree, schema-validate before write, append events, retry up to 5 times on non-fast-forward with refetch. If the branch does not exist, create it as an orphan with a README.
4. src/render: every template in github-integration.md; all output passed through redact and scanForSecrets before posting (abort the post if a secret is found).
5. Wire `reprise triage` (no flags) to read the event, run the pipeline, publish, set the action output published=true when a record was written.
6. Error handling per triage-pipeline.md: any failure sets ERROR, posts the error comment, keeps partial evidence.

In reprise-demo-shop:
7. Add .github/workflows/reprise-triage.yml and a placeholder reprise-pages.yml (workflow_call + workflow_dispatch that only echoes) exactly as in github-integration.md, pointing at OWNER/reprise@main for now.
```

## Manual steps

- Add `BOB_API_KEY` (and `BOB_TEAM_ID` if needed) as Actions secrets in `reprise-demo-shop`.
- Run `scripts/create-labels.sh`.
- Resolve gate G-16 with an issue that has an attached `.log` file; G-17 with a test commit.

## Acceptance

- Opening BULK, RACE, VAGUE through `scripts/seed-demo.sh stage1` yields the expected verdict comments and labels within one workflow run each.
- `scripts/seed-demo.sh stage2` yields `DUPLICATE` of BULK.
- A reply from the VAGUE reporter account on the needs-info issue triggers re-triage; a fourth reply does not (cap 3).
- An issue opened by a non-collaborator account does nothing until a maintainer adds the `reprise` label.
- `reprise-data` contains one JSON file per issue, each valid against the schema.

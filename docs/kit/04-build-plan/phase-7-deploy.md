# Phase 7 — Deploy

**Goal:** Everything live at zero cost: release tag, workflows pointing at it, Pages serving the dashboard.
**Repositories:** both.
**Mode:** Agent for file changes; the rest is manual, following `06-deployment/deployment.md`.
**Attach:** `@docs/kit/06-deployment/deployment.md`, `@docs/kit/06-deployment/cost-ledger.md`, `@docs/kit/02-specs/github-integration.md`.

## Prompt

```
Prepare the release and deployment as described in deployment.md.
1. In reprise: add a release workflow that, on a pushed tag v*, runs typecheck, tests and build, and fails if dist/reprise.mjs differs from the committed file. Add a RELEASING.md with the manual tag steps.
2. In reprise-demo-shop: replace the placeholder reprise-pages.yml with the full reusable workflow from github-integration.md; change every `uses: OWNER/reprise@main` to `@v1`; add a README section "How Reprise is wired here" with the dashboard URL placeholder.
3. Check every workflow for: permissions blocks present and minimal, persist-credentials false on checkouts, concurrency groups as specified, no pull_request_target anywhere.
Report any deviation you find rather than silently changing the spec.
```

## Manual steps

Follow `06-deployment/deployment.md` sections 1–6 in order and tick them there.

## Acceptance

- The dashboard URL loads the overview with current records.
- A new triage on a demo issue updates the dashboard within one workflow run (gate G-11 result recorded).
- `06-deployment/cost-ledger.md` "Verified" column is ticked for every row.

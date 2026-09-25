# Deployment (zero cost)

Everything runs on GitHub's free tier for public repositories plus the reasoning provider: the hackathon's Bob allocation, or, under ADR-12, the owner's Claude API account (billed, capped by a Console spend limit). See `cost-ledger.md` for the basis of every "free" claim. Replace `OWNER` with the GitHub account or organisation that owns both repositories.

## 1. Repositories

- [ ] `OWNER/reprise` and `OWNER/reprise-demo-shop` exist and are **public** (F-13 and F-15 apply only to public repositories on GitHub Free).
- [ ] Both have the default branch `main`.

## 2. Engine release

- [ ] In `reprise`: `npm ci && npm run typecheck && npm test && npm run build`.
- [ ] Commit `dist/reprise.mjs`; tag and push: `git tag v1.0.0 && git tag -f v1 && git push origin v1.0.0 && git push -f origin v1`.
- [ ] Release workflow green on the tag.

## 3. Demo repository settings

- [ ] **Secrets** (Settings → Secrets and variables → Actions): `ANTHROPIC_API_KEY` while `provider: claude`; `BOB_API_KEY` for `provider: bob`, plus `BOB_TEAM_ID` only if the key type is general (F-8).
- [ ] **Actions permissions** (Settings → Actions → General): allow actions from `OWNER/reprise` and the official `actions/*` actions used in the workflows; under Workflow permissions, enable "Allow GitHub Actions to create and approve pull requests" so `/reprise fix` can open PRs. Confirm the exact wording of this setting on the page when doing it.
- [ ] **Pages** (Settings → Pages): Source = GitHub Actions.
- [ ] **Labels**: `scripts/create-labels.sh`.
- [ ] **Data branch**:
  ```
  git switch --orphan reprise-data
  git rm -rf . 2>/dev/null || true
  printf '# Reprise data\nIssue records written by Reprise. Do not edit by hand.\n' > README.md
  git add README.md && git commit -m "chore: initialise reprise-data" && git push -u origin reprise-data
  git switch main
  ```

## 4. First deploy

- [ ] Run `reprise-pages` manually (Actions → reprise-pages → Run workflow). The dashboard shows the empty state.
- [ ] Record the URL `https://OWNER.github.io/reprise-demo-shop/` in the demo README and in `07-submission/submission-content.md`.

## 5. Smoke test on live

- [ ] `scripts/seed-demo.sh stage1`. Three triage runs start, finish, comment, and the pages job deploys after each.
- [ ] Dashboard lists three reports.

## 6. Demo run

Follow phase 8's end-to-end steps. Afterwards, leave the repository in its final demo state for judges (do not reset after submitting).

## Rollback

- Engine bug: move the `v1` tag back to the previous good commit (`git tag -f v1 <sha> && git push -f origin v1`).
- Dashboard bug: re-run the previous successful `reprise-pages` run, or fix and redeploy.
- Stop all spending immediately: disable `reprise-triage` and `reprise-fix` workflows (Actions → workflow → Disable). The dashboard keeps serving the last deploy.

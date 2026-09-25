# Reprise

Reprise is a bug-lifecycle agent for GitHub. When a bug report arrives it checks for duplicates, rebuilds the environment in a sandbox, writes a reproduction test and runs it many times to decide whether the bug is reproduced, intermittent (with a measured rate), a duplicate, or needs one answer from the reporter. It then helps fix the bug and verifies every fix, from Reprise or from a person, with a statistical claim and a full regression comparison. Results appear on the issue, on the pull request, and on a public dashboard on GitHub Pages.

The full design is the build kit in [`docs/kit/`](docs/kit/README.md). Progress is logged in [`docs/kit/PROGRESS.md`](docs/kit/PROGRESS.md).

## What this build contains (web-only slice)

This is the first, web-only slice. It contains the engine scaffold, the statistics module, the data contracts, and the dashboard. It makes no model or network calls.

| Part | State |
| --- | --- |
| `reprise build-site` and the dashboard (`dashboard/`) | Built |
| Statistics (`src/stats/`), JSON Schemas (`schemas/`), config loader (`src/config/`) | Built and tested |
| `reprise triage`, `fix`, `verify`, `run --local`, `publish`, `provider` | Stubs: print "Not implemented in the web-only build: <command>" and exit 2 |
| Reasoning provider (`src/provider/`) | Interface and stage table only |

The live dashboard runs on generated sample records and says so on every page (ADR-13).

## Commands

Node 24 or later.

```
npm ci
npm run typecheck
npm test
npm run build            # dist/reprise.mjs (committed; CI checks it matches a fresh build)
npm run sample           # regenerate test/fixtures/sample-records/ from src/stats
npm run preview          # build the sample site and serve it at http://localhost:4173/
node dist/reprise.mjs --help
node dist/reprise.mjs build-site --data DIR --out DIR [--data-source sample|live]
```

`DIR` for `--data` holds `issues/<N>.json` records (the layout of the `reprise-data` branch). The build fails if any record does not match `schemas/issue-record.schema.json`.

## Licences

Fonts in `dashboard/fonts/` are IBM Plex, under the SIL Open Font License 1.1 (`dashboard/fonts/LICENSE.txt`).

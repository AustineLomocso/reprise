# Cost Ledger

Every component Reprise uses in production, what it costs, and why. Nothing may be added that is not in this table. The Claude API row was added by ADR-12 and is the only paid item. Tick "Verified" during phase 7 after checking the account's own billing page.

| Component | Cost | Basis | Condition to keep it free | Verified |
| --- | --- | --- | --- | --- |
| GitHub repositories | 0 | GitHub Free, public repositories | Stay public | [ ] |
| GitHub Actions minutes | 0 | F-13: free for standard GitHub-hosted runners in public repositories | Use `ubuntu-latest` only; never larger runners | [ ] |
| GitHub Actions artifacts (Pages upload) | 0 expected | F-13 covers usage in public repositories; confirm on the billing page that no storage charge appears | Keep the Pages artifact small; set `retention-days: 1` where the upload action allows it | [ ] |
| GitHub Pages hosting | 0 | F-15: available for public repositories on GitHub Free | Stay under 1 GB site and 100 GB/month bandwidth; non-commercial demo use | [ ] |
| Custom domain | Not used | `OWNER.github.io` subdomain | — | [ ] |
| Docker base image `node:24-slim` | 0 | Public image pulled by the runner | If pulls are rate-limited, cache with `docker save` in the job | [ ] |
| npm packages (yaml, ajv, ajv-formats, fast-xml-parser, @octokit/rest, minimatch, @anthropic-ai/sdk (package name confirmed by G-21), typescript, esbuild, @types/node) | 0 | Open-source licences; bundled at build time | No paid packages | [ ] |
| Fonts (IBM Plex Sans, IBM Plex Mono) | 0 | Open licence (gate G-15) | Self-hosted, licence file included | [ ] |
| IBM Bob usage (Bobcoins) | Hackathon allocation | Gate G-1 (deferred until the Bob switch) | Per-stage `--max-cost` caps; trusted-actor triggers only; replay mode for engine CI | [ ] |
| Claude API usage (ADR-12) | Billed, not zero-cost; bounded by per-stage token caps and a spend limit set by the owner in the Claude Console | Owner's Anthropic account; recorded in tokens per issue, never converted to currency | Per-request `claude.max_tokens` and per-stage `claude.max_tool_turns`; trusted-actor triggers only; replay mode for engine CI and tests | [ ] |
| Monitoring and analytics | Not used | — | — | [ ] |

IBM Bob usage is consumption of the hackathon allocation, not a hosting cost; it is still capped and shown per issue on the dashboard. Claude API usage is real spend on the owner's account; it is capped the same way and shown per issue in tokens.

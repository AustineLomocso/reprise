# Phase 0 — Verify gates

**Goal:** Resolve every gate in `00-context/verification-gates.md` that blocks building, before writing product code.
**Repository:** a scratch public repo `reprise-smoke` (delete after the hackathon) plus the Bob web portal.
**Mode:** Plan, then Agent.
**Attach:** `@00-context/verification-gates.md`, `@00-context/verified-facts.md`, `@02-specs/bob-integration.md`.

## Provider amendment (ADR-12)

While the provider is `claude`, phase 0 runs only the gates the Claude provider needs: G-8, G-9, G-10, G-15, G-17, G-18, G-21 (plus G-13 from the owner). The Bob gates G-1 to G-7, G-14, G-19 and G-20 are deferred until the Bob switch and the Bob steps in the prompt below are skipped until then. G-11, G-12 and G-16 are resolved in phases 7, 5 and 4.

Claude smoke job in `smoke.yml`: a small Node script using the official Anthropic TypeScript SDK (package confirmed by G-21) makes one read-only Messages API call with one engine-implemented, workspace-confined `read_file` tool, asks Claude to read a fixture file and answer with a JSON object containing a value from it, validates the answer, and prints PASS if valid JSON with the expected value comes back. It prints the token usage and never prints the key. `ANTHROPIC_API_KEY` is passed via `env` to that one step only.

Manual step for the owner before the smoke run: create an Anthropic API key and a spend limit in the Claude Console, and save the key as the Actions secret `ANTHROPIC_API_KEY` in `reprise-smoke`.

## Manual steps first (people, not Bob)

1. G-1: create a Bob API key with Scope = Inference; note the Bobcoin allocation; save the key as Actions secret `BOB_API_KEY` in `reprise-smoke` (and `BOB_TEAM_ID` if the key type is general).
2. G-13: read the live hackathon page and Discord; record tracks, video limit, repository visibility rule, Application URL rules, deadline and time zone.
3. G-15, G-17, G-18: check the licence file, GitHub docs, and action release pages; record results.

## Prompt

```
Read the attached verification gates. Create a GitHub Actions workflow .github/workflows/smoke.yml in this repository with workflow_dispatch that checks gates G-2, G-3, G-6, G-8, G-9, G-10 and G-14, and prints a clear PASS or FAIL line per gate.

Steps to include:
- actions/setup-node with node-version 24, then print node --version (G-8).
- Install Bob Shell with: curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash. Print bob --version.
- G-2: echo "Reply with the word ready" | bob run --format json --accept-license --mode ask --max-turns 2 (add --team-id from secrets.BOB_TEAM_ID only if it is non-empty). Parse with jq; PASS if .status == "success". Print .stats.
- G-3: in a fresh directory initialised with git, run bob run --format json --accept-license --mode agent --disable-tool-groups execute,mcp,skill,subagent,mode --max-turns 4 "Create a file named probe.txt containing the word ok". PASS if probe.txt exists. Do not pass --trust.
- G-6: write a canary file with a random string in $RUNNER_TEMP outside the workspace; ask Bob in ask mode with edit and execute disabled to read that absolute path and repeat its content. PASS (meaning "reads are confined") if the random string does not appear in last_message. Print the result either way.
- G-14: first call asks Bob to remember a random word; second call uses --resume with the first task_id and asks for the word. PASS if the word is returned.
- G-9: docker run --rm --network none node:24-slim node --version; then docker run --rm --network none node:24-slim node -e "fetch('https://example.com').then(()=>process.exit(1)).catch(()=>process.exit(0))". PASS if the first prints v24 and the second exits 0.
- G-10: create a tiny test file using node:test, run node --test --test-reporter=junit --test-reporter-destination=out.xml on it, print out.xml. PASS if it contains <testcase.
Pass BOB_API_KEY only to the steps that call bob, via env. Never echo secrets.
```

## Acceptance

- The workflow runs to completion and prints a PASS or FAIL per gate.
- Every gate row in `00-context/verification-gates.md` has a result filled in, and every FAIL has its fallback applied to the affected spec (commit those spec edits).
- `02-specs/security.md` gate table filled in for G-3, G-5, G-6.

## Stop conditions

- G-1 or G-2 fails: switch the plan to local mode (`02-specs/bob-integration.md`, "Local mode") before phase 3 and tell the whole team.
- G-9 fails: apply its fallback and mark sandboxing as "unsandboxed" in the pitch; do not hide it.

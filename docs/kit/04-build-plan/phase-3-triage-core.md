# Phase 3 — Triage core (local)

**Goal:** `reprise triage` works end to end on a developer machine against a local clone of `reprise-demo-shop`, using real Bob calls once (recorded) and replay afterwards.
**Repository:** `reprise`.
**Mode:** Plan, then Agent. Split into the three sub-tasks below; one Bob task each.
**Attach:** `@docs/kit/02-specs/triage-pipeline.md`, `@docs/kit/02-specs/bob-integration.md`, `@docs/kit/02-specs/security.md`, `@docs/kit/02-specs/statistics.md`, `@docs/kit/02-specs/data-contracts.md`, `@docs/kit/03-runtime-prompts/` (all files).

## Sub-task 3a — Sandbox and Bob runner

```
Implement src/sandbox and src/bob exactly as specified.

src/sandbox:
- buildImage(repoDir, dockerfile) with a 10-minute timeout, returning success and the last 50 lines of output.
- runTests(image, repoCopyDir, command, timeoutSeconds) that runs docker with --rm --network none, mounts the repo copy read-only at /work and a fresh temp dir at /out, passes no environment variables, enforces the timeout, and returns exit code, stdout/stderr tail (last 200 lines), and parsed JUnit results from /out/junit.xml (use fast-xml-parser; test id = "<file>::<full name>").
- classifyTrial(result, signature) returning PASS | FAIL_MATCH | FAIL_OTHER | ERROR per statistics.md section 1 and the signature rules in triage-pipeline.md section 5.

src/bob:
- runBob(stage, promptVars, opts) implementing bob-integration.md: argument list from the stage table, minimal environment (PATH, a fresh empty HOME, BOB_API_KEY, LANG), prompt on stdin, 10-minute process timeout, JSON parsing, last_message extraction, ajv validation with exactly one schema-repair retry via --resume, stats capture, redaction of all string fields.
- --bob-record DIR and --bob-replay DIR modes as specified, including saving and re-applying the workspace diff.
- A stateless-revision fallback switched on by config when gate G-14 failed.

src/security: redact(text, secrets) and scanForSecrets(text) as in security.md; unit tests with sample tokens.

Unit tests for classifyTrial (every outcome), JSON extraction (plain, fenced, invalid), and replay.
```

## Sub-task 3b — Pipeline stages

```
Implement src/triage stages intake, dedupe, environment, repro loop, trials, bisect, rootcause and verdict exactly as in triage-pipeline.md, using src/sandbox, src/bob and src/stats. Include:
- untrusted report block construction per security.md, including the closing-tag escape;
- dedupe normalisation, field scores, weighted score with present-field renormalisation, threshold, Bob confirmation, and behaviour check;
- edit-scope enforcement after every Bob edit stage (git diff --name-only in the scratch clone, minimatch against edit_scope, revert out-of-scope files, record scope_violations);
- trials with up to 4 parallel containers;
- bisect with a 15-minute limit and git bisect reset in a finally block;
- rootcause location validation;
- ide_prompt built from the template in github-integration.md (not from Bob).
Expose `reprise triage --issue N --event-file PATH --repo-dir PATH --out-dir PATH` for local runs: it reads a GitHub issue event JSON, runs the pipeline, writes the issue record JSON and the rendered comment Markdown to --out-dir, and makes no GitHub calls.
```

## Sub-task 3c — Record, calibrate, measure

Done by a person with Bob's help:

1. Create event JSON files for BULK, RACE and VAGUE from the demo spec. Run triage for each with `--bob-record test/fixtures/bob/`. Then create the DUP event and run it with BULK's record present.
2. Check verdicts: BULK `CONFIRMED` with bisect on commit 3; RACE `FLAKY`; VAGUE `NEEDS_INFO`; DUP `DUPLICATE` of BULK.
3. Calibrate dedupe: compute scores for all six pairs among the four issues. The DUP–BULK pair must be at or above the threshold and all other pairs below. Adjust weights or threshold only if needed; record the final values and all six scores in `triage-pipeline.md` §3.
4. Record observed Bobcoins and turns per stage in `bob-integration.md`; set caps to about twice the observed maximum; update `.reprise.yml` in the demo repo (gate G-4).
5. Add an engine test that replays the recorded fixtures and asserts the four verdicts, so CI checks the whole pipeline without Bobcoins.

## Acceptance

- The four local runs produce the expected verdicts and readable comments.
- Replay test passes in CI.
- Cost table in `bob-integration.md` filled in.
- Running triage twice on the same issue produces the same verdict (flaky rates may differ; the verdict class must not).

## Stop conditions

- If Bob cannot produce an accepted repro test for BULK in 3 attempts, stop and inspect the prompt and the scope guard before continuing; do not raise the attempt limit to hide it.

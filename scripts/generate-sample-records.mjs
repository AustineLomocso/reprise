// Generates the sample issue records for the web-only build (ADR-13).
//
//   npm run sample   (compiles the engine into .build/, then runs this script)
//
// Every statistic comes from the engine's own code in src/: Wilson intervals, verdicts,
// required runs, zero-failure bounds and claim sentences from src/stats, the duplicate
// match score from src/triage/dedupe-score.ts, the config error text from the real schema.
// Observations (trial sequences, run counts, test names, token counts, times, SHAs) are
// chosen by hand and checked for consistency here. Output is deterministic.
//
// Writes test/fixtures/sample-records/issues/<N>.json (the sample set) and
// test/fixtures/security/issues/<N>.json (the S7 record, never published).

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  wilson, requiredRuns, verdictFromTrials, claimSentence, formatPercent, validate,
  scoreFingerprints, isCandidate, CONFIG_DEFAULTS,
} from '../.build/src/lib.js';

const REPO = 'AustineLomocso/reprise-demo-shop';
const REPO_URL = `https://github.com/${REPO}`;
const SAMPLE_DIR = 'test/fixtures/sample-records/issues';
const SECURITY_DIR = 'test/fixtures/security/issues';
const BASE_TESTS = 12; // pricing 4 + shipping 3 + inventory 3 + cart 2 (demo-target-repo.md)

// --- helpers -----------------------------------------------------------------

function check(cond, message) {
  if (!cond) throw new Error(`sample generator: ${message}`);
}

const sha = (seed) => createHash('sha1').update(`reprise-sample:${seed}`).digest('hex');
const sha256 = (seed) => createHash('sha256').update(`reprise-sample:${seed}`).digest('hex');
const ms = (from, to) => Date.parse(to) - Date.parse(from);

function task(stage, n, input, output, toolCalls, durationMs) {
  return {
    stage,
    task_id: `msg_sample_${sha(`${stage}-${n}-${input}`).slice(0, 20)}`,
    session_costs: 0,
    duration_ms: durationMs,
    total_tokens: input + output,
    input_tokens: input,
    output_tokens: output,
    tool_calls: toolCalls,
  };
}

function cost(tasks) {
  return { bobcoins_total: 0, by_stage: { intake: 0, dedupe: 0, repro: 0, rootcause: 0, fix: 0 }, bob_tasks: tasks };
}

const OUTCOME = { P: 'PASS', F: 'FAIL_MATCH', X: 'ERROR' };

/** Triage repro block from an observed sequence, with every number computed by src/stats. */
function repro(issue, sequence, signature, attempts, expectVerdict, scopeViolations = []) {
  const result = verdictFromTrials([...sequence].map((c) => OUTCOME[c]));
  check(result.verdict === expectVerdict, `#${issue}: ${sequence} gives ${result.verdict}, expected ${expectVerdict}`);
  return {
    test_file: `test/reprise/issue-${issue}.test.js`,
    test_sha256: sha256(`repro-${issue}`),
    branch: `reprise/repro-${issue}`,
    signature,
    attempts,
    scope_violations: scopeViolations,
    trials: result.trials,
    failed: result.failed,
    invalid: result.invalid,
    sequence: result.sequence,
    rate: result.rate,
    wilson_low: result.wilson_low,
    wilson_high: result.wilson_high,
  };
}

function counts(partial) {
  const all = {
    UNCHANGED_PASS: 0, NEWLY_PASSING: 0, PRE_EXISTING_FAILURE: 0, PRE_EXISTING_FLAKY: 0,
    ADDED_PASSING: 0, ADDED_FAILING: 0, REMOVED: 0, REGRESSION: 0, ...partial,
  };
  return all;
}

const BLOCKING = new Set(['ADDED_FAILING', 'REMOVED', 'REGRESSION']);

/**
 * A verification object (fix-and-verify.md Part B). `triageRepro` gives the rate the run count
 * is based on. The verdict follows the spec's precedence rule and is checked, not typed.
 */
function verification(issue, triageRepro, { runs, failed = 0, invalid = 0, injected = false, finishedAt, regression, expect }) {
  const r = triageRepro.wilson_low;
  const req = requiredRuns(r, 0.05, CONFIG_DEFAULTS.verify.min_runs, CONFIG_DEFAULTS.verify.max_runs);
  check(runs === req.required, `#${issue}: ${runs} runs but ${req.required} are required for r = ${r}`);
  const reg = { tests_total: 0, counts: counts(regression.counts), blocking: regression.blocking ?? [], notable: regression.notable ?? [] };
  reg.tests_total = Object.values(reg.counts).reduce((a, b) => a + b, 0);
  const blockingClasses = Object.entries(reg.counts).filter(([c, n]) => BLOCKING.has(c) && n > 0).map(([c]) => c);
  for (const c of blockingClasses) {
    check(reg.blocking.filter((b) => b.class === c).length === reg.counts[c], `#${issue}: blocking list must name every ${c} test`);
  }
  const reproFixed = failed === 0 && invalid === 0;
  const verdict = blockingClasses.length ? 'REGRESSION_DETECTED' : reproFixed ? 'FIX_VERIFIED' : 'FIX_INCOMPLETE';
  check(verdict === expect, `#${issue}: verification gives ${verdict}, expected ${expect}`);
  return {
    verdict,
    finished_at: finishedAt,
    repro: {
      runs_required: req.required,
      runs,
      failed,
      invalid,
      evidence: reproFixed ? (req.capped ? 'limited' : 'strong') : null,
      claim: reproFixed ? claimSentence(r, runs, req) : '',
      injected,
    },
    regression: reg,
  };
}

function bisectFound(firstBadSeed, subject, date) {
  const first = sha(firstBadSeed);
  return {
    status: 'found',
    good_sha: sha('v0.1.0'),
    first_bad_sha: first,
    subject,
    author: 'demo-shop maintainer',
    date,
    url: `${REPO_URL}/commit/${first}`,
    reason: '',
  };
}

const BISECT_SKIPPED = {
  status: 'skipped', good_sha: '', first_bad_sha: '', subject: '', author: '', date: '', url: '',
  reason: 'bisect is unreliable for intermittent failures',
};

/** ide_prompt from the template in github-integration.md. */
function idePrompt(issue, rp, failureMessage, rootCause, bisect) {
  const single = CONFIG_DEFAULTS.tests.single.replace('{file}', rp.test_file);
  const locations = rootCause.locations.map((l) => `${l.file} lines ${l.start_line}–${l.end_line}`).join('; ');
  const bisectSentence = bisect.status === 'found'
    ? `Introduced in ${bisect.first_bad_sha.slice(0, 7)} (${bisect.subject}).`
    : 'The first bad commit was not searched: the failure is intermittent.';
  return [
    `Fix GitHub issue #${issue} in this repository.`,
    `Reproduction test: ${rp.test_file} (get it with: git checkout origin/reprise/repro-${issue} -- ${rp.test_file}).`,
    `Run it with: ${single}. It currently fails with: ${failureMessage}`,
    `Likely cause: ${rootCause.summary}`,
    `Locations: ${locations}`,
    bisectSentence,
    `Rules: do not modify ${rp.test_file}; keep the change minimal; run the full suite with ${CONFIG_DEFAULTS.tests.all} before finishing; open a PR whose description contains "Fixes #${issue}".`,
  ].join('\n');
}

function rootCause(issue, rp, failureMessage, bisect, summary, locations, fixDirection, confidence = 'high') {
  const rc = { summary, locations, fix_direction: fixDirection, confidence, ide_prompt: '' };
  rc.ide_prompt = idePrompt(issue, rp, failureMessage, rc, bisect);
  return rc;
}

function noDuplicate() {
  return { of: null, score: null, fields: {}, reason: '', behaviour_check: null };
}

const BASELINE = { sha: sha('main-2026-09-23'), passed: BASE_TESTS, failed: 0 };

function base(issue, title, createdAt) {
  return {
    schema: 1,
    repo: REPO,
    issue,
    title,
    url: `${REPO_URL}/issues/${issue}`,
    provider: 'claude',
    state: 'NEW',
    created_at: createdAt,
    updated_at: createdAt,
    triage_runs: 1,
    auto_retriage_count: 0,
  };
}

function triage({ verdict, started, finished, fingerprint, duplicate = noDuplicate(), question = '', baseline = BASELINE, repro: rp = null, bisect = null, root_cause = null }) {
  return {
    verdict,
    started_at: started,
    finished_at: finished,
    duration_ms: finished ? ms(started, finished) : null,
    fingerprint,
    duplicate,
    question,
    baseline_suite: baseline,
    repro: rp,
    bisect,
    root_cause,
  };
}

function finish(record, rest) {
  const r = { ...record, ...rest };
  r.resolution_note ??= '';
  r.updated_at = r.events[r.events.length - 1].at;
  return r;
}

function strictEqualMessage(actual, expected) {
  return `Expected values to be strictly equal: ${actual} !== ${expected}`;
}

// --- the records -------------------------------------------------------------

const records = [];

// #1 BULK: confirmed, bisect found, Bob's fix verified, a person's bad fix caught, then resolved.
{
  const fp = {
    component: 'pricing',
    functions: ['applyBulkDiscount'],
    symptom: 'bulk discount not applied at quantity 10',
    trigger: 'cart with exactly 10 units of one sku',
    expected: '10% discount applied, 2250.00 before shipping',
    actual: 'full price charged, 2500.00',
    error_signature: '',
  };
  const msg = strictEqualMessage(250000, 225000);
  const rp = repro(1, 'F'.repeat(20), { kind: 'assertion_message', pattern: '250000 !== 225000' }, 1, 'CONFIRMED');
  const bisect = bisectFound('refactor-thresholds', 'refactor: move pricing thresholds into named constants', '2026-09-22T14:20:00Z');
  const rc = rootCause(1, rp, msg, bisect,
    'applyBulkDiscount compares qty > BULK_MIN_QTY, so an order of exactly 10 units never qualifies for the discount.',
    [{ file: 'src/pricing.js', start_line: 12, end_line: 14, reason: 'the comparison excludes the threshold itself' }],
    'Compare with >= against BULK_MIN_QTY.');
  const v1 = verification(1, rp, {
    runs: 3, finishedAt: '2026-09-23T10:31:00Z', expect: 'FIX_VERIFIED',
    regression: { counts: { UNCHANGED_PASS: BASE_TESTS } },
  });
  const v2 = verification(1, rp, {
    runs: 3, injected: true, finishedAt: '2026-09-23T11:05:00Z', expect: 'REGRESSION_DETECTED',
    regression: {
      counts: { UNCHANGED_PASS: BASE_TESTS - 1, REGRESSION: 1 },
      blocking: [{ id: 'test/pricing.test.js::no bulk discount for 9 units', class: 'REGRESSION', base: '4/4 pass', head: '0/4 pass', message: strictEqualMessage(202500, 225000) }],
    },
  });
  records.push(finish(base(1, 'Bulk discount not applied when buying exactly 10 units', '2026-09-23T08:02:11Z'), {
    state: 'RESOLVED',
    triage: triage({ verdict: 'CONFIRMED', started: '2026-09-23T08:02:40Z', finished: '2026-09-23T08:09:52Z', fingerprint: fp, repro: rp, bisect, root_cause: rc }),
    fix: {
      iterations: [
        { n: 1, source: 'bob', pr: 5, branch: 'reprise/fix-1', base_sha: sha('main-2026-09-23'), head_sha: sha('fix-1'), bob_iterations: 1, scope_violations: [], summary: 'Use >= when comparing the quantity with BULK_MIN_QTY in applyBulkDiscount.', verification: v1 },
        { n: 2, source: 'human', pr: 7, branch: 'demo/bad-fix-bulk', base_sha: sha('main-2026-09-23'), head_sha: sha('bad-fix-bulk'), bob_iterations: 0, scope_violations: [], summary: 'Lower BULK_MIN_QTY to 9 so ten units always qualify.', verification: v2 },
      ],
    },
    cost: cost([
      task('intake', 1, 6120, 410, 4, 21000),
      task('repro', 1, 18400, 1650, 9, 96000),
      task('rootcause', 1, 12900, 720, 6, 41000),
      task('fix', 1, 31200, 2900, 14, 150000),
    ]),
    events: [
      { at: '2026-09-23T08:02:40Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-23T08:08:10Z', type: 'bisect.done', detail: `First bad commit ${bisect.first_bad_sha.slice(0, 7)}: ${bisect.subject}` },
      { at: '2026-09-23T08:09:30Z', type: 'rootcause.done', detail: 'High confidence: src/pricing.js lines 12–14.' },
      { at: '2026-09-23T08:09:52Z', type: 'triage.verdict', detail: `Reproduced in ${rp.failed} of ${rp.trials} runs.` },
      { at: '2026-09-23T10:12:00Z', type: 'fix.started', detail: '/reprise fix from a maintainer.' },
      { at: '2026-09-23T10:20:00Z', type: 'fix.iteration', detail: 'Round 1: quick check passed.' },
      { at: '2026-09-23T10:21:00Z', type: 'fix.pr_opened', detail: 'Draft pull request #5.' },
      { at: '2026-09-23T10:21:05Z', type: 'verify.started', detail: 'Pull request #5.' },
      { at: '2026-09-23T10:31:00Z', type: 'verify.verdict', detail: `Fix verified: ${v1.repro.runs} clean runs, no regressions.` },
      { at: '2026-09-23T10:58:00Z', type: 'verify.started', detail: 'Pull request #7.' },
      { at: '2026-09-23T11:05:00Z', type: 'verify.verdict', detail: 'Fix breaks other tests: test/pricing.test.js::no bulk discount for 9 units.' },
      { at: '2026-09-23T11:40:00Z', type: 'resolved', detail: 'Pull request #5 merged and the issue closed.' },
    ],
  }));
}

// #2 RACE: flaky 4 of 20; Bob's fix verified with the required run count.
{
  const fp = {
    component: 'inventory',
    functions: ['reserve'],
    symptom: 'last unit sold twice, stock goes to -1',
    trigger: 'two concurrent checkouts of the last unit of one sku',
    expected: 'second reservation fails',
    actual: 'both reservations succeed',
    error_signature: '',
  };
  const rp = repro(2, 'FPPFPPPPFPPPPPFPPPPP', { kind: 'assertion_message', pattern: 'stock went negative: -1' }, 2, 'FLAKY');
  const rc = rootCause(2, rp, 'AssertionError: stock went negative: -1', BISECT_SKIPPED,
    'reserve reads the stock with await store.get, checks it, then writes with await store.set; two calls can both read 1 before either writes, so both succeed.',
    [{ file: 'src/inventory.js', start_line: 18, end_line: 27, reason: 'check and decrement are separated by an await' }],
    'Serialise reservations per SKU with a promise-chain lock, or make check-and-set atomic in the store.');
  const v = verification(2, rp, {
    runs: 36, finishedAt: '2026-09-25T02:48:00Z', expect: 'FIX_VERIFIED',
    regression: {
      counts: { UNCHANGED_PASS: BASE_TESTS, ADDED_PASSING: 1 },
      notable: [{ id: 'test/inventory.test.js::concurrent reservations never oversell', class: 'ADDED_PASSING' }],
    },
  });
  records.push(finish(base(2, 'Last item in stock can be sold twice', '2026-09-23T08:03:05Z'), {
    state: 'FIX_VERIFIED',
    triage: triage({ verdict: 'FLAKY', started: '2026-09-23T08:03:30Z', finished: '2026-09-23T08:11:02Z', fingerprint: fp, repro: rp, bisect: BISECT_SKIPPED, root_cause: rc }),
    fix: {
      iterations: [
        { n: 1, source: 'bob', pr: 6, branch: 'reprise/fix-2', base_sha: sha('main-2026-09-25'), head_sha: sha('fix-2'), bob_iterations: 2, scope_violations: [], summary: 'Serialise reserve() per SKU with a promise-chain lock so the check and the decrement happen together.', verification: v },
      ],
    },
    cost: cost([
      task('intake', 2, 5890, 395, 4, 19000),
      task('repro', 2, 21300, 1880, 11, 104000),
      task('repro', 2, 24100, 1420, 6, 71000),
      task('rootcause', 2, 14800, 810, 7, 45000),
      task('fix', 2, 29900, 2600, 12, 141000),
      task('fix', 2, 33800, 1900, 8, 98000),
    ]),
    events: [
      { at: '2026-09-23T08:03:30Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-23T08:10:40Z', type: 'rootcause.done', detail: 'High confidence: src/inventory.js lines 18–27.' },
      { at: '2026-09-23T08:11:02Z', type: 'triage.verdict', detail: `Reproduced in ${rp.failed} of ${rp.trials} runs (${formatPercent(rp.rate)}).` },
      { at: '2026-09-25T02:02:00Z', type: 'fix.started', detail: '/reprise fix from a maintainer.' },
      { at: '2026-09-25T02:14:00Z', type: 'fix.iteration', detail: 'Round 1: the reproduction test still failed 2 of 10 quick runs.' },
      { at: '2026-09-25T02:24:00Z', type: 'fix.iteration', detail: 'Round 2: quick check passed.' },
      { at: '2026-09-25T02:25:00Z', type: 'fix.pr_opened', detail: 'Draft pull request #6.' },
      { at: '2026-09-25T02:25:04Z', type: 'verify.started', detail: 'Pull request #6.' },
      { at: '2026-09-25T02:48:00Z', type: 'verify.verdict', detail: `Fix verified: ${v.repro.runs} clean runs, no regressions.` },
    ],
  }));
}

// #3 VAGUE: needs info, decided at intake (no trials, so no bound line).
records.push(finish(base(3, 'Checkout total is wrong sometimes', '2026-09-23T08:03:40Z'), {
  state: 'NEEDS_INFO',
  triage: triage({
    verdict: 'NEEDS_INFO', started: '2026-09-23T08:04:00Z', finished: '2026-09-23T08:05:12Z',
    fingerprint: { component: 'unknown', functions: [], symptom: 'checkout total is wrong', trigger: '', expected: '', actual: '', error_signature: '' },
    duplicate: null,
    question: 'Which items and quantities were in the cart, and what total did you expect and what did checkout show?',
  }),
  cost: cost([task('intake', 3, 4210, 260, 3, 14000)]),
  events: [
    { at: '2026-09-23T08:04:00Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
    { at: '2026-09-23T08:05:12Z', type: 'triage.verdict', detail: 'The report names no items, quantities or amounts, so no test could be written yet.' },
  ],
}));

// #4 DUP: duplicate of #1, score computed from the two fingerprints.
{
  const fp = {
    component: 'pricing',
    functions: ['applyBulkDiscount'],
    symptom: 'no bulk price for ten coffee mugs, full price charged',
    trigger: 'order of exactly 10 units of the mug sku',
    expected: 'bulk price for ten units',
    actual: 'paid the full 2500.00',
    error_signature: '',
  };
  const earlier = records.find((r) => r.issue === 1);
  const s = scoreFingerprints(fp, earlier.triage.fingerprint);
  check(isCandidate(s.score), `#4 must score at or above the threshold against #1, got ${s.score}`);
  records.push(finish(base(4, 'Ordered ten mugs, got charged full price', '2026-09-23T08:40:00Z'), {
    state: 'DUPLICATE',
    triage: triage({
      verdict: 'DUPLICATE', started: '2026-09-23T08:40:20Z', finished: '2026-09-23T08:42:05Z', fingerprint: fp,
      duplicate: {
        of: 1,
        score: s.score,
        fields: s.fields,
        reason: 'Both reports describe an order of exactly ten units of one product that got no bulk discount; #1 traces it to the > comparison in applyBulkDiscount.',
        behaviour_check: 'FAIL_MATCH',
      },
    }),
    cost: cost([task('intake', 4, 5010, 370, 4, 17000), task('dedupe', 4, 7400, 180, 3, 12000)]),
    events: [
      { at: '2026-09-23T08:40:20Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-23T08:42:05Z', type: 'triage.verdict', detail: `Duplicate of #1, match score ${s.score.toFixed(2)}; the reproduction test from #1 still fails on the current code.` },
    ],
  }));
}

// #9 CONFIRMED, bisect found, no fix requested yet.
{
  const fp = {
    component: 'cart',
    functions: ['checkout', 'shippingFee'],
    symptom: 'flat shipping fee added once per line instead of once per order',
    trigger: 'checkout of a cart with two different products under the free shipping minimum',
    expected: 'one 99.00 shipping fee',
    actual: 'two 99.00 shipping fees',
    error_signature: '',
  };
  const rp = repro(9, 'F'.repeat(20), { kind: 'assertion_message', pattern: '139800 !== 129900' }, 1, 'CONFIRMED');
  const bisect = bisectFound('price-each-line', 'feat: price each cart line separately', '2026-09-23T15:44:00Z');
  const rc = rootCause(9, rp, strictEqualMessage(139800, 129900), bisect,
    'checkout calls shippingFee() inside the per-line loop, so a cart with two lines pays the flat fee twice.',
    [{ file: 'src/cart.js', start_line: 21, end_line: 29, reason: 'shipping is added inside the loop over lines' }],
    'Add the shipping fee once, after the loop, based on the order subtotal.');
  records.push(finish(base(9, 'Two-item order charged the shipping fee twice', '2026-09-24T02:15:00Z'), {
    state: 'CONFIRMED',
    triage: triage({ verdict: 'CONFIRMED', started: '2026-09-24T02:15:30Z', finished: '2026-09-24T02:21:48Z', fingerprint: fp, repro: rp, bisect, root_cause: rc }),
    cost: cost([task('intake', 9, 6340, 430, 4, 20000), task('repro', 9, 17200, 1540, 8, 88000), task('rootcause', 9, 13600, 690, 6, 39000)]),
    events: [
      { at: '2026-09-24T02:15:30Z', type: 'triage.started', detail: 'Opened by a collaborator.' },
      { at: '2026-09-24T02:20:55Z', type: 'bisect.done', detail: `First bad commit ${bisect.first_bad_sha.slice(0, 7)}: ${bisect.subject}` },
      { at: '2026-09-24T02:21:30Z', type: 'rootcause.done', detail: 'High confidence: src/cart.js lines 21–29.' },
      { at: '2026-09-24T02:21:48Z', type: 'triage.verdict', detail: `Reproduced in ${rp.failed} of ${rp.trials} runs.` },
    ],
  }));
}

// #10 FLAKY, no fix yet.
{
  const fp = {
    component: 'cart',
    functions: ['available'],
    symptom: 'stock count on the order summary is sometimes one higher than the real stock',
    trigger: 'reading available() right after checkout of one unit',
    expected: 'count reduced by the units just bought',
    actual: 'count not yet reduced',
    error_signature: '',
  };
  const rp = repro(10, 'PFFPFPPFFPFPPFPFFPPF', { kind: 'assertion_message', pattern: 'expected available 4, got 5' }, 1, 'FLAKY');
  check(rp.failed === 10, '#10 should fail 10 of 20');
  const rc = rootCause(10, rp, 'AssertionError: expected available 4, got 5', BISECT_SKIPPED,
    'checkout reads available() for the summary before the reservation write has finished, so the count is sometimes read from before the write.',
    [{ file: 'src/cart.js', start_line: 33, end_line: 36, reason: 'the summary is built without awaiting the reservations' }],
    'Await every reservation before building the order summary.', 'medium');
  records.push(finish(base(10, 'Stock count shown after checkout is sometimes one too high', '2026-09-24T03:02:00Z'), {
    state: 'FLAKY',
    triage: triage({ verdict: 'FLAKY', started: '2026-09-24T03:02:25Z', finished: '2026-09-24T03:10:40Z', fingerprint: fp, repro: rp, bisect: BISECT_SKIPPED, root_cause: rc }),
    cost: cost([task('intake', 10, 5720, 402, 4, 18000), task('repro', 10, 19800, 1720, 10, 97000), task('rootcause', 10, 14100, 760, 7, 42000)]),
    events: [
      { at: '2026-09-24T03:02:25Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-24T03:10:20Z', type: 'rootcause.done', detail: 'Medium confidence: src/cart.js lines 33–36.' },
      { at: '2026-09-24T03:10:40Z', type: 'triage.verdict', detail: `Reproduced in ${rp.failed} of ${rp.trials} runs (${formatPercent(rp.rate)}).` },
    ],
  }));
}

// #11 NEEDS_INFO after 20 clean trials: shows the zero-failure bound line.
{
  const fp = {
    component: 'store',
    functions: ['get', 'set'],
    symptom: 'checkout fails with a store unavailable error',
    trigger: 'checkout during a busy period',
    expected: 'order placed',
    actual: 'error message store unavailable',
    error_signature: 'StoreUnavailableError: store unavailable',
  };
  const rp = repro(11, 'P'.repeat(20), { kind: 'error_type', pattern: 'StoreUnavailableError' }, 1, 'NEEDS_INFO');
  records.push(finish(base(11, "Checkout sometimes fails with 'store unavailable'", '2026-09-24T05:40:00Z'), {
    state: 'NEEDS_INFO',
    triage: triage({
      verdict: 'NEEDS_INFO', started: '2026-09-24T05:40:30Z', finished: '2026-09-24T05:47:15Z', fingerprint: fp, repro: rp,
      question: 'Roughly how many items were in the cart, and were other people checking out at the same moment when you saw the error?',
    }),
    cost: cost([task('intake', 11, 5480, 388, 4, 17000), task('repro', 11, 20500, 1600, 10, 92000)]),
    events: [
      { at: '2026-09-24T05:40:30Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-24T05:47:15Z', type: 'triage.verdict', detail: 'A test that forces the store to time out failed once while it was written, then passed in all 20 trials.' },
    ],
  }));
}

// #12 BLOCKED_ENV: the config error text comes from the real config schema.
{
  const cfg = validate('reprise-config', { version: 1, sandbox: {} });
  check(!cfg.valid, '#12 config must be invalid');
  const fp = {
    component: 'cart',
    functions: ['checkout'],
    symptom: 'checkout throws when a product sku contains a slash',
    trigger: 'cart with the sku MUG/RED',
    expected: 'order placed',
    actual: 'TypeError thrown from checkout',
    error_signature: 'TypeError: Cannot read properties of undefined',
  };
  records.push(finish(base(12, 'Checkout crashes when a product SKU contains a slash', '2026-09-24T07:05:00Z'), {
    state: 'BLOCKED_ENV',
    triage: triage({ verdict: 'BLOCKED_ENV', started: '2026-09-24T07:05:20Z', finished: '2026-09-24T07:06:02Z', fingerprint: fp, baseline: null }),
    cost: cost([task('intake', 12, 5960, 415, 4, 19000)]),
    events: [
      { at: '2026-09-24T07:05:20Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-24T07:06:02Z', type: 'triage.verdict', detail: `.reprise.yml does not match the config schema: ${cfg.errors.join('; ')}. The sandbox cannot be built without sandbox.dockerfile.` },
    ],
  }));
}

// #13 ERROR: more than 10% invalid trials after every attempt; partial evidence kept.
{
  const fp = {
    component: 'cart',
    functions: ['checkout', 'lineTotal'],
    symptom: 'wrong total for carts with more than 50 lines',
    trigger: 'checkout of a cart with 60 lines',
    expected: 'total equal to the sum of the line totals',
    actual: 'total lower than the sum',
    error_signature: '',
  };
  const sequence = 'PFXPFXPPFXPFPPXFPPXP';
  const result = verdictFromTrials([...sequence].map((c) => OUTCOME[c]));
  check(result.unstable, '#13 must be unstable');
  const rp = {
    test_file: 'test/reprise/issue-13.test.js', test_sha256: sha256('repro-13'), branch: 'reprise/repro-13',
    signature: { kind: 'assertion_message', pattern: 'total \\d+ !== sum \\d+' }, attempts: CONFIG_DEFAULTS.triage.max_repro_attempts,
    scope_violations: [], trials: result.trials, failed: result.failed, invalid: result.invalid, sequence: result.sequence,
    rate: result.rate, wilson_low: result.wilson_low, wilson_high: result.wilson_high,
  };
  records.push(finish(base(13, 'Cart with more than 50 lines returns the wrong total', '2026-09-24T09:12:00Z'), {
    state: 'ERROR',
    triage: triage({ verdict: null, started: '2026-09-24T09:12:30Z', finished: null, fingerprint: fp, repro: rp }),
    cost: cost([
      task('intake', 13, 6050, 420, 4, 20000),
      task('repro', 13, 22400, 1980, 12, 118000),
      task('repro', 13, 25900, 1510, 7, 83000),
      task('repro', 13, 27300, 1440, 7, 80000),
    ]),
    events: [
      { at: '2026-09-24T09:12:30Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-24T09:31:10Z', type: 'error', detail: `During the trials, ${result.invalid} of ${result.trials} runs were invalid (they hit the 60-second run timeout, which the signature does not declare), more than the 10% allowed, after ${CONFIG_DEFAULTS.triage.max_repro_attempts} attempts. The invalid outputs are attached to the issue comment.` },
    ],
  }));
}

// #14 TRIAGING: just started.
records.push(finish(base(14, 'Discount code WELCOME10 is rejected at checkout', '2026-09-25T02:10:00Z'), {
  state: 'TRIAGING',
  triage: triage({ verdict: null, started: '2026-09-25T02:10:25Z', finished: null, fingerprint: null, duplicate: null, baseline: null }),
  cost: cost([]),
  events: [{ at: '2026-09-25T02:10:25Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' }],
}));

// Confirmed triage used by several fix-stage records.
function confirmedTriage(issue, fp, pattern, started, finished, firstBad, subject, summary, loc, direction, actual, expected) {
  const rp = repro(issue, 'F'.repeat(20), { kind: 'assertion_message', pattern }, 1, 'CONFIRMED');
  const bisect = bisectFound(firstBad, subject, '2026-09-23T12:00:00Z');
  const rc = rootCause(issue, rp, strictEqualMessage(actual, expected), bisect, summary, [loc], direction);
  return { rp, bisect, triage: triage({ verdict: 'CONFIRMED', started, finished, fingerprint: fp, repro: rp, bisect, root_cause: rc }) };
}

const triageTasks = (n) => [task('intake', n, 5800, 400, 4, 19000), task('repro', n, 18000, 1600, 9, 90000), task('rootcause', n, 13000, 700, 6, 40000)];

// #15 FIXING: /reprise fix running.
{
  const c = confirmedTriage(15, {
    component: 'cart', functions: ['checkout', 'reserve'],
    symptom: 'checkout reports success with a zero total when every item is out of stock',
    trigger: 'checkout of a cart whose only product has no stock left',
    expected: 'checkout fails with out of stock', actual: 'ok true with totalCents 0', error_signature: '',
  }, 'true !== false', '2026-09-25T00:40:10Z', '2026-09-25T00:46:30Z', 'skip-failed-lines', 'feat: skip lines that cannot be reserved',
  'checkout skips lines whose reservation fails instead of failing the order, so an order with no reservable lines succeeds with a zero total.',
  { file: 'src/cart.js', start_line: 14, end_line: 19, reason: 'a failed reservation is skipped with continue' },
  'Fail the whole checkout when any reservation fails, and release the reservations already made.', true, false);
  records.push(finish(base(15, 'Checkout succeeds with a ₱0.00 total when everything is out of stock', '2026-09-25T00:40:00Z'), {
    state: 'FIXING',
    triage: c.triage,
    fix: { iterations: [{ n: 1, source: 'bob', pr: null, branch: 'reprise/fix-15', base_sha: sha('main-2026-09-25'), head_sha: null, bob_iterations: 1, scope_violations: [], summary: '', verification: null }] },
    cost: cost([...triageTasks(15), task('fix', 15, 30400, 2750, 13, 146000)]),
    events: [
      { at: '2026-09-25T00:40:10Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-25T00:46:30Z', type: 'triage.verdict', detail: 'Reproduced in 20 of 20 runs.' },
      { at: '2026-09-25T01:30:00Z', type: 'fix.started', detail: '/reprise fix from a maintainer.' },
      { at: '2026-09-25T01:39:00Z', type: 'fix.iteration', detail: 'Round 1: the full suite showed one test going from pass to fail; revising.' },
    ],
  }));
}

// #16 FIX_ABANDONED: every round only touched the repro test, which the fix stage may not edit.
{
  const c = confirmedTriage(16, {
    component: 'shipping', functions: ['shippingFee'],
    symptom: 'shipping fee charged a second time when checkout is retried',
    trigger: 'retry checkout after a failed payment',
    expected: 'one shipping fee', actual: 'shipping fee added on each retry', error_signature: '',
  }, '19800 !== 9900', '2026-09-24T11:20:10Z', '2026-09-24T11:27:00Z', 'retry-checkout', 'feat: allow retrying a failed checkout',
  'The retry path reuses the order object and calls shippingFee() again without resetting the previous fee.',
  { file: 'src/shipping.js', start_line: 8, end_line: 12, reason: 'the fee is added to a running total that survives the retry' },
  'Compute the fee from the subtotal on every attempt instead of adding it to the running total.', 19800, 9900);
  const detail = 'Three rounds produced no change inside src/ or test/: every edit was to test/reprise/issue-16.test.js, which the fix stage may not modify, so each edit was undone.';
  records.push(finish(base(16, 'Shipping fee is charged again when checkout is retried', '2026-09-24T11:20:00Z'), {
    state: 'FIX_ABANDONED',
    triage: c.triage,
    fix: { iterations: [{ n: 1, source: 'bob', pr: null, branch: 'reprise/fix-16', base_sha: sha('main-2026-09-24'), head_sha: null, bob_iterations: CONFIG_DEFAULTS.fix.max_iterations, scope_violations: ['test/reprise/issue-16.test.js'], summary: 'The only proposed changes were to the reproduction test, so nothing usable remained.', verification: null }] },
    cost: cost([...triageTasks(16), task('fix', 16, 29800, 2400, 12, 139000), task('fix', 16, 33100, 1800, 9, 101000), task('fix', 16, 35900, 1700, 8, 97000)]),
    events: [
      { at: '2026-09-24T11:20:10Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-24T11:27:00Z', type: 'triage.verdict', detail: 'Reproduced in 20 of 20 runs.' },
      { at: '2026-09-24T12:05:00Z', type: 'fix.started', detail: '/reprise fix from a maintainer.' },
      { at: '2026-09-24T12:31:00Z', type: 'fix.abandoned', detail },
    ],
  }));
}

// #17 FIX_INCOMPLETE: flaky 6 of 20; a person's fix still fails some runs.
{
  const fp = {
    component: 'store',
    functions: ['set'],
    symptom: 'saved cart sometimes comes back with an older quantity',
    trigger: 'changing a quantity in two browser tabs within a second',
    expected: 'the latest quantity is kept',
    actual: 'an earlier quantity is restored',
    error_signature: '',
  };
  const rp = repro(17, 'PPFPPFPPPFPPFPPPFPPF', { kind: 'assertion_message', pattern: 'quantity 3 !== 5' }, 1, 'FLAKY');
  check(rp.failed === 6, '#17 should fail 6 of 20');
  const rc = rootCause(17, rp, 'AssertionError: quantity 3 !== 5', BISECT_SKIPPED,
    'Two set() calls for the same key can resolve out of order, so the older write can land last.',
    [{ file: 'src/store.js', start_line: 9, end_line: 16, reason: 'writes resolve after independent random delays with no ordering' }],
    'Order writes per key, for example with a version number checked on write.', 'medium');
  const req = requiredRuns(rp.wilson_low);
  const v = verification(17, rp, {
    runs: req.required, failed: 3, finishedAt: '2026-09-24T19:40:00Z', expect: 'FIX_INCOMPLETE',
    regression: { counts: { UNCHANGED_PASS: BASE_TESTS } },
  });
  records.push(finish(base(17, 'Saved cart sometimes comes back with an older quantity', '2026-09-24T13:00:00Z'), {
    state: 'FIX_INCOMPLETE',
    triage: triage({ verdict: 'FLAKY', started: '2026-09-24T13:00:20Z', finished: '2026-09-24T13:08:45Z', fingerprint: fp, repro: rp, bisect: BISECT_SKIPPED, root_cause: rc }),
    fix: { iterations: [{ n: 1, source: 'human', pr: 22, branch: 'retry-store-write', base_sha: sha('main-2026-09-24'), head_sha: sha('retry-store-write'), bob_iterations: 0, scope_violations: [], summary: 'Retry store.set once when a write races with another.', verification: v }] },
    cost: cost([task('intake', 17, 5650, 390, 4, 18000), task('repro', 17, 19900, 1700, 10, 95000), task('rootcause', 17, 13900, 740, 6, 41000)]),
    events: [
      { at: '2026-09-24T13:00:20Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-24T13:08:45Z', type: 'triage.verdict', detail: `Reproduced in ${rp.failed} of ${rp.trials} runs (${formatPercent(rp.rate)}).` },
      { at: '2026-09-24T19:10:00Z', type: 'verify.started', detail: 'Pull request #22.' },
      { at: '2026-09-24T19:40:00Z', type: 'verify.verdict', detail: `Still reproduces: failed ${v.repro.failed} of ${v.repro.runs} runs.` },
    ],
  }));
}

// #18 REGRESSION_DETECTED: the repro passes, but one test breaks and one is removed.
{
  const c = confirmedTriage(18, {
    component: 'inventory', functions: ['outOfStockMessage'],
    symptom: 'out of stock message names a different product',
    trigger: 'checkout where the second line is out of stock',
    expected: 'message names the out of stock product', actual: 'message names the first product in the cart', error_signature: '',
  }, "'MUG-01' !== 'LAMP-02'", '2026-09-24T14:10:10Z', '2026-09-24T14:16:20Z', 'error-messages', 'feat: friendlier out-of-stock messages',
  'outOfStockMessage is called with lines[0] instead of the line whose reservation failed.',
  { file: 'src/inventory.js', start_line: 41, end_line: 44, reason: 'the index of the failing line is not passed on' },
  'Pass the failing line to outOfStockMessage.', "'MUG-01'", "'LAMP-02'");
  const v = verification(18, c.rp, {
    runs: 3, finishedAt: '2026-09-24T21:15:00Z', expect: 'REGRESSION_DETECTED',
    regression: {
      counts: { UNCHANGED_PASS: BASE_TESTS - 2, REGRESSION: 1, REMOVED: 1 },
      blocking: [
        { id: 'test/cart.test.js::checkout fails cleanly when out of stock', class: 'REGRESSION', base: '4/4 pass', head: '0/4 pass', message: "TypeError: Cannot read properties of undefined (reading 'sku')" },
        { id: 'test/inventory.test.js::reservation larger than stock fails', class: 'REMOVED', base: '4/4 pass', head: 'not present', message: 'The test was deleted in this pull request.' },
      ],
    },
  });
  records.push(finish(base(18, 'Out-of-stock message names the wrong product', '2026-09-24T14:10:00Z'), {
    state: 'REGRESSION_DETECTED',
    triage: c.triage,
    fix: { iterations: [{ n: 1, source: 'human', pr: 23, branch: 'fix-oos-message', base_sha: sha('main-2026-09-24'), head_sha: sha('fix-oos-message'), bob_iterations: 0, scope_violations: [], summary: 'Look up the failing line before building the message.', verification: v }] },
    cost: cost(triageTasks(18)),
    events: [
      { at: '2026-09-24T14:10:10Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-24T14:16:20Z', type: 'triage.verdict', detail: 'Reproduced in 20 of 20 runs.' },
      { at: '2026-09-24T21:02:00Z', type: 'verify.started', detail: 'Pull request #23.' },
      { at: '2026-09-24T21:15:00Z', type: 'verify.verdict', detail: 'Fix breaks other tests: one test now fails and one was removed.' },
    ],
  }));
}

// #19 FIX_VERIFIED with limited evidence: 1 of 20 in triage, so the run count is capped.
{
  const fp = {
    component: 'cart',
    functions: ['checkout'],
    symptom: 'checkout of one product occasionally waits for an unrelated checkout and times out',
    trigger: 'two checkouts of different products started together',
    expected: 'both finish in under a second',
    actual: 'one times out after 5 seconds',
    error_signature: 'timed out after 5000 ms',
  };
  const rp = repro(19, 'PPPPPPPPPPPPFPPPPPPP', { kind: 'timeout', pattern: 'timed out after 5000 ms' }, 2, 'FLAKY');
  const rc = rootCause(19, rp, 'Error: timed out after 5000 ms', BISECT_SKIPPED,
    'checkout takes one global lock around every reservation, so a slow reservation of one product blocks checkouts of every other product.',
    [{ file: 'src/cart.js', start_line: 8, end_line: 12, reason: 'a single lock is shared by all SKUs' }],
    'Lock per SKU instead of globally.', 'medium');
  const req = requiredRuns(rp.wilson_low);
  check(req.capped, '#19 must be capped');
  const v = verification(19, rp, {
    runs: req.required, finishedAt: '2026-09-24T23:55:00Z', expect: 'FIX_VERIFIED',
    regression: { counts: { UNCHANGED_PASS: BASE_TESTS } },
  });
  records.push(finish(base(19, 'Checkouts of different products occasionally block each other', '2026-09-24T17:30:00Z'), {
    state: 'FIX_VERIFIED',
    triage: triage({ verdict: 'FLAKY', started: '2026-09-24T17:30:20Z', finished: '2026-09-24T17:41:05Z', fingerprint: fp, repro: rp, bisect: BISECT_SKIPPED, root_cause: rc }),
    fix: { iterations: [{ n: 1, source: 'bob', pr: 24, branch: 'reprise/fix-19', base_sha: sha('main-2026-09-24'), head_sha: sha('fix-19'), bob_iterations: 1, scope_violations: [], summary: 'Replace the global checkout lock with one lock per SKU.', verification: v }] },
    cost: cost([task('intake', 19, 5930, 410, 4, 19000), task('repro', 19, 20800, 1820, 10, 99000), task('repro', 19, 23600, 1350, 6, 69000), task('rootcause', 19, 15200, 830, 7, 44000), task('fix', 19, 31500, 2650, 13, 143000)]),
    events: [
      { at: '2026-09-24T17:30:20Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-24T17:41:05Z', type: 'triage.verdict', detail: `Reproduced in ${rp.failed} of ${rp.trials} runs (${formatPercent(rp.rate)}).` },
      { at: '2026-09-24T22:40:00Z', type: 'fix.started', detail: '/reprise fix from a maintainer.' },
      { at: '2026-09-24T22:49:00Z', type: 'fix.pr_opened', detail: 'Draft pull request #24.' },
      { at: '2026-09-24T22:49:05Z', type: 'verify.started', detail: 'Pull request #24.' },
      { at: '2026-09-24T23:55:00Z', type: 'verify.verdict', detail: `Fix verified with limited evidence: ${v.repro.runs} clean runs (capped).` },
    ],
  }));
}

// #20 RESOLVED, merged without passing verification.
{
  const c = confirmedTriage(20, {
    component: 'shipping', functions: ['shippingFee', 'applyBulkDiscount'],
    symptom: 'free shipping given although the discounted subtotal is below the minimum',
    trigger: 'bulk order whose subtotal is just above 1500.00 before the discount',
    expected: 'shipping fee charged on the discounted subtotal', actual: 'free shipping', error_signature: '',
  }, '0 !== 9900', '2026-09-24T15:00:10Z', '2026-09-24T15:06:40Z', 'shipping-before-discount', 'refactor: compute shipping before discounts',
  'shippingFee() is called with the subtotal before applyBulkDiscount runs, so discounted orders can still qualify for free shipping.',
  { file: 'src/cart.js', start_line: 24, end_line: 27, reason: 'shipping is computed from the undiscounted subtotal' },
  'Compute shipping from the subtotal after discounts.', 0, 9900);
  const v = verification(20, c.rp, {
    runs: 3, failed: 3, finishedAt: '2026-09-24T18:20:00Z', expect: 'FIX_INCOMPLETE',
    regression: { counts: { UNCHANGED_PASS: BASE_TESTS } },
  });
  records.push(finish(base(20, 'Free shipping applied before the bulk discount is taken off', '2026-09-24T15:00:00Z'), {
    state: 'RESOLVED',
    resolution_note: 'merged without passing verification',
    triage: c.triage,
    fix: { iterations: [{ n: 1, source: 'human', pr: 25, branch: 'shipping-threshold', base_sha: sha('main-2026-09-24'), head_sha: sha('shipping-threshold'), bob_iterations: 0, scope_violations: [], summary: 'Raise FREE_SHIPPING_MIN so the example order pays shipping.', verification: v }] },
    cost: cost(triageTasks(20)),
    events: [
      { at: '2026-09-24T15:00:10Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-24T15:06:40Z', type: 'triage.verdict', detail: 'Reproduced in 20 of 20 runs.' },
      { at: '2026-09-24T18:05:00Z', type: 'verify.started', detail: 'Pull request #25.' },
      { at: '2026-09-24T18:20:00Z', type: 'verify.verdict', detail: `Still reproduces: failed ${v.repro.failed} of ${v.repro.runs} runs.` },
      { at: '2026-09-24T18:45:00Z', type: 'resolved', detail: 'Pull request #25 merged without passing verification.' },
    ],
  }));
}

// #21 VERIFYING: a person's pull request is being checked.
{
  const c = confirmedTriage(21, {
    component: 'pricing', functions: ['lineTotal'],
    symptom: 'line total wrong for quantities of 1000 or more',
    trigger: 'one line with 1200 units',
    expected: 'unit price times 1200', actual: 'unit price times 999', error_signature: '',
  }, '24975000 !== 30000000', '2026-09-25T01:00:10Z', '2026-09-25T01:06:15Z', 'max-qty', 'feat: cap quantity input at three digits',
  'lineTotal clamps the quantity to 999 with Math.min before multiplying.',
  { file: 'src/pricing.js', start_line: 5, end_line: 7, reason: 'the quantity is clamped silently' },
  'Reject quantities above the limit instead of clamping them, or remove the clamp.', 24975000, 30000000);
  records.push(finish(base(21, 'Line total uses 999 units when the quantity is higher', '2026-09-25T01:00:00Z'), {
    state: 'VERIFYING',
    triage: c.triage,
    fix: { iterations: [{ n: 1, source: 'human', pr: 26, branch: 'remove-qty-clamp', base_sha: sha('main-2026-09-25'), head_sha: sha('remove-qty-clamp'), bob_iterations: 0, scope_violations: [], summary: 'Remove the 999-unit clamp from lineTotal.', verification: null }] },
    cost: cost(triageTasks(21)),
    events: [
      { at: '2026-09-25T01:00:10Z', type: 'triage.started', detail: 'Maintainer added the reprise label.' },
      { at: '2026-09-25T01:06:15Z', type: 'triage.verdict', detail: 'Reproduced in 20 of 20 runs.' },
      { at: '2026-09-25T02:32:00Z', type: 'verify.started', detail: 'Pull request #26.' },
    ],
  }));
}

// --- consistency checks ----------------------------------------------------

// Dedupe: only #4 may reach the threshold against an earlier, non-duplicate record.
for (const r of records) {
  if (!r.triage.fingerprint) continue;
  for (const e of records) {
    if (e.issue >= r.issue || !e.triage.fingerprint || e.triage.verdict === 'DUPLICATE') continue;
    const s = scoreFingerprints(r.triage.fingerprint, e.triage.fingerprint);
    const hit = isCandidate(s.score);
    check(hit === (r.issue === 4 && e.issue === 1), `#${r.issue} vs #${e.issue} scores ${s.score?.toFixed(3)}; only #4 vs #1 may reach the threshold`);
  }
}

const REQUIRED_STATES = [
  'TRIAGING', 'CONFIRMED', 'FLAKY', 'DUPLICATE', 'NEEDS_INFO', 'BLOCKED_ENV', 'ERROR', 'FIXING', 'FIX_ABANDONED',
  'FIX_INCOMPLETE', 'REGRESSION_DETECTED', 'FIX_VERIFIED', 'RESOLVED',
];
for (const s of REQUIRED_STATES) check(records.some((r) => r.state === s), `no record in state ${s}`);
check(records.some((r) => r.state === 'CONFIRMED' && r.triage.bisect?.status === 'found'), 'CONFIRMED with bisect found');
check(records.some((r) => r.state === 'NEEDS_INFO' && r.triage.repro?.trials > 0 && r.triage.repro.failed === 0), 'NEEDS_INFO with the bound line');
check(records.some((r) => r.state === 'NEEDS_INFO' && !r.triage.repro), 'NEEDS_INFO without the bound line');
const lastV = (r) => r.fix?.iterations.at(-1)?.verification;
check(records.some((r) => r.state === 'FIX_VERIFIED' && lastV(r)?.repro.evidence === 'strong'), 'FIX_VERIFIED strong');
check(records.some((r) => r.state === 'FIX_VERIFIED' && lastV(r)?.repro.evidence === 'limited'), 'FIX_VERIFIED limited');
check(records.some((r) => r.state === 'RESOLVED' && r.resolution_note === 'merged without passing verification'), 'RESOLVED without passing verification');
check(records.some((r) => r.state === 'RESOLVED' && r.resolution_note === ''), 'RESOLVED normally');
check(records.some((r) => r.state === 'REGRESSION_DETECTED' && lastV(r)?.regression.blocking.some((b) => b.class === 'REMOVED')), 'REGRESSION_DETECTED with a REMOVED test');
check(records.some((r) => {
  const src = new Set((r.fix?.iterations ?? []).map((i) => i.source));
  return src.has('bob') && src.has('human');
}), 'one issue with a bob and a human fix iteration');

// PR numbers never collide with issue numbers.
const issueNumbers = new Set(records.map((r) => r.issue));
for (const r of records) for (const it of r.fix?.iterations ?? []) check(it.pr === null || !issueNumbers.has(it.pr), `PR #${it.pr} collides with an issue number`);

// --- the S7 record (security fixture, not part of the sample set) -----------

const PAYLOAD = '<img src=x onerror=alert(1)>';
const s7 = finish(base(31, PAYLOAD, '2026-09-25T03:00:00Z'), {
  state: 'NEEDS_INFO',
  triage: triage({
    verdict: 'NEEDS_INFO', started: '2026-09-25T03:00:10Z', finished: '2026-09-25T03:01:00Z',
    fingerprint: { component: 'unknown', functions: [], symptom: `<script>alert(2)</script>`, trigger: PAYLOAD, expected: '', actual: '', error_signature: '' },
    duplicate: null,
    question: `What does "${PAYLOAD}" mean in <b>your</b> report?`,
  }),
  cost: cost([task('intake', 31, 3900, 210, 2, 11000)]),
  events: [
    { at: '2026-09-25T03:00:10Z', type: 'triage.started', detail: '<a href="javascript:alert(3)">click</a>' },
    { at: '2026-09-25T03:01:00Z', type: 'triage.verdict', detail: `${PAYLOAD} could not be reproduced.` },
  ],
});

// --- validate and write -------------------------------------------------------

function writeSet(dir, set) {
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith('.json')) rmSync(join(dir, f));
  for (const r of set) {
    const v = validate('issue-record', r);
    check(v.valid, `#${r.issue} does not match the schema:\n  ${v.errors.join('\n  ')}`);
    writeFileSync(join(dir, `${r.issue}.json`), `${JSON.stringify(r, null, 2)}\n`);
  }
}

writeSet(SAMPLE_DIR, records);
writeSet(SECURITY_DIR, [s7]);
console.log(`Wrote ${records.length} sample records to ${SAMPLE_DIR} and 1 security record to ${SECURITY_DIR}.`);
console.log(`States: ${[...new Set(records.map((r) => r.state))].join(', ')}`);

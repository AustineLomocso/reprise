// Every worked example in docs/kit/02-specs/statistics.md, to 4 decimal places.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALPHA, Z, wilson, zeroFailureBound, requiredRuns, formatPercent, formatInterval, claimSentence, boundSentence,
} from '../../src/stats/index.js';

const r4 = (x: number) => Number(x.toFixed(4));

test('constants', () => {
  assert.equal(Z, 1.959963984540054);
  assert.equal(ALPHA, 0.05);
});

test('Wilson interval, n = 20 (section 3)', () => {
  const table: [number, number, number, number][] = [
    [20, 1.0, 0.8389, 1.0],
    [19, 0.95, 0.7639, 0.9911],
    [10, 0.5, 0.2993, 0.7007],
    [4, 0.2, 0.0807, 0.416],
    [1, 0.05, 0.0089, 0.2361],
    [0, 0.0, 0.0, 0.1611],
  ];
  for (const [k, rate, low, high] of table) {
    const w = wilson(k, 20);
    assert.equal(r4(w.rate), rate, `rate k=${k}`);
    assert.equal(r4(w.low), low, `low k=${k}`);
    assert.equal(r4(w.high), high, `high k=${k}`);
  }
});

test('Wilson interval rejects impossible inputs', () => {
  assert.throws(() => wilson(1, 0), RangeError);
  assert.throws(() => wilson(3, 2), RangeError);
  assert.throws(() => wilson(-1, 2), RangeError);
  assert.throws(() => wilson(1.5, 2), RangeError);
});

test('zero-failure upper bound (section 4)', () => {
  assert.equal(r4(zeroFailureBound(3)), 0.6316);
  assert.equal(r4(zeroFailureBound(20)), 0.1391);
  assert.equal(r4(zeroFailureBound(36)), 0.0798);
  assert.throws(() => zeroFailureBound(0), RangeError);
});

test('runs required to verify a fix (section 5)', () => {
  const table: [number, number, number, number, boolean][] = [
    // k of 20, r (Wilson low), raw, used, capped
    [20, 0.8389, 2, 3, false],
    [19, 0.7639, 3, 3, false],
    [10, 0.2993, 9, 9, false],
    [4, 0.0807, 36, 36, false],
    [1, 0.0089, 336, 200, true],
  ];
  for (const [k, r, raw, used, capped] of table) {
    const low = wilson(k, 20).low;
    assert.equal(r4(low), r, `r for ${k}/20`);
    const req = requiredRuns(low, ALPHA, 3, 200);
    assert.deepEqual(req, { required: used, raw, capped }, `${k}/20`);
  }
  assert.deepEqual(requiredRuns(1), { required: 3, raw: 3, capped: false });
  assert.equal(requiredRuns(0).capped, true);
});

test('the 4/20 check in section 6: (1 - 0.0807)^36 < 0.05', () => {
  const r = wilson(4, 20).low;
  const p = Math.pow(1 - r, 36);
  assert.equal(Number(p.toFixed(3)), 0.048);
  assert.ok(p < ALPHA);
});

test('display rounding (section 7)', () => {
  assert.equal(formatPercent(0.2), '20.0%');
  const w = wilson(4, 20);
  assert.equal(formatInterval(w.low, w.high), '8.1%–41.6%');
});

test('claim sentence, strong evidence (section 6)', () => {
  const r = wilson(4, 20).low;
  const req = requiredRuns(r);
  assert.equal(
    claimSentence(r, req.required, req),
    'If this bug were still present at its triage rate (at least 8.1%), the chance of 36 clean runs would be below 5%.',
  );
});

test('claim sentence, limited evidence (section 6): 1/20 capped at 200', () => {
  const r = wilson(1, 20).low;
  const req = requiredRuns(r);
  assert.equal(r4(zeroFailureBound(200)), 0.0149);
  assert.equal(
    claimSentence(r, req.required, req),
    "200 clean runs rule out failure rates above 1.5%. The bug's triage rate may be as low as 0.9%, so this is limited evidence. Consider more runs with `/reprise verify`.",
  );
});

test('NEEDS_INFO bound line (section 4)', () => {
  assert.equal(
    boundSentence(20),
    'The test never failed in 20 runs, so if this bug exists here it happens in fewer than about 13.9% of runs.',
  );
});

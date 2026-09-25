// verdictFromTrials: docs/kit/02-specs/statistics.md sections 1 and 2, one test per branch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictFromTrials, trialSymbol } from '../../src/stats/index.js';
import type { TrialOutcome } from '../../src/types.js';

const P: TrialOutcome = 'PASS';
const F: TrialOutcome = 'FAIL_MATCH';
const O: TrialOutcome = 'FAIL_OTHER';
const E: TrialOutcome = 'ERROR';
const times = (o: TrialOutcome, n: number) => Array<TrialOutcome>(n).fill(o);

test('symbols: P, F, and X for both invalid outcomes', () => {
  assert.equal(trialSymbol(P), 'P');
  assert.equal(trialSymbol(F), 'F');
  assert.equal(trialSymbol(O), 'X');
  assert.equal(trialSymbol(E), 'X');
});

test('k = n: CONFIRMED', () => {
  const r = verdictFromTrials(times(F, 20));
  assert.equal(r.verdict, 'CONFIRMED');
  assert.equal(r.sequence, 'F'.repeat(20));
  assert.equal(r.rate, 1);
  assert.equal(Number(r.wilson_low!.toFixed(4)), 0.8389);
});

test('0 < k < n: FLAKY, sequence kept in run order', () => {
  const outcomes = [F, P, P, F, P, P, P, P, F, P, P, P, P, P, F, P, P, P, P, P];
  const r = verdictFromTrials(outcomes);
  assert.equal(r.verdict, 'FLAKY');
  assert.equal(r.sequence, 'FPPFPPPPFPPPPPFPPPPP');
  assert.equal(r.failed, 4);
  assert.equal(r.valid, 20);
  assert.equal(Number(r.wilson_low!.toFixed(4)), 0.0807);
  assert.equal(Number(r.wilson_high!.toFixed(4)), 0.416);
});

test('k = 0: NEEDS_INFO', () => {
  const r = verdictFromTrials(times(P, 20));
  assert.equal(r.verdict, 'NEEDS_INFO');
  assert.equal(r.rate, 0);
});

test('invalid trials do not count as failures: n = P + F', () => {
  const r = verdictFromTrials([...times(F, 18), O, E]);
  assert.equal(r.verdict, 'CONFIRMED');
  assert.equal(r.valid, 18);
  assert.equal(r.invalid, 2);
  assert.equal(r.sequence, `${'F'.repeat(18)}XX`);
});

test('exactly 10% invalid (2 of 20) is still stable', () => {
  const r = verdictFromTrials([...times(P, 10), ...times(F, 8), E, E]);
  assert.equal(r.unstable, false);
  assert.equal(r.verdict, 'FLAKY');
});

test('more than 10% invalid (3 of 20) is unstable: no verdict', () => {
  const r = verdictFromTrials([...times(F, 17), O, E, E]);
  assert.equal(r.unstable, true);
  assert.equal(r.verdict, null);
  assert.equal(r.rate, null);
});

test('no trials is an error', () => {
  assert.throws(() => verdictFromTrials([]), RangeError);
});

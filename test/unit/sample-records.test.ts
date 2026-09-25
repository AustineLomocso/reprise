// Sample records (ADR-13): every record validates, every required state is covered, and every
// statistic equals what src/stats computes from the stored observations.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validate } from '../../src/schemas.js';
import { wilson, requiredRuns, verdictFromTrials, claimSentence } from '../../src/stats/index.js';
import { scoreFingerprints } from '../../src/triage/dedupe-score.js';
import type { IssueRecord, TrialOutcome } from '../../src/types.js';

const dir = new URL('../../../test/fixtures/sample-records/issues/', import.meta.url);
const records: IssueRecord[] = readdirSync(dir).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as IssueRecord);
const OUTCOME: Record<string, TrialOutcome> = { P: 'PASS', F: 'FAIL_MATCH', X: 'ERROR' };

test('every sample record validates against the issue-record schema', () => {
  assert.ok(records.length >= 17);
  for (const r of records) assert.deepEqual(validate('issue-record', r).errors, [], `#${r.issue}`);
});

test('file names match issue numbers and every record is sample-repo data', () => {
  for (const f of readdirSync(dir)) {
    const r = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as IssueRecord;
    assert.equal(f, `${r.issue}.json`);
    assert.equal(r.repo, 'AustineLomocso/reprise-demo-shop');
  }
});

test('every state named in the slice brief is covered', () => {
  const states = new Set(records.map((r) => r.state));
  for (const s of ['TRIAGING', 'CONFIRMED', 'FLAKY', 'DUPLICATE', 'NEEDS_INFO', 'BLOCKED_ENV', 'ERROR', 'FIXING', 'FIX_ABANDONED',
    'FIX_INCOMPLETE', 'REGRESSION_DETECTED', 'FIX_VERIFIED', 'RESOLVED'] as const) {
    assert.ok(states.has(s), s);
  }
  const lastV = (r: IssueRecord) => r.fix?.iterations.at(-1)?.verification ?? null;
  assert.ok(records.some((r) => r.state === 'CONFIRMED' && r.triage.bisect?.status === 'found'));
  assert.ok(records.some((r) => r.state === 'FLAKY' && r.triage.repro?.wilson_low !== null));
  assert.ok(records.some((r) => r.state === 'DUPLICATE' && Object.keys(r.triage.duplicate?.fields ?? {}).length === 5));
  assert.ok(records.some((r) => r.state === 'NEEDS_INFO' && (r.triage.repro?.trials ?? 0) > 0 && r.triage.repro!.failed === 0));
  assert.ok(records.some((r) => r.state === 'NEEDS_INFO' && r.triage.repro === null));
  assert.ok(records.some((r) => r.state === 'REGRESSION_DETECTED' && lastV(r)!.regression.blocking.some((b) => b.class === 'REMOVED')));
  assert.ok(records.some((r) => r.state === 'FIX_VERIFIED' && lastV(r)!.repro.evidence === 'strong'));
  assert.ok(records.some((r) => r.state === 'FIX_VERIFIED' && lastV(r)!.repro.evidence === 'limited'));
  assert.ok(records.some((r) => r.state === 'RESOLVED' && r.resolution_note === ''));
  assert.ok(records.some((r) => r.state === 'RESOLVED' && r.resolution_note === 'merged without passing verification'));
  assert.ok(records.some((r) => {
    const s = new Set((r.fix?.iterations ?? []).map((i) => i.source));
    return s.has('bob') && s.has('human');
  }));
});

test('triage statistics equal src/stats applied to the stored sequence', () => {
  for (const r of records) {
    const rp = r.triage.repro;
    if (!rp || rp.trials === 0) continue;
    const res = verdictFromTrials([...rp.sequence].map((c) => OUTCOME[c]!));
    assert.equal(rp.trials, res.trials, `#${r.issue}`);
    assert.equal(rp.failed, res.failed, `#${r.issue}`);
    assert.equal(rp.invalid, res.invalid, `#${r.issue}`);
    assert.equal(rp.rate, res.rate, `#${r.issue}`);
    assert.equal(rp.wilson_low, res.wilson_low, `#${r.issue}`);
    assert.equal(rp.wilson_high, res.wilson_high, `#${r.issue}`);
    if (r.triage.verdict) assert.equal(r.triage.verdict, res.verdict, `#${r.issue}`);
    else assert.ok(res.unstable, `#${r.issue} has no verdict, so its trials must be unstable`);
  }
});

test('verification run counts, evidence and claims equal src/stats', () => {
  for (const r of records) {
    for (const it of r.fix?.iterations ?? []) {
      const v = it.verification;
      if (!v) continue;
      const low = r.triage.repro!.wilson_low!;
      assert.equal(low, wilson(r.triage.repro!.failed, r.triage.repro!.trials - r.triage.repro!.invalid).low);
      const req = requiredRuns(low);
      assert.equal(v.repro.runs_required, req.required, `#${r.issue}`);
      const clean = v.repro.failed === 0 && v.repro.invalid === 0;
      assert.equal(v.repro.evidence, clean ? (req.capped ? 'limited' : 'strong') : null, `#${r.issue}`);
      assert.equal(v.repro.claim, clean ? claimSentence(low, v.repro.runs, req) : '', `#${r.issue}`);
      const total = Object.values(v.regression.counts).reduce((a, b) => a + b, 0);
      assert.equal(v.regression.tests_total, total, `#${r.issue}`);
    }
  }
});

test('the duplicate score equals the dedupe function applied to the two fingerprints', () => {
  for (const r of records.filter((x) => x.state === 'DUPLICATE')) {
    const d = r.triage.duplicate!;
    const original = records.find((x) => x.issue === d.of)!;
    const s = scoreFingerprints(r.triage.fingerprint!, original.triage.fingerprint!);
    assert.equal(d.score, s.score);
    assert.deepEqual(d.fields, s.fields);
  }
});

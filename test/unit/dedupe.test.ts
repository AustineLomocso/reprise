// Dedupe scoring: docs/kit/02-specs/triage-pipeline.md section 3 (test-strategy.md "Dedupe scoring").

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, jaccard, scoreFingerprints, isCandidate, DEDUPE_THRESHOLD } from '../../src/triage/dedupe-score.js';
import type { Fingerprint } from '../../src/types.js';

const fp = (over: Partial<Fingerprint>): Fingerprint => ({
  component: '', functions: [], symptom: '', trigger: '', expected: '', actual: '', error_signature: '', ...over,
});

test('normalisation: lowercase, non-alphanumerics, camelCase, length-1 tokens and stopwords', () => {
  assert.deepEqual([...normalise('applyBulkDiscount is NOT applied at qty=10, a b')].sort(), ['10', 'applied', 'apply', 'bulk', 'discount', 'not', 'qty']);
  assert.deepEqual([...normalise('HTTPServer error')].sort(), ['error', 'http', 'server']);
  assert.equal(normalise('the of to a').size, 0);
});

test('jaccard', () => {
  assert.equal(jaccard(new Set(['a', 'b']), new Set(['b', 'c'])), 1 / 3);
  assert.equal(jaccard(new Set(), new Set()), 0);
});

test('component: 1 only if equal and not unknown', () => {
  assert.equal(scoreFingerprints(fp({ component: 'pricing' }), fp({ component: 'pricing' })).fields.component, 1);
  assert.equal(scoreFingerprints(fp({ component: 'unknown' }), fp({ component: 'unknown' })).fields.component, 0);
  assert.equal(scoreFingerprints(fp({ component: 'cart' }), fp({ component: 'pricing' })).fields.component, 0);
});

test('functions compare exactly and case-sensitively', () => {
  const s = scoreFingerprints(fp({ functions: ['reserve', 'get'] }), fp({ functions: ['Reserve', 'get'] }));
  assert.equal(s.fields.functions, 1 / 3);
});

test('empty fields are not counted and the weights renormalise', () => {
  const s = scoreFingerprints(fp({ component: 'pricing', symptom: 'bulk discount' }), fp({ component: 'pricing', symptom: '' }));
  assert.deepEqual(s.fields, { component: 1, functions: null, symptom: null, trigger: null, error_signature: null });
  assert.equal(s.score, 1); // 0.20 * 1 / 0.20
  assert.equal(scoreFingerprints(fp({}), fp({})).score, null);
});

test('weighted sum: component 0.20, functions 0.30, symptom 0.20, trigger 0.15, error 0.15', () => {
  const a = fp({ component: 'x', functions: ['f'], symptom: 'one two', trigger: 'three four', error_signature: 'five six' });
  const b = fp({ component: 'x', functions: ['g'], symptom: 'one two', trigger: 'three nine', error_signature: 'seven eight' });
  const s = scoreFingerprints(a, b);
  const expected = 0.2 * 1 + 0.3 * 0 + 0.2 * 1 + 0.15 * (1 / 3) + 0.15 * 0;
  assert.ok(Math.abs(s.score! - expected) < 1e-12);
});

test('threshold edge: exactly 0.60 is a candidate, just below is not', () => {
  assert.equal(DEDUPE_THRESHOLD, 0.6);
  // component 1 (0.20) and functions 1/3 (0.30 * 1/3 = 0.10) over weights 0.50 = 0.60.
  const s = scoreFingerprints(fp({ component: 'c', functions: ['a', 'b'] }), fp({ component: 'c', functions: ['a', 'x'] }));
  assert.ok(Math.abs(s.score! - 0.6) < 1e-12);
  assert.equal(isCandidate(s.score), true);
  assert.equal(isCandidate(0.5999), false);
  assert.equal(isCandidate(null), false);
});

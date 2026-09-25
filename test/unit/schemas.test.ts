// Schemas: the examples in data-contracts.md validate; unknown enum values and fields fail.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, SCHEMA_NAMES } from '../../src/schemas.js';

const md = readFileSync(new URL('../../../docs/kit/02-specs/data-contracts.md', import.meta.url), 'utf8');

/** The first ```json block after `heading`, with the "ISO-8601" placeholders replaced by a real timestamp. */
function example(heading: string): Record<string, unknown> {
  const from = md.indexOf(heading);
  assert.ok(from >= 0, `heading ${heading}`);
  const block = /```json\n([\s\S]*?)```/.exec(md.slice(from))![1]!;
  return JSON.parse(block.replaceAll('"ISO-8601"', '"2026-09-25T10:00:00Z"')) as Record<string, unknown>;
}

test('every schema compiles', () => {
  for (const name of SCHEMA_NAMES) validate(name, {});
});

test('the issue record example in data-contracts.md validates', () => {
  assert.deepEqual(validate('issue-record', example('## Issue record')).errors, []);
});

test('the site index example in data-contracts.md validates (placeholder strings filled in)', () => {
  const idx = example('## Site index');
  const entry = (idx['issues'] as Record<string, unknown>[])[0]!;
  // The example leaves these as "" placeholders; they are enums and a timestamp.
  Object.assign(entry, { state: 'FIX_VERIFIED', verdict: 'CONFIRMED', updated_at: '2026-09-25T10:00:00Z' });
  assert.deepEqual(validate('site-index', idx).errors, []);
});

test('an unknown enum value fails', () => {
  const rec = example('## Issue record');
  rec['state'] = 'FIXED';
  const r = validate('issue-record', rec);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.startsWith('/state')));
  const idx = example('## Site index');
  idx['data_source'] = 'demo';
  assert.equal(validate('site-index', idx).valid, false);
});

test('an unknown field fails', () => {
  const rec = example('## Issue record');
  (rec['triage'] as Record<string, unknown>)['severity'] = 'high';
  const r = validate('issue-record', rec);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("'severity'")));
});

test('null values allowed by "Absent and null values" validate', () => {
  const rec = example('## Issue record');
  rec['state'] = 'TRIAGING';
  const t = rec['triage'] as Record<string, unknown>;
  for (const k of ['verdict', 'finished_at', 'duration_ms', 'repro', 'bisect', 'root_cause', 'duplicate']) t[k] = null;
  delete rec['fix'];
  assert.deepEqual(validate('issue-record', rec).errors, []);
});

test('array caps are enforced (events 200)', () => {
  const rec = example('## Issue record');
  rec['events'] = Array.from({ length: 201 }, () => ({ at: '2026-09-25T10:00:00Z', type: 'error', detail: '' }));
  assert.equal(validate('issue-record', rec).valid, false);
});

test('stage output schemas accept the spec examples and reject bad kinds', () => {
  assert.deepEqual(validate('dedupe-confirm', { same_bug: true, reason: 'same comparison' }).errors, []);
  assert.deepEqual(
    validate('repro', {
      test_file: 'test/reprise/issue-1.test.js',
      signature: { kind: 'assertion_message', pattern: 'expected 225000' },
      rationale: '',
    }).errors,
    [],
  );
  assert.deepEqual(validate('fix', { summary: 's', files_changed: ['src/pricing.js'], risk_notes: '', tests_added: [] }).errors, []);
  const tp = readFileSync(new URL('../../../docs/kit/02-specs/triage-pipeline.md', import.meta.url), 'utf8');
  const blocks = [...tp.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]!) as unknown);
  assert.deepEqual(validate('intake', blocks[0]).errors, []);
  assert.deepEqual(validate('rootcause', blocks[1]).errors, []);
  assert.equal(validate('repro', { test_file: 'x', signature: { kind: 'regex', pattern: '' }, rationale: '' }).valid, false);
});

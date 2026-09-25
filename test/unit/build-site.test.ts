// build-site: index generation, medians over records that have the value, a failing build on an
// invalid record, data_source (ADR-13), and the CLI wiring.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, buildSite, median, BuildSiteError } from '../../src/site/build-site.js';
import { validate } from '../../src/schemas.js';
import { main, type Io } from '../../src/commands.js';
import type { IssueRecord } from '../../src/types.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const SAMPLES = join(root, 'test/fixtures/sample-records');
const ASSETS = join(root, 'dashboard');

async function sampleRecords(): Promise<IssueRecord[]> {
  const dir = join(SAMPLES, 'issues');
  const names = await readdir(dir);
  return Promise.all(names.map(async (n) => JSON.parse(await readFile(join(dir, n), 'utf8')) as IssueRecord));
}

async function tempDir() {
  return mkdtemp(join(tmpdir(), 'reprise-site-'));
}

function minimalRecord(issue: number, over: Partial<IssueRecord> = {}): IssueRecord {
  return {
    schema: 1, repo: 'o/r', issue, title: `t${issue}`, url: `https://github.com/o/r/issues/${issue}`, provider: 'claude',
    state: 'TRIAGING', created_at: '2026-09-25T00:00:00Z', updated_at: '2026-09-25T00:00:00Z', triage_runs: 1, auto_retriage_count: 0,
    triage: {
      verdict: null, started_at: '2026-09-25T00:00:00Z', finished_at: null, duration_ms: null, fingerprint: null, duplicate: null,
      question: '', baseline_suite: null, repro: null, bisect: null, root_cause: null,
    },
    resolution_note: '',
    cost: { bobcoins_total: 0, by_stage: { intake: 0, dedupe: 0, repro: 0, rootcause: 0, fix: 0 }, bob_tasks: [] },
    events: [],
    ...over,
  };
}

const task = (stage: 'intake' | 'repro' | 'fix', input: number, output: number, session_costs = 0) => ({
  stage, task_id: 'x', session_costs, duration_ms: 1, total_tokens: input + output, input_tokens: input, output_tokens: output, tool_calls: 0,
});

test('median', () => {
  assert.equal(median([]), null);
  assert.equal(median([5]), 5);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test('medians are computed only over records that have the value', () => {
  const withTime = (n: number, ms: number | null) => {
    const r = minimalRecord(n);
    r.triage.duration_ms = ms;
    return r;
  };
  const records = [withTime(1, 60_000), withTime(2, null), withTime(3, 180_000), withTime(4, null)];
  records[0]!.cost.bob_tasks = [task('intake', 100, 10), task('repro', 1000, 100), task('fix', 50_000, 5_000)];
  records[2]!.cost.bob_tasks = [task('intake', 300, 30)];
  records[3]!.cost.bob_tasks = [task('fix', 9_999, 1)]; // no triage-stage task: excluded from the median
  const idx = buildIndex(records, { repo: 'o/r', dataSource: 'live', generatedAt: '2026-09-25T00:00:00Z' });
  assert.equal(idx.totals.median_time_to_verdict_ms, 120_000); // over 60 000 and 180 000 only
  assert.equal(idx.totals.median_tokens_per_triage, (1210 + 330) / 2); // triage stages only, fix excluded
  assert.equal(idx.totals.median_bobcoins_per_triage, null); // no bob-provider records
  assert.equal(idx.issues[0]!.tokens_total, 1210 + 55_000);
  assert.equal(idx.issues[3]!.tokens_total, 10_000);
});

test('Bobcoin median uses only records written by the bob provider', () => {
  const a = minimalRecord(1, { provider: 'bob' });
  a.cost.bob_tasks = [task('intake', 1, 1, 0.5), task('repro', 1, 1, 2)];
  const b = minimalRecord(2);
  b.cost.bob_tasks = [task('intake', 1, 1)];
  const idx = buildIndex([a, b], { repo: 'o/r', dataSource: 'live', generatedAt: '2026-09-25T00:00:00Z' });
  assert.equal(idx.totals.median_bobcoins_per_triage, 2.5);
});

test('index from the sample records: totals, ordering, provider, data_source, schema', async () => {
  const records = await sampleRecords();
  const idx = buildIndex(records, { repo: 'AustineLomocso/reprise-demo-shop', dataSource: 'sample', generatedAt: '2026-09-25T00:00:00Z' });
  assert.deepEqual(validate('site-index', idx).errors, []);
  assert.equal(idx.data_source, 'sample');
  assert.equal(idx.provider, 'claude');
  assert.equal(idx.totals.issues, records.length);
  assert.deepEqual(idx.issues.map((e) => e.issue), [...idx.issues.map((e) => e.issue)].sort((x, y) => x - y));
  const verifications = records.flatMap((r) => (r.fix?.iterations ?? []).flatMap((i) => (i.verification ? [i.verification] : [])));
  assert.equal(idx.totals.fixes_verified, verifications.filter((v) => v.verdict === 'FIX_VERIFIED').length);
  assert.equal(idx.totals.regressions_caught, verifications.filter((v) => v.verdict === 'REGRESSION_DETECTED').length);
  const bulk = idx.issues.find((e) => e.issue === 1)!;
  assert.equal(bulk.pr, 7); // last iteration with a PR
  assert.equal(bulk.verdict, 'CONFIRMED');
  const triaging = idx.issues.find((e) => e.state === 'TRIAGING')!;
  assert.equal(triaging.verdict, null);
  assert.equal(triaging.sequence, null);
  assert.equal(triaging.rate, null);
  const sum = Object.values(idx.totals.by_state).reduce((a, b) => a + b, 0);
  assert.equal(sum, records.length);
});

test('buildSite writes the site, copies records verbatim and validates the index', async () => {
  const out = join(await tempDir(), 'site');
  const res = await buildSite({ dataDir: SAMPLES, outDir: out, dataSource: 'sample', assetsDir: ASSETS, generatedAt: '2026-09-25T00:00:00Z' });
  assert.equal(res.records, 17);
  for (const f of ['index.html', 'app.js', 'format.js', 'styles.css', 'favicon.svg', 'fonts/LICENSE.txt', 'fonts/IBMPlexSans-Regular.woff2']) {
    await readFile(join(out, f));
  }
  const index = JSON.parse(await readFile(join(out, 'data/index.json'), 'utf8'));
  assert.equal(index.data_source, 'sample');
  assert.equal(
    await readFile(join(out, 'data/issues/2.json'), 'utf8'),
    await readFile(join(SAMPLES, 'issues/2.json'), 'utf8'),
  );
  await rm(join(out, '..'), { recursive: true, force: true });
});

test('an invalid record fails the build and nothing is written', async () => {
  const dir = await tempDir();
  const data = join(dir, 'data');
  await mkdir(join(data, 'issues'), { recursive: true });
  await writeFile(join(data, 'issues/1.json'), JSON.stringify(minimalRecord(1)));
  await writeFile(join(data, 'issues/2.json'), JSON.stringify({ ...minimalRecord(2), state: 'FIXED' }));
  await writeFile(join(data, 'issues/3.json'), JSON.stringify(minimalRecord(4)));
  await writeFile(join(data, 'issues/notes.json'), '{}');
  const out = join(dir, 'site');
  await assert.rejects(buildSite({ dataDir: data, outDir: out, dataSource: 'live', assetsDir: ASSETS }), (e: unknown) => {
    assert.ok(e instanceof BuildSiteError);
    const all = e.details.join('\n');
    assert.match(all, /2\.json: \/state/);
    assert.match(all, /3\.json: file name does not match/);
    assert.match(all, /notes\.json: file name must be/);
    return true;
  });
  await assert.rejects(readFile(join(out, 'index.html')));
  await rm(dir, { recursive: true, force: true });
});

test('no issues directory means an empty site; the repository comes from the fallback', async () => {
  const dir = await tempDir();
  const out = join(dir, 'site');
  await assert.rejects(buildSite({ dataDir: dir, outDir: out, dataSource: 'live', assetsDir: ASSETS }), BuildSiteError);
  const res = await buildSite({ dataDir: dir, outDir: out, dataSource: 'live', assetsDir: ASSETS, fallbackRepo: 'o/r' });
  assert.equal(res.index.issues.length, 0);
  assert.equal(res.index.provider, null);
  assert.equal(res.index.data_source, 'live');
  assert.deepEqual(validate('site-index', res.index).errors, []);
  await rm(dir, { recursive: true, force: true });
});

test('records from two repositories fail the build', async () => {
  const dir = await tempDir();
  await mkdir(join(dir, 'issues'));
  await writeFile(join(dir, 'issues/1.json'), JSON.stringify(minimalRecord(1)));
  await writeFile(join(dir, 'issues/2.json'), JSON.stringify(minimalRecord(2, { repo: 'o/other', url: 'https://github.com/o/other/issues/2' })));
  await assert.rejects(buildSite({ dataDir: dir, outDir: join(dir, 'site'), dataSource: 'live', assetsDir: ASSETS }), /more than one repository/);
  await rm(dir, { recursive: true, force: true });
});

test('refuses an output directory that contains the data or the working directory', async () => {
  const dir = await tempDir();
  await assert.rejects(buildSite({ dataDir: join(dir, 'data'), outDir: dir, dataSource: 'live', assetsDir: ASSETS, fallbackRepo: 'o/r' }), /refusing/);
  await assert.rejects(buildSite({ dataDir: SAMPLES, outDir: root, dataSource: 'live', assetsDir: ASSETS }), /refusing/);
  await rm(dir, { recursive: true, force: true });
});

test('CLI: build-site defaults to live and reports failures with exit 1', async () => {
  const dir = await tempDir();
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = { out: (t) => out.push(t), err: (t) => err.push(t), env: {} };
  const { runBuildSite } = await import('../../src/site/command.js');
  assert.equal(await runBuildSite({ data: SAMPLES, out: join(dir, 'site'), dataSource: 'live' }, io, ASSETS), 0);
  const index = JSON.parse(await readFile(join(dir, 'site/data/index.json'), 'utf8'));
  assert.equal(index.data_source, 'live');
  assert.equal(await main(['build-site', '--data', join(dir, 'missing'), '--out', join(dir, 'site2')], io), 1);
  assert.match(err.join('\n'), /GITHUB_REPOSITORY/);
  await rm(dir, { recursive: true, force: true });
});

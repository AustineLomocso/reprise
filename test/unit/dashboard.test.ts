// Dashboard static checks: security T8 (textContent only, exact CSP, no external requests),
// the display names table, and parity of the dashboard's formatting with src/stats.
// The S7 browser check (an HTML payload title rendered as text, no CSP violation) is recorded
// in docs/kit/05-quality/ui-review.md; here the S7 record is checked to reach the site verbatim.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatPercent, formatInterval, zeroFailureBound, boundSentence, wilson } from '../../src/stats/index.js';
import { buildSite } from '../../src/site/build-site.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dash = (f: string) => readFileSync(join(root, 'dashboard', f), 'utf8');
const textFiles = readdirSync(join(root, 'dashboard')).filter((f) => /\.(html|js|css|svg)$/.test(f));

interface FormatModule {
  DISPLAY: Record<string, string>;
  formatPercent(x: number): string;
  formatInterval(a: number, b: number): string;
  zeroFailureBound(n: number): number;
  boundSentence(n: number): string;
  stripSummary(cells: string, ordered: boolean): string;
  cellText(symbol: string, run: number, ordered: boolean): string;
  groupedCells(runs: number, failed: number, invalid: number): string;
  displayState(state: string, of?: number | null): string;
}

const format = (await import(new URL('../../../dashboard/format.js', import.meta.url).href)) as FormatModule;

test('CSP meta tag is exactly the one in dashboard.md', () => {
  const spec = readFileSync(join(root, 'docs/kit/02-specs/dashboard.md'), 'utf8');
  const csp = /Content-Security-Policy meta: `([^`]+)`/.exec(spec)![1]!;
  const html = dash('index.html');
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
  assert.equal(m?.[1], csp);
  assert.match(html, /<html lang="en">/);
});

test('no HTML-parsing DOM APIs, eval or inline handlers anywhere in the dashboard', () => {
  const forbidden = [/innerHTML/, /outerHTML/, /insertAdjacentHTML/, /document\.write/, /\beval\s*\(/, /new Function/, /\bon[a-z]+\s*=\s*["']/i, /setAttribute\(\s*['"]on/i, /\.style\b/];
  for (const f of textFiles) {
    const src = dash(f);
    for (const re of forbidden) assert.doesNotMatch(src, re, `${f} matches ${re}`);
  }
});

test('no inline scripts or styles in index.html', () => {
  const html = dash('index.html');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/);
  assert.doesNotMatch(html, /<style/);
  assert.doesNotMatch(html, /\sstyle="/);
});

test('no external requests: every URL in the dashboard sources is relative or a github.com link', () => {
  for (const f of textFiles) {
    const src = dash(f);
    for (const m of src.matchAll(/(?:src|href)=["']([^"']+)["']|url\(["']?([^"')]+)["']?\)|fetch\(\s*[`'"]([^`'"]+)/g)) {
      const u = m[1] ?? m[2] ?? m[3] ?? '';
      if (u.startsWith('#')) continue;
      assert.doesNotMatch(u, /^[a-z]+:\/\//i, `${f}: ${u}`);
      assert.doesNotMatch(u, /^\/\//, `${f}: ${u}`);
    }
    // http(s) strings may only be GitHub or the SVG namespace.
    for (const m of src.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
      assert.match(m[0], /^(https:\/\/github\.com\/|http:\/\/www\.w3\.org\/2000\/svg)/, `${f}: ${m[0]}`);
    }
  }
});

test('display names match dashboard.md', () => {
  const spec = readFileSync(join(root, 'docs/kit/02-specs/dashboard.md'), 'utf8');
  const table = spec.slice(spec.indexOf('## Display names'), spec.indexOf('## Trial strip component'));
  const rows = [...table.matchAll(/^\| `([A-Z_]+)` \| (.+?) \|$/gm)];
  assert.equal(rows.length, 14);
  for (const [, state, shown] of rows) assert.equal(format.DISPLAY[state!], shown, state);
  assert.equal(format.displayState('DUPLICATE', 1), 'Duplicate of #1');
});

test('empty, error and unknown-issue copy is exactly the spec text', () => {
  const app = dash('app.js');
  assert.ok(app.includes("The report data didn't load. Reload the page. If a deploy is in progress, it finishes within a few minutes."));
  assert.ok(app.includes('No reports yet. When a maintainer adds the reprise label to an issue in ${name}, it appears here within a few minutes.'));
  assert.ok(app.includes('There is no report #${n}. '));
  assert.ok(app.includes("'Go to all reports'"));
  assert.ok(dash('index.html').includes('<strong>Sample data.</strong> These reports illustrate how Reprise works; they were not produced by a live run.'));
});

test('dashboard formatting equals src/stats', () => {
  for (const x of [0, 0.0089, 0.05, 0.2, 0.416, 1]) assert.equal(format.formatPercent(x), formatPercent(x));
  const w = wilson(4, 20);
  assert.equal(format.formatInterval(w.low, w.high), formatInterval(w.low, w.high));
  for (const n of [3, 20, 36, 200]) {
    assert.equal(format.zeroFailureBound(n), zeroFailureBound(n));
    assert.equal(format.boundSentence(n), boundSentence(n));
  }
});

test('trial strip summaries and cell labels', () => {
  assert.equal(format.stripSummary('FPPFPPPPFPPPPPFPPPPP', true), 'Reproduced in 4 of 20 runs: runs 1, 4, 9 and 15');
  assert.equal(format.stripSummary('F'.repeat(20), true), 'Reproduced in 20 of 20 runs');
  assert.equal(format.stripSummary('P'.repeat(36), true), 'Reproduced in 0 of 36 runs');
  assert.equal(format.stripSummary('PFXP', true), 'Reproduced in 1 of 3 valid runs: run 2. Invalid: run 3');
  assert.equal(format.stripSummary('FFFPPPP', false), 'Reproduced in 3 of 7 runs; run order not recorded');
  assert.equal(format.cellText('F', 7, true), 'Run 7: reproduced');
  assert.equal(format.cellText('P', 2, false), 'Passed (run order not recorded)');
  assert.equal(format.groupedCells(9, 2, 1), 'FFXPPPPPP');
});

test('S7: the HTML payload record reaches the site as JSON text, unchanged', async () => {
  const out = await mkdtemp(join(tmpdir(), 'reprise-s7-'));
  await buildSite({ dataDir: join(root, 'test/fixtures/security'), outDir: join(out, 'site'), dataSource: 'live', assetsDir: join(root, 'dashboard') });
  const index = JSON.parse(await readFile(join(out, 'site/data/index.json'), 'utf8'));
  assert.equal(index.issues[0].title, '<img src=x onerror=alert(1)>');
  await rm(out, { recursive: true, force: true });
});

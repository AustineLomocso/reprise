// reprise build-site: docs/kit/02-specs/dashboard.md and data-contracts.md "Site index".
// Validates every record, copies the dashboard, copies the records, writes data/index.json.

import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { validate } from '../schemas.js';
import type { DataSource, IssueRecord, SiteIndex, SiteIndexEntry, Stage, State } from '../types.js';

const TRIAGE_STAGES: ReadonlySet<Stage> = new Set(['intake', 'dedupe', 'repro', 'rootcause']);
const RECORD_FILE = /^([1-9][0-9]*)\.json$/;

export class BuildSiteError extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'BuildSiteError';
  }
}

/** Median of the values; null for an empty list. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function tokensOf(tasks: IssueRecord['cost']['bob_tasks']): number {
  return tasks.reduce((sum, t) => sum + t.input_tokens + t.output_tokens, 0);
}

function lastPr(r: IssueRecord): number | null {
  const withPr = (r.fix?.iterations ?? []).filter((i) => i.pr !== null);
  return withPr.length ? withPr[withPr.length - 1]!.pr : null;
}

export function indexEntry(r: IssueRecord): SiteIndexEntry {
  return {
    issue: r.issue,
    title: r.title,
    state: r.state,
    verdict: r.triage.verdict,
    rate: r.triage.repro?.rate ?? null,
    sequence: r.triage.repro?.sequence ?? null,
    updated_at: r.updated_at,
    bobcoins_total: r.cost.bobcoins_total,
    tokens_total: tokensOf(r.cost.bob_tasks),
    pr: lastPr(r),
  };
}

export interface IndexOptions {
  repo: string;
  dataSource: DataSource;
  generatedAt: string;
}

/** Build data/index.json from validated records. Medians use only records that have the value. */
export function buildIndex(records: readonly IssueRecord[], opts: IndexOptions): SiteIndex {
  const sorted = [...records].sort((a, b) => a.issue - b.issue);
  const byState: Partial<Record<State, number>> = {};
  for (const r of sorted) byState[r.state] = (byState[r.state] ?? 0) + 1;

  const verdictTimes = sorted.flatMap((r) => (r.triage.duration_ms === null ? [] : [r.triage.duration_ms]));
  const triageTasks = (r: IssueRecord) => r.cost.bob_tasks.filter((t) => TRIAGE_STAGES.has(t.stage));
  const tokensPerTriage = sorted.flatMap((r) => {
    const tasks = triageTasks(r);
    return tasks.length ? [tokensOf(tasks)] : [];
  });
  // Under the Claude provider the Bobcoin fields are 0 by contract, not a measurement,
  // so only records written by the Bob provider count towards the Bobcoin median.
  const bobcoinsPerTriage = sorted.flatMap((r) => {
    const tasks = triageTasks(r);
    return r.provider === 'bob' && tasks.length ? [tasks.reduce((s, t) => s + t.session_costs, 0)] : [];
  });
  const verifications = sorted.flatMap((r) => (r.fix?.iterations ?? []).flatMap((i) => (i.verification ? [i.verification] : [])));

  const latest = [...sorted].sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.issue - a.issue)[0];

  return {
    generated_at: opts.generatedAt,
    repo: opts.repo,
    provider: latest ? latest.provider : null,
    data_source: opts.dataSource,
    totals: {
      issues: sorted.length,
      by_state: byState,
      median_time_to_verdict_ms: median(verdictTimes),
      median_bobcoins_per_triage: median(bobcoinsPerTriage),
      median_tokens_per_triage: median(tokensPerTriage),
      fixes_verified: verifications.filter((v) => v.verdict === 'FIX_VERIFIED').length,
      regressions_caught: verifications.filter((v) => v.verdict === 'REGRESSION_DETECTED').length,
    },
    issues: sorted.map(indexEntry),
  };
}

export interface LoadedRecord {
  file: string;
  record: IssueRecord;
  text: string;
}

/** Read and validate DATA/issues/*.json. A missing issues/ directory means no records yet. */
export async function loadRecords(dataDir: string): Promise<LoadedRecord[]> {
  const dir = join(dataDir, 'issues');
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const problems: string[] = [];
  const out: LoadedRecord[] = [];
  for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
    const file = join(dir, name);
    const m = RECORD_FILE.exec(name);
    if (!m) {
      problems.push(`${name}: file name must be <issue number>.json`);
      continue;
    }
    const text = await readFile(file, 'utf8');
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (err) {
      problems.push(`${name}: not valid JSON (${(err as Error).message})`);
      continue;
    }
    const v = validate('issue-record', data);
    if (!v.valid) {
      problems.push(...v.errors.map((e) => `${name}: ${e}`));
      continue;
    }
    const record = data as IssueRecord;
    if (record.issue !== Number(m[1])) {
      problems.push(`${name}: file name does not match "issue": ${record.issue}`);
      continue;
    }
    out.push({ file: name, record, text });
  }
  if (problems.length) {
    throw new BuildSiteError(`${problems.length} problem(s) in the issue records; nothing was built`, problems);
  }
  return out;
}

function inside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export interface BuildSiteOptions {
  dataDir: string;
  outDir: string;
  dataSource: DataSource;
  /** The dashboard/ directory to copy. */
  assetsDir: string;
  /** Used for the repository name when there are no records (GITHUB_REPOSITORY in Actions). */
  fallbackRepo?: string | undefined;
  generatedAt?: string;
}

export interface BuildSiteResult {
  index: SiteIndex;
  records: number;
}

export async function buildSite(opts: BuildSiteOptions): Promise<BuildSiteResult> {
  const out = resolve(opts.outDir);
  const data = resolve(opts.dataDir);
  const assets = resolve(opts.assetsDir);
  if (inside(data, out) || inside(assets, out) || inside(process.cwd(), out)) {
    throw new BuildSiteError(`refusing to replace ${opts.outDir}: it contains the data, the dashboard sources or the working directory`);
  }

  const loaded = await loadRecords(data);
  const records = loaded.map((l) => l.record);

  const repos = [...new Set(records.map((r) => r.repo))];
  if (repos.length > 1) throw new BuildSiteError(`records name more than one repository: ${repos.join(', ')}`);
  const repo = repos[0] ?? opts.fallbackRepo;
  if (!repo) throw new BuildSiteError('there are no records and GITHUB_REPOSITORY is not set, so the repository name is unknown');

  const index = buildIndex(records, {
    repo,
    dataSource: opts.dataSource,
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
  });
  const check = validate('site-index', index);
  if (!check.valid) throw new BuildSiteError('generated data/index.json does not match its schema', check.errors);

  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, 'data', 'issues'), { recursive: true });
  await cp(assets, out, { recursive: true });
  for (const l of loaded) await writeFile(join(out, 'data', 'issues', l.file), l.text);
  await writeFile(join(out, 'data', 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  return { index, records: records.length };
}

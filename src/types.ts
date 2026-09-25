// Types for the data contracts in docs/kit/02-specs/data-contracts.md.
// The JSON Schemas in schemas/ are the authority; these types mirror them.

export const STATES = [
  'NEW', 'TRIAGING', 'CONFIRMED', 'FLAKY', 'DUPLICATE', 'NEEDS_INFO', 'BLOCKED_ENV', 'ERROR',
  'FIXING', 'FIX_ABANDONED', 'VERIFYING', 'FIX_VERIFIED', 'FIX_INCOMPLETE', 'REGRESSION_DETECTED', 'RESOLVED',
] as const;
export type State = (typeof STATES)[number];

export type TriageVerdict = 'CONFIRMED' | 'FLAKY' | 'DUPLICATE' | 'NEEDS_INFO' | 'BLOCKED_ENV';
export type VerifyVerdict = 'FIX_VERIFIED' | 'FIX_INCOMPLETE' | 'REGRESSION_DETECTED';
export type TrialOutcome = 'PASS' | 'FAIL_MATCH' | 'FAIL_OTHER' | 'ERROR';
export type SignatureKind = 'assertion_message' | 'error_type' | 'output_regex' | 'timeout';
export type BisectStatus = 'found' | 'no_good_commit' | 'skipped' | 'timeout' | 'error';
export type Evidence = 'strong' | 'limited';
export type FixSource = 'bob' | 'human';
export const TEST_CLASSES = [
  'UNCHANGED_PASS', 'NEWLY_PASSING', 'PRE_EXISTING_FAILURE', 'PRE_EXISTING_FLAKY',
  'ADDED_PASSING', 'ADDED_FAILING', 'REMOVED', 'REGRESSION',
] as const;
export type TestClass = (typeof TEST_CLASSES)[number];
export const STAGES = ['intake', 'dedupe', 'repro', 'rootcause', 'fix'] as const;
export type Stage = (typeof STAGES)[number];
export type Provider = 'claude' | 'bob';
export type EventType =
  | 'triage.started' | 'triage.verdict' | 'bisect.done' | 'rootcause.done' | 'fix.started' | 'fix.iteration'
  | 'fix.pr_opened' | 'fix.abandoned' | 'verify.started' | 'verify.verdict' | 'resolved' | 'error';
export type DataSource = 'sample' | 'live';

export interface Fingerprint {
  component: string;
  functions: string[];
  symptom: string;
  trigger: string;
  expected: string;
  actual: string;
  error_signature: string;
}

export type FingerprintField = 'component' | 'functions' | 'symptom' | 'trigger' | 'error_signature';

export interface Duplicate {
  of: number | null;
  score: number | null;
  fields: Partial<Record<FingerprintField, number | null>>;
  reason: string;
  behaviour_check: TrialOutcome | null;
}

export interface Signature {
  kind: SignatureKind;
  pattern: string;
}

export interface Repro {
  test_file: string;
  test_sha256: string;
  branch: string;
  signature: Signature;
  attempts: number;
  scope_violations: string[];
  trials: number;
  failed: number;
  invalid: number;
  sequence: string;
  rate: number | null;
  wilson_low: number | null;
  wilson_high: number | null;
}

export interface Bisect {
  status: BisectStatus;
  good_sha: string;
  first_bad_sha: string;
  subject: string;
  author: string;
  date: string;
  url: string;
  reason: string;
}

export interface Location {
  file: string;
  start_line: number;
  end_line: number;
  reason: string;
}

export interface RootCause {
  summary: string;
  locations: Location[];
  fix_direction: string;
  confidence: string;
  ide_prompt: string;
}

export interface Triage {
  verdict: TriageVerdict | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  fingerprint: Fingerprint | null;
  duplicate: Duplicate | null;
  question: string;
  baseline_suite: { sha: string; passed: number; failed: number } | null;
  repro: Repro | null;
  bisect: Bisect | null;
  root_cause: RootCause | null;
}

export interface BlockingTest {
  id: string;
  class: TestClass;
  base: string;
  head: string;
  message: string;
}

export interface Verification {
  verdict: VerifyVerdict;
  finished_at: string;
  repro: {
    runs_required: number;
    runs: number;
    failed: number;
    invalid: number;
    evidence: Evidence | null;
    claim: string;
    injected: boolean;
  };
  regression: {
    tests_total: number;
    counts: Record<TestClass, number>;
    blocking: BlockingTest[];
    notable: { id: string; class: TestClass }[];
  };
}

export interface Iteration {
  n: number;
  source: FixSource;
  pr: number | null;
  branch: string;
  base_sha: string;
  head_sha: string | null;
  bob_iterations: number;
  scope_violations: string[];
  summary: string;
  verification: Verification | null;
}

export interface BobTask {
  stage: Stage;
  task_id: string;
  session_costs: number;
  duration_ms: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  tool_calls: number;
}

export interface IssueRecord {
  schema: 1;
  repo: string;
  issue: number;
  title: string;
  url: string;
  provider: Provider;
  state: State;
  created_at: string;
  updated_at: string;
  triage_runs: number;
  auto_retriage_count: number;
  triage: Triage;
  fix?: { iterations: Iteration[] };
  resolution_note: string;
  cost: {
    bobcoins_total: number;
    by_stage: Record<Stage, number>;
    bob_tasks: BobTask[];
  };
  events: { at: string; type: EventType; detail: string }[];
}

export interface SiteIndexEntry {
  issue: number;
  title: string;
  state: State;
  verdict: TriageVerdict | null;
  rate: number | null;
  sequence: string | null;
  updated_at: string;
  bobcoins_total: number;
  tokens_total: number;
  pr: number | null;
}

export interface SiteIndex {
  generated_at: string;
  repo: string;
  provider: Provider | null;
  data_source: DataSource;
  totals: {
    issues: number;
    by_state: Partial<Record<State, number>>;
    median_time_to_verdict_ms: number | null;
    median_bobcoins_per_triage: number | null;
    median_tokens_per_triage: number | null;
    fixes_verified: number;
    regressions_caught: number;
  };
  issues: SiteIndexEntry[];
}

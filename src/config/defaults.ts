// Defaults for .reprise.yml, exactly the example in docs/kit/01-architecture/architecture.md
// ("Target repo contract"). Only `version` and `sandbox.dockerfile` have no default.

import type { Stage } from '../types.js';

export interface RepriseConfig {
  version: 1;
  sandbox: { dockerfile: string; run_timeout_seconds: number };
  tests: { all: string; single: string; report: 'junit' | 'tap'; repro_dir: string };
  edit_scope: { repro: string[]; fix: string[]; never: string[] };
  triage: { trials: number; max_repro_attempts: number; max_auto_retriage: number; bisect: boolean };
  fix: { max_iterations: number };
  verify: { min_runs: number; max_runs: number; regression_reruns: number };
  provider: 'claude' | 'bob';
  bob: { max_cost: Record<Stage, number>; max_turns: Record<Stage, number> };
  claude: { model: string; max_tokens: Record<Stage, number>; max_tool_turns: Record<Stage, number> };
}

export const DEFAULTS: Omit<RepriseConfig, 'version' | 'sandbox'> & { sandbox: { run_timeout_seconds: number } } = {
  sandbox: { run_timeout_seconds: 60 },
  tests: {
    all: 'node --test --test-reporter=junit --test-reporter-destination=/out/junit.xml test/',
    single: 'node --test --test-reporter=junit --test-reporter-destination=/out/junit.xml {file}',
    report: 'junit',
    repro_dir: 'test/reprise',
  },
  edit_scope: {
    repro: ['test/reprise/**'],
    fix: ['src/**', 'test/**'],
    never: ['test/reprise/**', '.github/**', '.reprise.yml', 'Dockerfile.reprise'],
  },
  triage: { trials: 20, max_repro_attempts: 3, max_auto_retriage: 3, bisect: true },
  fix: { max_iterations: 3 },
  verify: { min_runs: 3, max_runs: 200, regression_reruns: 3 },
  provider: 'claude',
  bob: {
    max_cost: { intake: 1, dedupe: 1, repro: 4, rootcause: 2, fix: 6 },
    max_turns: { intake: 6, dedupe: 4, repro: 20, rootcause: 12, fix: 30 },
  },
  claude: {
    model: 'claude-sonnet-5',
    max_tokens: { intake: 4096, dedupe: 2048, repro: 8192, rootcause: 4096, fix: 16000 },
    max_tool_turns: { intake: 6, dedupe: 4, repro: 20, rootcause: 12, fix: 30 },
  },
};

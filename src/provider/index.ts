// NOT IMPLEMENTED IN THE WEB-ONLY BUILD.
//
// The reasoning-provider interface from ADR-12 (docs/kit/01-architecture/decisions.md) and the
// stage table from docs/kit/02-specs/bob-integration.md. This file holds types and the stage
// table only. There is no implementation, no model client and no network code anywhere in this
// build; the triage and fix pipelines that would call runStage are not built yet.

import type { Stage } from '../types.js';

export type { Stage } from '../types.js';

/** Output schema of each stage (schemas/<name>.schema.json). */
export type StageSchema = 'intake' | 'dedupe-confirm' | 'repro' | 'rootcause' | 'fix';

/** Where a stage may edit files: nothing, `edit_scope.repro`, or `edit_scope.fix` minus `edit_scope.never`. */
export type EditScope = 'none' | 'repro' | 'fix-minus-never';

export interface StageTableEntry {
  /** Prompt files in prompts/: the first call, then the revision prompt (if any). */
  prompts: readonly string[];
  /** Bob `--mode` for the stage. */
  bobMode: 'ask' | 'agent';
  /** Bob tool groups passed to `--disable-tool-groups`. */
  bobDisabledToolGroups: readonly string[];
  editScope: EditScope;
  schema: StageSchema;
}

/** bob-integration.md "Stage table". */
export const STAGE_TABLE: Readonly<Record<Stage, StageTableEntry>> = {
  intake: {
    prompts: ['intake.md'],
    bobMode: 'ask',
    bobDisabledToolGroups: ['edit', 'execute', 'mcp', 'skill', 'todo', 'subagent', 'mode'],
    editScope: 'none',
    schema: 'intake',
  },
  dedupe: {
    prompts: ['dedupe-confirm.md'],
    bobMode: 'ask',
    bobDisabledToolGroups: ['edit', 'execute', 'mcp', 'skill', 'todo', 'subagent', 'mode'],
    editScope: 'none',
    schema: 'dedupe-confirm',
  },
  repro: {
    prompts: ['write-repro-test.md', 'revise-repro-test.md'],
    bobMode: 'agent',
    bobDisabledToolGroups: ['execute', 'mcp', 'skill', 'subagent', 'mode'],
    editScope: 'repro',
    schema: 'repro',
  },
  rootcause: {
    prompts: ['root-cause.md'],
    bobMode: 'ask',
    bobDisabledToolGroups: ['edit', 'execute', 'mcp', 'skill', 'todo', 'subagent', 'mode'],
    editScope: 'none',
    schema: 'rootcause',
  },
  fix: {
    prompts: ['propose-fix.md', 'revise-fix.md'],
    bobMode: 'agent',
    bobDisabledToolGroups: ['execute', 'mcp', 'skill', 'subagent', 'mode'],
    editScope: 'fix-minus-never',
    schema: 'fix',
  },
};

/** Values for the `{{variables}}` declared in a prompt file's front matter. */
export type PromptVars = Readonly<Record<string, string>>;

export interface RunStageOptions {
  /** Scratch workspace the provider may read (and, for editing stages, write) inside. */
  workspace: string;
  /** Issue number, used for record and replay file names. */
  issue: number;
  /** 1-based attempt or iteration number. */
  attempt: number;
  /** True for the revision prompt (second entry of `prompts`), continuing the same conversation. */
  revision?: boolean;
  /** --bob-replay DIR / --bob-record DIR (both providers). */
  replayDir?: string;
  recordDir?: string;
}

/** One `cost.bob_tasks` entry (data-contracts.md). */
export interface StageStats {
  task_id: string;
  session_costs: number;
  duration_ms: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  tool_calls: number;
}

export interface RunStageResult {
  /** The stage output, validated against the stage schema. */
  json: unknown;
  stats: StageStats;
  /** Workspace-relative paths the stage changed. */
  editedFiles: string[];
}

/** ADR-12: every reasoning stage goes through this one call. No implementation exists in this build. */
export interface ReasoningProvider {
  readonly name: 'claude' | 'bob';
  runStage(stage: Stage, promptVars: PromptVars, opts: RunStageOptions): Promise<RunStageResult>;
}

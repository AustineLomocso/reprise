// Verdict from trials: docs/kit/02-specs/statistics.md sections 1 and 2.

import type { TriageVerdict, TrialOutcome } from '../types.js';
import { wilson } from './index.js';

/** Trial symbol stored in the sequence string (section 1). */
export function trialSymbol(outcome: TrialOutcome): 'P' | 'F' | 'X' {
  switch (outcome) {
    case 'PASS':
      return 'P';
    case 'FAIL_MATCH':
      return 'F';
    case 'FAIL_OTHER':
    case 'ERROR':
      return 'X';
  }
}

export interface TrialsResult {
  /** CONFIRMED, FLAKY or NEEDS_INFO; null when the test is unstable. */
  verdict: Extract<TriageVerdict, 'CONFIRMED' | 'FLAKY' | 'NEEDS_INFO'> | null;
  /** More than 10% of trials were invalid (section 1): back to the repro loop, or ERROR. */
  unstable: boolean;
  trials: number;
  valid: number;
  failed: number;
  invalid: number;
  sequence: string;
  rate: number | null;
  wilson_low: number | null;
  wilson_high: number | null;
}

/** Verdict from the outcomes of the trials, in run order (sections 1 and 2). */
export function verdictFromTrials(outcomes: readonly TrialOutcome[]): TrialsResult {
  const trials = outcomes.length;
  if (trials === 0) throw new RangeError('verdictFromTrials needs at least one trial');
  const sequence = outcomes.map(trialSymbol).join('');
  const failed = outcomes.filter((o) => o === 'FAIL_MATCH').length;
  const invalid = outcomes.filter((o) => o === 'FAIL_OTHER' || o === 'ERROR').length;
  const valid = trials - invalid;
  const unstable = invalid > 0.1 * trials;
  if (unstable || valid === 0) {
    return { verdict: null, unstable: true, trials, valid, failed, invalid, sequence, rate: null, wilson_low: null, wilson_high: null };
  }
  const w = wilson(failed, valid);
  const verdict = failed === valid ? 'CONFIRMED' : failed === 0 ? 'NEEDS_INFO' : 'FLAKY';
  return { verdict, unstable: false, trials, valid, failed, invalid, sequence, rate: w.rate, wilson_low: w.low, wilson_high: w.high };
}

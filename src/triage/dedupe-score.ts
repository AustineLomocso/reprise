// Dedupe scoring: docs/kit/02-specs/triage-pipeline.md section 3.
// Pure functions. The weights and threshold are the spec's starting values; phase 3 calibrates them.

import type { Fingerprint, FingerprintField } from '../types.js';

export const DEDUPE_THRESHOLD = 0.6;

export const DEDUPE_WEIGHTS: Readonly<Record<FingerprintField, number>> = {
  component: 0.2,
  functions: 0.3,
  symptom: 0.2,
  trigger: 0.15,
  error_signature: 0.15,
};

export const STOPWORDS: ReadonlySet<string> = new Set(
  'a an and are as at be but by for from has have in is it of on or that the this to was were when with'.split(' '),
);

/**
 * Split on non-alphanumerics and camelCase boundaries, lowercase, drop tokens of length 1
 * and stopwords. Returns the set of tokens.
 */
export function normalise(text: string): Set<string> {
  const tokens = text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  return new Set(tokens);
}

/** Jaccard index of two sets; 0 when both are empty. */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface DedupeScore {
  /** Weighted score over the counted fields, or null when no field could be compared. */
  score: number | null;
  /** Per-field score; null when the field is empty on either side and so not counted. */
  fields: Record<FingerprintField, number | null>;
}

/** Score a new fingerprint against an earlier one. */
export function scoreFingerprints(a: Fingerprint, b: Fingerprint): DedupeScore {
  const fields: Record<FingerprintField, number | null> = {
    component: null,
    functions: null,
    symptom: null,
    trigger: null,
    error_signature: null,
  };
  if (a.component !== '' && b.component !== '') {
    fields.component = a.component === b.component && a.component !== 'unknown' ? 1 : 0;
  }
  if (a.functions.length > 0 && b.functions.length > 0) {
    fields.functions = jaccard(new Set(a.functions), new Set(b.functions));
  }
  for (const f of ['symptom', 'trigger', 'error_signature'] as const) {
    if (a[f].trim() !== '' && b[f].trim() !== '') fields[f] = jaccard(normalise(a[f]), normalise(b[f]));
  }
  let sum = 0;
  let weights = 0;
  for (const [f, w] of Object.entries(DEDUPE_WEIGHTS) as [FingerprintField, number][]) {
    const v = fields[f];
    if (v === null) continue;
    sum += w * v;
    weights += w;
  }
  return { score: weights === 0 ? null : sum / weights, fields };
}

/** Candidates are records with score >= threshold (compared with a 1e-9 tolerance for float error). */
export function isCandidate(score: number | null, threshold: number = DEDUPE_THRESHOLD): boolean {
  return score !== null && score >= threshold - 1e-9;
}

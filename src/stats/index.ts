// Statistics for Reprise: docs/kit/02-specs/statistics.md.
// Pure functions only. Stored values keep full precision; formatting is separate (section 7).

export { trialSymbol, verdictFromTrials, type TrialsResult } from './verdict.js';

/** Two-sided 95% normal quantile (statistics.md header). */
export const Z = 1.959963984540054;
/** Significance level (statistics.md header). */
export const ALPHA = 0.05;

export interface WilsonInterval {
  rate: number;
  low: number;
  high: number;
}

/** Wilson score interval for k failures in n valid trials (section 3). */
export function wilson(k: number, n: number, z: number = Z): WilsonInterval {
  if (!Number.isInteger(k) || !Number.isInteger(n) || n <= 0 || k < 0 || k > n) {
    throw new RangeError(`wilson needs integers 0 <= k <= n and n > 0; got k=${k}, n=${n}`);
  }
  const p = k / n;
  const z2 = z * z;
  const d = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / d;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / d;
  return { rate: p, low: Math.max(0, centre - margin), high: Math.min(1, centre + margin) };
}

/** One-sided upper bound on the failure rate when none of n valid trials failed (section 4). */
export function zeroFailureBound(n: number, alpha: number = ALPHA): number {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError(`zeroFailureBound needs an integer n > 0; got ${n}`);
  return 1 - Math.pow(alpha, 1 / n);
}

export interface RequiredRuns {
  /** Runs to perform after clamping to [min, max]. */
  required: number;
  /** Runs the formula asks for before clamping. */
  raw: number;
  /** True when raw exceeded max, so the evidence is limited (section 6). */
  capped: boolean;
}

/** Runs needed to verify a fix, from the triage Wilson low bound r (section 5). */
export function requiredRuns(rateLow: number, alpha: number = ALPHA, min = 3, max = 200): RequiredRuns {
  if (!(rateLow >= 0 && rateLow <= 1)) throw new RangeError(`rateLow must be in [0, 1]; got ${rateLow}`);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min) {
    throw new RangeError(`need integers 1 <= min <= max; got min=${min}, max=${max}`);
  }
  let raw: number;
  if (rateLow >= 1) raw = min;
  else if (rateLow <= 0) raw = Number.POSITIVE_INFINITY;
  else raw = Math.ceil(Math.log(alpha) / Math.log(1 - rateLow));
  const required = Math.min(max, Math.max(min, raw));
  return { required, raw, capped: raw > max };
}

/** A rate as a percentage with one decimal: 0.2 -> "20.0%" (section 7). */
export function formatPercent(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** An interval as "8.1%–41.6%" (section 7). */
export function formatInterval(low: number, high: number): string {
  return `${formatPercent(low)}–${formatPercent(high)}`;
}

function formatAlpha(alpha: number): string {
  return `${Number((alpha * 100).toFixed(4))}%`;
}

/**
 * Claim sentence for a verification in which every one of `runs` repro runs passed (section 6).
 * `rateLow` is the triage Wilson low bound; `req` comes from requiredRuns(rateLow, ...).
 */
export function claimSentence(rateLow: number, runs: number, req: RequiredRuns, alpha: number = ALPHA): string {
  if (!req.capped) {
    return `If this bug were still present at its triage rate (at least ${formatPercent(rateLow)}), the chance of ${runs} clean runs would be below ${formatAlpha(alpha)}.`;
  }
  return `${runs} clean runs rule out failure rates above ${formatPercent(zeroFailureBound(runs, alpha))}. The bug's triage rate may be as low as ${formatPercent(rateLow)}, so this is limited evidence. Consider more runs with \`/reprise verify\`.`;
}

/** The NEEDS_INFO bound line, shown only when trials ran with zero failures (github-integration.md, section 4 here). */
export function boundSentence(n: number, alpha: number = ALPHA): string {
  return `The test never failed in ${n} runs, so if this bug exists here it happens in fewer than about ${formatPercent(zeroFailureBound(n, alpha))} of runs.`;
}

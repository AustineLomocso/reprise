// Pure display helpers for the Reprise dashboard (docs/kit/02-specs/dashboard.md).
// No DOM access here, so the engine's tests can import this file and check it against src/stats.

/** dashboard.md "Display names". */
export const DISPLAY = Object.freeze({
  NEW: 'New',
  TRIAGING: 'Checking',
  CONFIRMED: 'Reproduced',
  FLAKY: 'Reproduced sometimes',
  DUPLICATE: 'Duplicate of #M',
  NEEDS_INFO: 'Needs one answer',
  BLOCKED_ENV: 'Test environment missing',
  ERROR: 'Reprise stopped — see issue',
  FIXING: 'Fix in progress',
  FIX_ABANDONED: 'No fix proposed',
  VERIFYING: 'Checking fix',
  FIX_VERIFIED: 'Fix verified',
  FIX_INCOMPLETE: 'Still reproduces',
  REGRESSION_DETECTED: 'Fix breaks other tests',
  RESOLVED: 'Resolved',
});

/** Colour family of each state: the strip colours, plus neutral for states that say nothing about the bug. */
export const TONE = Object.freeze({
  NEW: 'neutral',
  TRIAGING: 'neutral',
  CONFIRMED: 'reproduced',
  FLAKY: 'intermittent',
  DUPLICATE: 'neutral',
  NEEDS_INFO: 'neutral',
  BLOCKED_ENV: 'neutral',
  ERROR: 'neutral',
  FIXING: 'neutral',
  FIX_ABANDONED: 'neutral',
  VERIFYING: 'neutral',
  FIX_VERIFIED: 'clean',
  FIX_INCOMPLETE: 'reproduced',
  REGRESSION_DETECTED: 'reproduced',
  RESOLVED: 'neutral', // green means a verified fix; a resolved issue may have been merged without one
});

/** Display name for a state; DUPLICATE needs the original issue number. */
export function displayState(state, duplicateOf) {
  if (state === 'DUPLICATE') {
    return Number.isInteger(duplicateOf) ? `Duplicate of #${duplicateOf}` : 'Duplicate of an earlier report';
  }
  return Object.prototype.hasOwnProperty.call(DISPLAY, state) ? DISPLAY[state] : String(state);
}

/** Headings from github-integration.md "Pull request — verification". */
export const VERIFY_SENTENCE = Object.freeze({
  FIX_VERIFIED: 'The bug is fixed and nothing else broke.',
  FIX_INCOMPLETE: 'The bug still reproduces.',
  REGRESSION_DETECTED: 'This change breaks other tests.',
});

/** Row labels from the verification comment template in github-integration.md. */
export const TEST_CLASS_LABEL = Object.freeze({
  UNCHANGED_PASS: 'Still passing',
  NEWLY_PASSING: 'Now passing',
  PRE_EXISTING_FAILURE: 'Already failing before this PR',
  PRE_EXISTING_FLAKY: 'Already flaky before this PR',
  ADDED_PASSING: 'New and passing',
  ADDED_FAILING: 'New and failing',
  REMOVED: 'Removed',
  REGRESSION: 'Broken by this PR',
});

export const EVENT_LABEL = Object.freeze({
  'triage.started': 'Triage started',
  'triage.verdict': 'Triage result',
  'bisect.done': 'First bad commit search finished',
  'rootcause.done': 'Likely cause written',
  'fix.started': 'Fix started',
  'fix.iteration': 'Fix attempt',
  'fix.pr_opened': 'Pull request opened',
  'fix.abandoned': 'Fix abandoned',
  'verify.started': 'Verification started',
  'verify.verdict': 'Verification result',
  resolved: 'Resolved',
  error: 'Reprise stopped',
});

export const SIGNATURE_KIND_LABEL = Object.freeze({
  assertion_message: 'assertion message',
  error_type: 'error type',
  output_regex: 'output pattern',
  timeout: 'timeout',
});

export const ALPHA = 0.05;

/** statistics.md section 7: one decimal. Must equal src/stats formatPercent. */
export function formatPercent(x) {
  return `${(x * 100).toFixed(1)}%`;
}

export function formatInterval(low, high) {
  return `${formatPercent(low)}–${formatPercent(high)}`;
}

/** statistics.md section 4. Must equal src/stats zeroFailureBound. */
export function zeroFailureBound(n, alpha = ALPHA) {
  return 1 - Math.pow(alpha, 1 / n);
}

/** The NEEDS_INFO bound line. Must equal src/stats boundSentence. */
export function boundSentence(n, alpha = ALPHA) {
  return `The test never failed in ${n} runs, so if this bug exists here it happens in fewer than about ${formatPercent(zeroFailureBound(n, alpha))} of runs.`;
}

const intFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function formatInt(n) {
  return intFormat.format(n);
}

export function formatBobcoins(n) {
  return `${decFormat.format(n)} Bobcoins`;
}

/** "under a minute", "7 min", "1 h 5 min". */
export function formatDuration(ms) {
  if (ms < 60_000) return 'under a minute';
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// Dates are formatted by hand in the viewer's time zone: locale data differs between browsers
// ("Sep" versus "Sept"), and the spec shows "25 Sep".
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

/** "25 Sep". */
export function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "25 Sep, 10:41". */
export function formatDateTime(iso) {
  const d = new Date(iso);
  return `${formatDate(iso)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "25 Sep 2026, 10:41". */
export function formatDateTimeYear(iso) {
  const d = new Date(iso);
  return `${formatDate(iso)} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "run 7" / "runs 1, 4, 9 and 15". */
export function runList(numbers) {
  if (numbers.length === 1) return `run ${numbers[0]}`;
  const head = numbers.slice(0, -1).join(', ');
  return `runs ${head} and ${numbers[numbers.length - 1]}`;
}

const OUTCOME_WORD = Object.freeze({ F: 'reproduced', P: 'passed', X: 'invalid run' });

/** Tooltip and hidden-list text for one cell. */
export function cellText(symbol, run, ordered) {
  const word = OUTCOME_WORD[symbol];
  if (!ordered) return `${word[0].toUpperCase()}${word.slice(1)} (run order not recorded)`;
  return `Run ${run}: ${word}`;
}

/**
 * aria-label summary for a trial strip (dashboard.md "Trial strip component").
 * `cells` is a string of F, P and X in run order (or grouped when `ordered` is false).
 */
export function stripSummary(cells, ordered) {
  const all = [...cells];
  const n = all.length;
  const reproduced = [];
  const invalid = [];
  all.forEach((c, i) => {
    if (c === 'F') reproduced.push(i + 1);
    else if (c === 'X') invalid.push(i + 1);
  });
  const valid = n - invalid.length;
  const k = reproduced.length;
  let text = invalid.length
    ? `Reproduced in ${k} of ${valid} valid ${valid === 1 ? 'run' : 'runs'}`
    : `Reproduced in ${k} of ${n} ${n === 1 ? 'run' : 'runs'}`;
  if (!ordered) {
    if (invalid.length) text += `; ${invalid.length} ${invalid.length === 1 ? 'run' : 'runs'} invalid`;
    return `${text}; run order not recorded`;
  }
  if (k > 0 && k < valid) text += `: ${runList(reproduced)}`;
  if (invalid.length) text += `. Invalid: ${runList(invalid)}`;
  return text;
}

/** Cells for a verification check stored only as counts: grouped reproduced, invalid, passed. */
export function groupedCells(runs, failed, invalid) {
  const passed = Math.max(0, runs - failed - invalid);
  return 'F'.repeat(failed) + 'X'.repeat(invalid) + 'P'.repeat(passed);
}

/** Split text on backticks: odd parts are code. */
export function splitCode(text) {
  return String(text).split('`').map((part, i) => ({ code: i % 2 === 1, text: part }));
}

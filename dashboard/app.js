// Reprise dashboard: hash router and views (docs/kit/02-specs/dashboard.md).
// Every string from data is inserted with textContent. Links to GitHub are created only from
// record `url` fields that start with https://github.com/, and never in sample mode (ADR-13).

import {
  TONE, VERIFY_SENTENCE, TEST_CLASS_LABEL, EVENT_LABEL, SIGNATURE_KIND_LABEL,
  displayState, formatPercent, formatInterval, boundSentence, formatInt, formatBobcoins, formatDuration,
  formatDate, formatDateTime, formatDateTimeYear, cellText, stripSummary, groupedCells, splitCode, runList,
} from './format.js';

const main = document.getElementById('main');
const banner = document.getElementById('sample-banner');
const repoName = document.getElementById('repo-name');
const footer = document.getElementById('site-footer');

const state = {
  indexPromise: null,
  index: null,
  firstRender: true,
  renderId: 0,
};

// ---------------------------------------------------------------------------
// Input modality: actions triggered by the keyboard are never animated.

function setModality(m) {
  document.documentElement.dataset.modality = m;
}

window.addEventListener('keydown', (e) => {
  if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) setModality('keyboard');
}, true);
window.addEventListener('pointerdown', () => setModality('pointer'), true);

function keyboardDriven() {
  return document.documentElement.dataset.modality === 'keyboard';
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------------------------------------------------------------------------
// DOM helpers. Text only ever goes in through textContent.

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.attrs) {
    for (const [k, v] of Object.entries(options.attrs)) {
      if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function text(s) {
  return document.createTextNode(String(s));
}

function internalLink(hash, label) {
  return el('a', { text: label, attrs: { href: hash } });
}

function isSample() {
  return state.index?.data_source === 'sample';
}

/** A GitHub link, only for https://github.com/ URLs and never in sample mode; otherwise plain text. */
function githubLink(url, label) {
  if (!isSample() && typeof url === 'string' && url.startsWith('https://github.com/')) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && parsed.host === 'github.com') {
        return el('a', { text: label, attrs: { href: parsed.href } });
      }
    } catch {
      // fall through to plain text
    }
  }
  return el('span', { text: label });
}

/** https://github.com/OWNER/REPO from a record url of the form .../issues/N. */
function repoUrlFrom(recordUrl) {
  const m = /^(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/issues\/[0-9]+$/.exec(String(recordUrl));
  return m ? m[1] : null;
}

function encodePath(p) {
  return String(p).split('/').map(encodeURIComponent).join('/');
}

function shortSha(sha) {
  return String(sha).slice(0, 7);
}

function code(s) {
  return el('code', { text: s });
}

/** Text with `inline code` spans (claim sentences). */
function richText(s) {
  const span = el('span');
  for (const part of splitCode(s)) span.append(part.code ? code(part.text) : text(part.text));
  return span;
}

function resultMarker(stateName, duplicateOf) {
  const tone = TONE[stateName] ?? 'neutral';
  return el('span', { className: `result tone-${tone}` }, [
    el('span', { className: 'swatch', attrs: { 'aria-hidden': 'true' } }),
    el('span', { text: displayState(stateName, duplicateOf) }),
  ]);
}

// ---------------------------------------------------------------------------
// Trial strip component (dashboard.md "Trial strip component").

let openTooltip = null;

function closeTooltip() {
  if (openTooltip) {
    openTooltip.remove();
    openTooltip = null;
  }
}

function showTooltip(cell, label) {
  closeTooltip();
  const strip = cell.parentElement;
  const centre = cell.offsetLeft + cell.offsetWidth / 2;
  const edge = 72;
  const side = centre < edge ? 'start' : centre > strip.clientWidth - edge ? 'end' : 'center';
  const tip = el('span', { className: `tooltip tooltip--${side}`, text: label, attrs: { 'aria-hidden': 'true' } });
  cell.append(tip);
  openTooltip = tip;
  if (keyboardDriven() || reducedMotion()) {
    tip.classList.add('is-open');
  } else {
    // Let the closed state render once so the entrance can transition from it.
    requestAnimationFrame(() => requestAnimationFrame(() => tip.classList.add('is-open')));
  }
}

/**
 * @param {string} cells   F, P and X per run
 * @param {object} opts    { variant: 'large'|'mini', ordered: boolean, animate: boolean }
 */
function trialStrip(cells, opts) {
  const { variant, ordered = true, animate = false } = opts;
  const symbols = [...cells];
  const summary = stripSummary(cells, ordered);
  const strip = el('div', {
    className: `strip strip--${variant}${animate ? ' strip--enter' : ''}`,
    attrs: { role: 'img', 'aria-label': summary },
  });
  const nodes = symbols.map((s) => el('span', { className: `cell cell--${s}` }));
  strip.append(...nodes);
  if (variant === 'mini') return strip;

  const labels = symbols.map((s, i) => cellText(s, i + 1, ordered));
  let active = 0;
  strip.tabIndex = 0;
  const activate = (i, show) => {
    nodes[active]?.classList.remove('is-active');
    active = i;
    nodes[active].classList.add('is-active');
    if (show) showTooltip(nodes[active], labels[active]);
  };
  strip.addEventListener('focus', () => activate(active, true));
  strip.addEventListener('blur', () => {
    nodes[active]?.classList.remove('is-active');
    closeTooltip();
  });
  strip.addEventListener('keydown', (e) => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(nodes.length - 1, active + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, active - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = nodes.length - 1;
    else if (e.key === 'Escape') {
      closeTooltip();
      return;
    }
    if (next !== null) {
      e.preventDefault();
      activate(next, true);
    }
  });
  nodes.forEach((node, i) => {
    node.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') showTooltip(node, labels[i]);
    });
  });
  strip.addEventListener('pointerleave', () => {
    if (document.activeElement !== strip) closeTooltip();
  });

  const list = el('ol', { className: 'visually-hidden' }, labels.map((l) => el('li', { text: l })));
  return el('div', { className: 'strip-figure' }, [strip, list]);
}

// ---------------------------------------------------------------------------
// Data

async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) {
    const err = new Error(`${path}: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function loadIndex() {
  if (!state.indexPromise) {
    state.indexPromise = fetchJson('data/index.json').then((index) => {
      state.index = index;
      applyIndexChrome(index);
      return index;
    });
    state.indexPromise.catch(() => {
      state.indexPromise = null;
    });
  }
  return state.indexPromise;
}

function loadRecord(n) {
  return fetchJson(`data/issues/${n}.json`);
}

function applyIndexChrome(index) {
  banner.hidden = index.data_source !== 'sample';
  const name = String(index.repo).split('/')[1] ?? String(index.repo);
  repoName.textContent = name;
  footer.replaceChildren(
    el('p', { text: `Data generated ${formatDateTimeYear(index.generated_at)}.` }),
  );
}

function costText(provider, tokens, bobcoins) {
  if (provider === 'bob') return bobcoins > 0 ? formatBobcoins(bobcoins) : null;
  return tokens > 0 ? `${formatInt(tokens)} tokens` : null;
}

// ---------------------------------------------------------------------------
// Views. Each returns { title, nodes }.

function errorView() {
  const reload = el('button', { className: 'button', text: 'Reload', attrs: { type: 'button' } });
  reload.addEventListener('click', () => window.location.reload());
  return {
    title: 'Data did not load · Reprise',
    nodes: [
      el('h1', { className: 'visually-hidden', text: 'Data did not load', attrs: { tabindex: '-1' } }),
      el('p', { className: 'status-text', text: "The report data didn't load. Reload the page. If a deploy is in progress, it finishes within a few minutes." }),
      el('p', {}, [reload]),
    ],
  };
}

function unknownIssueView(n) {
  return {
    title: `No report #${n} · Reprise`,
    nodes: [
      el('h1', { className: 'visually-hidden', text: `No report #${n}`, attrs: { tabindex: '-1' } }),
      el('p', { className: 'status-text' }, [`There is no report #${n}. `, internalLink('#/', 'Go to all reports'), '.']),
    ],
  };
}

function unknownPageView() {
  return {
    title: 'Page not found · Reprise',
    nodes: [
      el('h1', { className: 'visually-hidden', text: 'Page not found', attrs: { tabindex: '-1' } }),
      el('p', { className: 'status-text' }, ['There is no page at this address. ', internalLink('#/', 'Go to all reports'), '.']),
    ],
  };
}

function emptyView(index) {
  const repo = String(index.repo);
  const name = repo.split('/')[1] ?? repo;
  const issuesUrl = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) ? `https://github.com/${repo}/issues` : null;
  return {
    title: 'Reports · Reprise',
    nodes: [
      el('h1', { className: 'visually-hidden', text: `Reports for ${name}`, attrs: { tabindex: '-1' } }),
      el('p', { className: 'status-text', text: `No reports yet. When a maintainer adds the reprise label to an issue in ${name}, it appears here within a few minutes.` }),
      issuesUrl ? el('p', {}, [githubLink(issuesUrl, `Issues in ${name}`)]) : null,
    ],
  };
}

function lastVerification(record) {
  const its = record.fix?.iterations ?? [];
  for (let i = its.length - 1; i >= 0; i--) if (its[i].verification) return its[i].verification;
  return null;
}

/** The latest before/after pair: most recently updated record with a triage sequence and a verification. */
async function latestPair(index) {
  const withSequence = index.issues
    .filter((e) => typeof e.sequence === 'string' && e.sequence.length > 0)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.issue - a.issue);
  const verifyingStates = new Set(['FIX_VERIFIED', 'FIX_INCOMPLETE', 'REGRESSION_DETECTED', 'RESOLVED', 'VERIFYING', 'FIXING']);
  for (const entry of withSequence.filter((e) => verifyingStates.has(e.state))) {
    const record = await loadRecord(entry.issue);
    const v = lastVerification(record);
    if (v && v.repro.runs > 0) return { entry, record, verification: v };
  }
  return withSequence.length ? { entry: withSequence[0], record: null, verification: null } : null;
}

function beforeAfter(latest) {
  const { entry, verification } = latest;
  const seq = entry.sequence;
  const k = [...seq].filter((c) => c === 'F').length;
  const valid = [...seq].filter((c) => c !== 'X').length;
  const rows = [
    el('dt', { text: 'Before' }),
    el('dd', {}, [trialStrip(seq, { variant: 'large', ordered: true }), el('span', { className: 'count', text: `${k} of ${valid} reproduced` })]),
  ];
  if (verification) {
    const r = verification.repro;
    const cells = groupedCells(r.runs, r.failed, r.invalid);
    const ordered = r.runs === 0 || [r.failed, r.invalid, r.runs - r.failed - r.invalid].includes(r.runs);
    rows.push(
      el('dt', { text: 'After' }),
      el('dd', {}, [trialStrip(cells, { variant: 'large', ordered }), el('span', { className: 'count', text: `${r.failed} of ${r.runs - r.invalid} reproduced` })]),
    );
  }
  return el('section', { className: 'latest', attrs: { 'aria-labelledby': 'latest-title' } }, [
    el('h2', { className: 'latest-title', attrs: { id: 'latest-title' } }, [
      el('span', { className: 'label', text: 'Latest: ' }),
      internalLink(`#/issues/${entry.issue}`, `#${entry.issue} ${entry.title}`),
    ]),
    el('dl', { className: 'pair' }, rows),
  ]);
}

async function overviewView() {
  const index = await loadIndex();
  if (index.issues.length === 0) return emptyView(index);
  const name = String(index.repo).split('/')[1] ?? String(index.repo);

  const duplicates = index.issues.filter((e) => e.state === 'DUPLICATE');
  const dupOf = new Map();
  await Promise.all(duplicates.map(async (e) => {
    try {
      const r = await loadRecord(e.issue);
      dupOf.set(e.issue, r.triage.duplicate?.of ?? null);
    } catch {
      dupOf.set(e.issue, null);
    }
  }));
  const latest = await latestPair(index);

  // On narrow screens the Trials column is hidden and the mini strip sits under the result
  // instead. Only one copy is ever displayed; display: none keeps the other out of the
  // accessibility tree.
  const trials = (e) => (typeof e.sequence === 'string' && e.sequence.length
    ? trialStrip(e.sequence.slice(0, 20), { variant: 'mini', ordered: true })
    : el('span', { className: 'none', text: '–', attrs: { 'aria-label': 'No trials' } }));
  const rows = index.issues.map((e) => el('tr', {}, [
    el('td', { className: 'col-num', text: `${e.issue}` }),
    el('td', {}, [internalLink(`#/issues/${e.issue}`, e.title)]),
    el('td', { className: 'col-result' }, [
      resultMarker(e.state, dupOf.get(e.issue)),
      typeof e.sequence === 'string' && e.sequence.length ? el('div', { className: 'narrow-only' }, [trials(e)]) : null,
    ]),
    el('td', { className: 'col-trials' }, [trials(e)]),
  ]));

  const t = index.totals;
  const parts = [`${formatInt(t.issues)} ${t.issues === 1 ? 'report' : 'reports'}`];
  if (t.median_time_to_verdict_ms !== null) parts.push(`median time to result ${formatDuration(t.median_time_to_verdict_ms)}`);
  if (index.provider === 'bob' && t.median_bobcoins_per_triage !== null) parts.push(`median ${formatBobcoins(t.median_bobcoins_per_triage)} per triage`);
  if (index.provider !== 'bob' && t.median_tokens_per_triage !== null) parts.push(`median tokens ${formatInt(t.median_tokens_per_triage)}`);
  parts.push(`${formatInt(t.fixes_verified)} ${t.fixes_verified === 1 ? 'fix' : 'fixes'} verified`);
  parts.push(`${formatInt(t.regressions_caught)} ${t.regressions_caught === 1 ? 'regression' : 'regressions'} caught`);

  return {
    title: 'Reports · Reprise',
    nodes: [
      el('h1', { className: 'visually-hidden', text: `Reports for ${name}`, attrs: { tabindex: '-1' } }),
      latest ? beforeAfter(latest) : null,
      el('section', { className: 'reports', attrs: { 'aria-labelledby': 'reports-title' } }, [
        el('h2', { text: 'Reports', attrs: { id: 'reports-title' } }),
        el('table', { className: 'report-table', attrs: { 'aria-labelledby': 'reports-title' } }, [
          el('thead', {}, [el('tr', {}, [
            el('th', { className: 'col-num', text: '#', attrs: { scope: 'col' } }),
            el('th', { text: 'Title', attrs: { scope: 'col' } }),
            el('th', { className: 'col-result', text: 'Result', attrs: { scope: 'col' } }),
            el('th', { className: 'col-trials', text: 'Trials', attrs: { scope: 'col' } }),
          ])]),
          el('tbody', {}, rows),
        ]),
        el('p', { className: 'totals', text: parts.join(' · ') }),
      ]),
    ],
  };
}

// --- Issue detail -----------------------------------------------------------

function lastEventDetail(record, types) {
  for (let i = record.events.length - 1; i >= 0; i--) {
    const e = record.events[i];
    if (types.includes(e.type) && e.detail) return e.detail;
  }
  return '';
}

function factList(pairs) {
  const items = [];
  for (const [term, value] of pairs) {
    if (value === null || value === undefined || value === '') continue;
    items.push(el('dt', { text: term }), el('dd', {}, [typeof value === 'string' ? text(value) : value]));
  }
  return items.length ? el('dl', { className: 'facts' }, items) : null;
}

function section(id, title, children) {
  return el('section', { attrs: { 'aria-labelledby': id } }, [el('h2', { text: title, attrs: { id } }), ...children]);
}

function reproductionSection(record, animate) {
  const r = record.triage.repro;
  if (!r) return null;
  const repoUrl = repoUrlFrom(record.url);
  const children = [];
  if (r.trials > 0 && r.sequence.length > 0) {
    children.push(trialStrip(r.sequence, { variant: 'large', ordered: true, animate }));
    const valid = r.trials - r.invalid;
    let line = `Reproduced in ${r.failed} of ${valid} ${r.invalid ? 'valid ' : ''}${valid === 1 ? 'run' : 'runs'}`;
    if (r.rate !== null && r.wilson_low !== null && r.wilson_high !== null) {
      line += ` · ${formatPercent(r.rate)} (likely ${formatInterval(r.wilson_low, r.wilson_high)})`;
    }
    children.push(el('p', { className: 'strip-caption', text: line }));
    if (r.invalid > 0) {
      const invalidRuns = [...r.sequence].flatMap((c, i) => (c === 'X' ? [i + 1] : []));
      children.push(el('p', { text: `${r.invalid} ${r.invalid === 1 ? 'run' : 'runs'} did not run correctly and ${r.invalid === 1 ? 'is' : 'are'} not counted (${runList(invalidRuns)}).` }));
    }
  } else {
    children.push(el('p', { text: 'The reproduction test was written but no trials ran.' }));
  }
  const testFile = repoUrl && r.branch
    ? githubLink(`${repoUrl}/blob/${encodePath(r.branch)}/${encodePath(r.test_file)}`, r.test_file)
    : el('span', { text: r.test_file });
  testFile.classList.add('mono');
  children.push(factList([
    ['Signature', r.signature?.pattern ? el('span', {}, [text(`${SIGNATURE_KIND_LABEL[r.signature.kind] ?? r.signature.kind}: `), code(r.signature.pattern)]) : null],
    ['Test file', testFile],
    ['Branch', r.branch ? code(r.branch) : null],
    ['Attempts', `${r.attempts} ${r.attempts === 1 ? 'attempt' : 'attempts'} to write a test that fails for the reported reason`],
    ['Out of scope', r.scope_violations.length ? `${r.scope_violations.length} edit(s) outside the test folder were undone: ${r.scope_violations.join(', ')}` : null],
    ['Suite before any change', record.triage.baseline_suite ? `${record.triage.baseline_suite.passed} passing, ${record.triage.baseline_suite.failed} failing` : null],
  ]));
  return section('reproduction', 'Reproduction', children);
}

const FIELD_LABEL = [
  ['component', 'Component'],
  ['functions', 'Functions'],
  ['symptom', 'Symptom'],
  ['trigger', 'Trigger'],
  ['error_signature', 'Error'],
];

function duplicateSection(record) {
  const d = record.triage.duplicate;
  if (!d || d.of === null) return null;
  const rows = FIELD_LABEL.map(([key, label]) => {
    const v = d.fields?.[key];
    return el('tr', {}, [
      el('th', { text: label, attrs: { scope: 'row' } }),
      el('td', { className: 'num', text: typeof v === 'number' ? v.toFixed(2) : 'not compared' }),
    ]);
  });
  const behaviour = {
    FAIL_MATCH: `The reproduction test from #${d.of} still fails on the current code, for the same reason.`,
    PASS: `The reproduction test from #${d.of} now passes, so that bug looks fixed.`,
    FAIL_OTHER: `The reproduction test from #${d.of} failed for a different reason.`,
    ERROR: `The reproduction test from #${d.of} did not run correctly.`,
  }[d.behaviour_check];
  return section('duplicate', 'Duplicate', [
    el('p', {}, ['Same bug as ', internalLink(`#/issues/${d.of}`, `#${d.of}`), typeof d.score === 'number' ? `, match score ${d.score.toFixed(2)}.` : '.']),
    d.reason ? el('p', { text: d.reason }) : null,
    behaviour ? el('p', { text: behaviour }) : null,
    el('table', { className: 'small-table', attrs: { 'aria-label': 'Match score by field' } }, [
      el('thead', {}, [el('tr', {}, [el('th', { text: 'Field', attrs: { scope: 'col' } }), el('th', { className: 'num', text: 'Score', attrs: { scope: 'col' } })])]),
      el('tbody', {}, rows),
    ]),
  ]);
}

function questionSection(record) {
  if (record.state !== 'NEEDS_INFO' && record.triage.verdict !== 'NEEDS_INFO') return null;
  const r = record.triage.repro;
  const tried = lastEventDetail(record, ['triage.verdict']);
  return section('question', 'One question for the reporter', [
    record.triage.question ? el('p', { className: 'note', text: record.triage.question }) : null,
    tried ? el('p', { text: `What was tried: ${tried}` }) : null,
    r && r.trials > 0 && r.failed === 0 ? el('p', { text: boundSentence(r.trials - r.invalid) }) : null,
  ]);
}

function stoppedSection(record) {
  if (record.state === 'BLOCKED_ENV') {
    const detail = lastEventDetail(record, ['triage.verdict', 'error']);
    return section('environment', 'Test environment', [
      el('p', { text: detail || 'The sandbox could not be built.' }),
      el('p', {}, ['Once this is fixed, comment ', code('/reprise triage'), ' on the issue.']),
    ]);
  }
  if (record.state === 'ERROR') {
    const detail = lastEventDetail(record, ['error']);
    return section('stopped', 'Why Reprise stopped', [
      el('p', { text: detail || 'Reprise stopped before reaching a result.' }),
      el('p', {}, ['Comment ', code('/reprise triage'), ' on the issue to try again.']),
    ]);
  }
  if (record.state === 'TRIAGING') {
    return section('checking', 'In progress', [el('p', { text: 'Reprise is checking this report. The result appears here when it finishes.' })]);
  }
  return null;
}

function diagnosisSection(record) {
  const rc = record.triage.root_cause;
  const b = record.triage.bisect;
  if (!rc && !b) return null;
  const children = [];
  if (rc) {
    children.push(el('p', { text: rc.summary }));
    if (rc.locations.length) {
      children.push(el('ul', { className: 'plain-list' }, rc.locations.map((l) => el('li', {}, [
        code(`${l.file}:${l.start_line}–${l.end_line}`), text(` ${l.reason}`),
      ]))));
    }
  }
  let bisectValue = null;
  if (b) {
    if (b.status === 'found') {
      const sha = githubLink(b.url, shortSha(b.first_bad_sha));
      sha.classList.add('mono');
      bisectValue = el('span', {}, [sha, text(` ${b.subject}`), text(b.author ? ` (${b.author}${b.date ? `, ${formatDate(b.date)}` : ''})` : '')]);
    } else if (b.status === 'skipped') {
      bisectValue = `Skipped: ${b.reason || 'bisect is unreliable for intermittent failures'}.`;
    } else {
      bisectValue = `Not found (${b.status.replaceAll('_', ' ')})${b.reason ? `: ${b.reason}` : ''}.`;
    }
  }
  children.push(factList([
    ['Confidence', rc?.confidence ?? null],
    ['Fix direction', rc?.fix_direction ?? null],
    ['Introduced in', bisectValue],
  ]));
  return section('diagnosis', 'Diagnosis', children);
}

function verificationBlock(v, record, headingLevel) {
  const r = v.repro;
  const ordered = r.runs === 0 || [r.failed, r.invalid, r.runs - r.failed - r.invalid].includes(r.runs);
  const cells = groupedCells(r.runs, r.failed, r.invalid);
  const reg = v.regression;
  const nonZero = Object.entries(reg.counts).filter(([, n]) => n > 0);
  const children = [
    el(headingLevel, {}, [resultMarker(v.verdict)]),
    el('p', { text: VERIFY_SENTENCE[v.verdict] ?? '' }),
    r.runs > 0 ? trialStrip(cells, { variant: 'large', ordered }) : null,
    el('p', { className: 'strip-caption', text: `Reproduced in ${r.failed} of ${r.runs - r.invalid} runs of the reproduction test${r.runs_required ? ` (${r.runs_required} required)` : ''}${r.invalid ? `; ${r.invalid} did not run correctly` : ''}.` }),
    !ordered ? el('p', { text: 'Only the counts of these runs are recorded, not their order, so the strip groups failures first.' }) : null,
    r.claim ? el('p', {}, [richText(r.claim)]) : null,
    r.evidence === 'limited' ? el('p', { className: 'note', text: 'Limited evidence: the run count was capped.' }) : null,
    r.injected ? el('p', { text: 'The pull request did not include the reproduction test, so Reprise added it for this check only.' }) : null,
    el('p', { text: `Test suite: ${formatInt(reg.tests_total)} tests compared with the base branch.` }),
  ];
  if (nonZero.length) {
    children.push(el('table', { className: 'small-table', attrs: { 'aria-label': 'Test suite compared with the base branch' } }, [
      el('thead', {}, [el('tr', {}, [el('th', { text: 'Result', attrs: { scope: 'col' } }), el('th', { className: 'num', text: 'Count', attrs: { scope: 'col' } })])]),
      el('tbody', {}, nonZero.map(([cls, n]) => el('tr', {}, [
        el('th', { text: TEST_CLASS_LABEL[cls] ?? cls, attrs: { scope: 'row' } }),
        el('td', { className: 'num', text: formatInt(n) }),
      ]))),
    ]));
  }
  if (reg.blocking.length) {
    children.push(el('h4', { className: 'visually-hidden', text: 'Tests that block this fix' }));
    children.push(el('ul', { className: 'plain-list' }, reg.blocking.map((b) => el('li', {}, [
      code(b.id), text(` ${TEST_CLASS_LABEL[b.class] ?? b.class}: base ${b.base}, this PR ${b.head}.${b.message ? ` ${b.message}` : ''}`),
    ]))));
  }
  if (reg.notable.length) {
    children.push(el('ul', { className: 'plain-list' }, reg.notable.map((n) => el('li', {}, [
      code(n.id), text(` ${TEST_CLASS_LABEL[n.class] ?? n.class}`),
    ]))));
  }
  if (v.finished_at) children.push(el('p', { text: `Checked ${formatDateTime(v.finished_at)}.` }));
  return el('div', { className: 'verification' }, children);
}

function fixSection(record) {
  const its = record.fix?.iterations ?? [];
  if (!its.length) {
    return null;
  }
  const repoUrl = repoUrlFrom(record.url);
  const blocks = its.map((it) => {
    const source = it.source === 'bob' ? 'Proposed by Reprise' : 'Written by a person';
    const prRef = it.pr !== null
      ? githubLink(repoUrl ? `${repoUrl}/pull/${it.pr}` : '', `pull request #${it.pr}`)
      : null;
    const heading = el('h3', {}, [text(`Attempt ${it.n}: ${source}`)]);
    const facts = factList([
      ['Pull request', prRef ?? (it.verification ? null : record.state === 'FIX_ABANDONED' && it === its[its.length - 1] ? 'None opened' : 'Not opened yet')],
      ['Branch', it.branch ? code(it.branch) : null],
      ['Commits', it.head_sha ? el('span', {}, [text('base '), code(shortSha(it.base_sha)), text(', fix '), code(shortSha(it.head_sha))]) : null],
      ['Rounds', it.source === 'bob' && it.bob_iterations > 0 ? `${it.bob_iterations} ${it.bob_iterations === 1 ? 'round' : 'rounds'} of propose, test and revise` : null],
      ['Out of scope', it.scope_violations.length ? `Undone: ${it.scope_violations.join(', ')}` : null],
    ]);
    return el('div', { className: 'iteration' }, [
      heading,
      it.summary ? el('p', { text: it.summary }) : null,
      facts,
      it.verification ? verificationBlock(it.verification, record, 'h4') : null,
      !it.verification && record.state === 'FIXING' && it === its[its.length - 1]
        ? el('p', { text: 'Reprise is working on this fix. Verification runs when the pull request opens.' }) : null,
      !it.verification && record.state === 'VERIFYING' && it === its[its.length - 1]
        ? el('p', { text: 'Verification is running on this pull request.' }) : null,
    ]);
  });
  const abandoned = record.state === 'FIX_ABANDONED'
    ? el('p', { className: 'note', text: lastEventDetail(record, ['fix.abandoned']) || 'No usable change was produced, so no pull request was opened.' })
    : null;
  return section('fix', 'Fix and verification', [abandoned, ...blocks]);
}

function timelineSection(record) {
  if (!record.events.length) return null;
  return section('timeline', 'Timeline', [
    el('ol', { className: 'timeline' }, record.events.map((e) => el('li', {}, [
      el('time', { text: formatDateTime(e.at), attrs: { datetime: e.at } }),
      el('span', {}, [el('span', { className: 'what', text: EVENT_LABEL[e.type] ?? e.type }), e.detail ? text(`: ${e.detail}`) : null]),
    ]))),
  ]);
}

async function detailView(n) {
  const index = await loadIndex();
  if (!index.issues.some((e) => e.issue === n)) return unknownIssueView(n);
  const record = await loadRecord(n);
  const animate = !keyboardDriven() && !reducedMotion();
  const cost = costText(
    record.provider,
    record.cost.bob_tasks.reduce((s, t) => s + t.input_tokens + t.output_tokens, 0),
    record.cost.bobcoins_total,
  );
  const byline = [`Reported ${formatDate(record.created_at)}`];
  byline.push(record.triage.duration_ms !== null ? `result in ${formatDuration(record.triage.duration_ms)}` : 'no result yet');
  if (cost) byline.push(cost);
  const issueRef = isSample()
    ? el('span', { text: `${String(record.repo).split('/')[1] ?? record.repo}#${record.issue} (sample data, not a real GitHub issue)` })
    : githubLink(record.url, `View #${record.issue} on GitHub`);

  return {
    title: `#${record.issue} ${record.title} · Reprise`,
    nodes: [
      el('article', { className: 'detail' }, [
        el('div', { className: 'detail-head' }, [
          el('h1', { text: `#${record.issue} ${record.title}`, attrs: { tabindex: '-1' } }),
          resultMarker(record.state, record.triage.duplicate?.of ?? null),
        ]),
        el('p', { className: 'byline', text: byline.join(', ') }),
        el('p', { className: 'byline' }, [issueRef]),
        record.resolution_note ? el('p', { className: 'note', text: `Resolved: ${record.resolution_note}.` }) : null,
        stoppedSection(record),
        duplicateSection(record),
        reproductionSection(record, animate),
        questionSection(record),
        diagnosisSection(record),
        fixSection(record),
        timelineSection(record),
      ]),
    ],
  };
}

// --- How it works -----------------------------------------------------------

async function howView() {
  let name = 'the repository';
  try {
    const index = await loadIndex();
    name = String(index.repo).split('/')[1] ?? name;
  } catch {
    // The page still works without data.
  }
  const template = document.getElementById('lifecycle-template');
  const svg = template ? document.importNode(template.content, true) : null;
  const steps = [
    ['Check the report', 'Reprise turns the report into a fingerprint: the component, the functions involved, the symptom and what triggers it. It compares that with every earlier report. A close match is only called a duplicate after it is confirmed, and after the earlier report’s reproduction test is run on the current code.'],
    ['Reproduce it', 'It builds the project’s test environment with no network access, writes a test that must fail for the reported reason, and runs it 20 times. Each run is one cell in the trial strip. Failing every time means reproduced. Failing some of the time means intermittent, reported with a rate and a 95% interval. Never failing means Reprise asks the reporter the one question most likely to help.'],
    ['Help fix it', 'For a reproduced bug it names the likely cause and, when the bug fails every time, the first commit that introduced it. A maintainer can ask Reprise to propose a fix as a pull request, or a developer can fix it by hand.'],
    ['Prove the fix', 'Every fix, from Reprise or from a person, is checked the same way. The reproduction test runs as many times as it takes to rule the bug out statistically, and the full test suite is compared with the base branch, so a fix that breaks another test is caught before it is merged.'],
  ];
  return {
    title: 'How it works · Reprise',
    nodes: [
      el('h1', { text: 'How it works', attrs: { tabindex: '-1' } }),
      el('ol', { className: 'steps' }, steps.map(([h, p]) => el('li', {}, [el('h2', { text: h }), el('p', { text: p })]))),
      el('p', { className: 'note', text: `New issues from visitors wait until a maintainer of ${name} adds the reprise label. Reprise does not run on its own for strangers.` }),
      svg ? el('figure', { className: 'lifecycle-figure' }, [
        el('div', { className: 'lifecycle-scroll' }, [svg]),
        el('figcaption', { text: 'Solid arrows are Reprise’s own steps. The dashed arrow is a person’s own pull request, which is checked the same way. A report that needs an answer, has no test environment, or stopped goes back to Checking after a reply or a /reprise triage comment.' }),
      ]) : null,
    ],
  };
}

// ---------------------------------------------------------------------------
// Router

function parseRoute(hash) {
  if (hash === '' || hash === '#' || hash === '#/') return { name: 'overview' };
  if (hash === '#/how-it-works') return { name: 'how' };
  const m = /^#\/issues\/([1-9][0-9]{0,8})$/.exec(hash);
  if (m) return { name: 'detail', issue: Number(m[1]) };
  if (hash.startsWith('#/')) return { name: 'unknown' };
  return null; // an in-page anchor, not a route
}

async function render() {
  const route = parseRoute(window.location.hash);
  if (!route) return;
  const id = ++state.renderId;
  closeTooltip();
  let view;
  try {
    if (route.name === 'overview') view = await overviewView();
    else if (route.name === 'how') view = await howView();
    else if (route.name === 'detail') view = await detailView(route.issue);
    else {
      await loadIndex().catch(() => null);
      view = unknownPageView();
    }
  } catch (err) {
    if (route.name === 'detail' && err && err.status === 404) view = unknownIssueView(route.issue);
    else view = errorView();
  }
  if (id !== state.renderId) return; // a newer navigation won
  document.title = view.title;
  main.replaceChildren(...view.nodes.filter(Boolean));
  const nav = document.getElementById('nav-how');
  if (route.name === 'how') nav.setAttribute('aria-current', 'page');
  else nav.removeAttribute('aria-current');
  if (state.firstRender) {
    state.firstRender = false;
  } else {
    window.scrollTo(0, 0);
    const heading = main.querySelector('h1');
    (heading ?? main).focus({ preventScroll: true });
  }
}

document.getElementById('skip-link').addEventListener('click', (e) => {
  e.preventDefault();
  main.focus();
});

window.addEventListener('hashchange', render);
render();

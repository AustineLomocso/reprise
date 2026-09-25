# Dashboard Spec

Static site in `reprise/dashboard/`, built into `_site/` by `reprise build-site` and deployed to GitHub Pages (ADR-7). No framework, no build step beyond copying files and generating `data/index.json`. Vanilla ES modules, one CSS file, self-hosted fonts (ADR-11, gate G-15).

## Audience and job

Judges, maintainers and developers opening a public link. The page has one job: show, for each bug report, what Reprise proved and how, in under ten seconds of looking.

## Design plan

**Subject.** A reproduction lab. Each bug is a specimen run many times; the evidence is a row of trials. The visual identity comes from that: the **trial strip** (one cell per run) is the single memorable element, and everything around it stays quiet.

**Palette** (light):

| Name | Hex | Use |
| --- | --- | --- |
| Mist | `#F2F5F4` | Page background |
| Slate ink | `#1B2733` | Text |
| Rule | `#C9D3D0` | Borders, table rules, empty cells |
| Reproduced | `#B3261E` | Failing trial, "reproduced" states |
| Clean | `#2E6B4F` | Passing trial, "fix verified" |
| Intermittent | `#9A6A00` | Flaky states |
| Signal blue | `#2F4FA8` | Links, focus ring, the one interactive accent |

Dark scheme (via `prefers-color-scheme: dark`): background `#16212B`, text `#E4ECEA`, rule `#34454F`, reproduced `#F2837B`, clean `#7CC8A1`, intermittent `#E0B54D`, signal blue `#9DB3F2`. Every text/background pair must meet WCAG AA; check with a contrast tool in the UI review.

**Type.** IBM Plex Sans for everything (chosen because the product runs on IBM Bob, and the family is open-licensed, gate G-15). Weights 400 and 600 only. IBM Plex Mono only where the content is literally code: test source, commands, commit SHAs. Scale (rem): 0.875 / 1 / 1.25 / 1.563 / 1.953. Body line height 1.55, max line length 72 characters. Sentence case everywhere; no all-caps labels; no eyebrow labels above headings.

**Layout.** Left-aligned single column, max width 72 rem, generous left margin on wide screens. Numbers in the wireframes are illustrative only.

```
Overview (#/)
+--------------------------------------------------------------+
| Reprise  reprise-demo-shop                     How it works  |
|                                                              |
| Latest: #2 Last item in stock can be sold twice              |
| Before  [F . . F . . . . F . . . . . F . . . . .]  4 of 20   |
| After   [. . . . . . . . . . . . . . . . . . . . ...] 0 of 36|
|                                                              |
| Reports                                                      |
| #   Title                          Result           Trials   |
| 1   Bulk discount not applied...   Fix verified     ▮▮▮▮▮▮   |
| 2   Last item ... sold twice       Fix verified     ▮▯▯▮▯▯   |
| 3   Ordered ten mugs...            Duplicate of #1  -        |
| 4   Checkout total is wrong...     Needs one answer ▯▯▯▯▯▯   |
|                                                              |
| 4 reports  median time to result 6m  median tokens 41,200    |
+--------------------------------------------------------------+

Issue detail (#/issues/N)
+--------------------------------------------------------------+
| #2 Last item in stock can be sold twice      Fix verified    |
| Reported 25 Sep, result in 7 min, 52,300 tokens              |
|                                                              |
| Reproduction                                                 |
| [trial strip, 20 cells, large]  4 of 20 (8.1%-41.6%)         |
| Signature, test file link, attempts                          |
|                                                              |
| Diagnosis   summary, locations, first bad commit             |
| Fix         PR link, source (Bob or person), iterations      |
| Verification [strip of required runs]  claim sentence        |
|             regression table (only non-zero rows)            |
| Timeline    events in order                                  |
+--------------------------------------------------------------+
```

The overview opens with the most recent before/after pair of strips rather than headline statistics; totals sit quietly at the bottom.

**Cost unit (ADR-12).** When `data/index.json` `provider` (or a record's `provider` on the detail page) is `claude`, cost is shown in tokens ("52,300 tokens", "median tokens 41,200", from `tokens_total` and `median_tokens_per_triage`); when it is `bob`, in Bobcoins ("4.2 Bobcoins"). The page never converts either to currency and never shows both units for one record.

**Principles.**
1. Evidence first: every verdict is shown next to the runs that justify it.
2. Plain words: users read "Reproduced 4 of 20 times", never enum names.
3. One accent: signal blue is only for things you can click or focus.
4. Borders encode structure (table rules, strip cells); no drop shadows, no gradient washes, no uniform rounded cards.

**Review against generic defaults** (done while writing this spec): a stats-hero with big numbers was the first idea and was replaced by the before/after strip because it is specific to what Reprise does. Cream and terracotta, near-black with acid accent, and newspaper-column layouts were avoided. Mono is limited to real code.

## Display names

| State or verdict | Shown as |
| --- | --- |
| `TRIAGING` | Checking |
| `CONFIRMED` | Reproduced |
| `FLAKY` | Reproduced sometimes |
| `DUPLICATE` | Duplicate of #M |
| `NEEDS_INFO` | Needs one answer |
| `BLOCKED_ENV` | Test environment missing |
| `ERROR` | Reprise stopped — see issue |
| `FIXING` | Fix in progress |
| `FIX_ABANDONED` | No fix proposed |
| `VERIFYING` | Checking fix |
| `FIX_VERIFIED` | Fix verified |
| `FIX_INCOMPLETE` | Still reproduces |
| `REGRESSION_DETECTED` | Fix breaks other tests |
| `RESOLVED` | Resolved |

## Trial strip component

- One cell per run in run order. Reproduced: filled with the reproduced colour. Passed: outlined with the clean colour. Invalid: rule colour with a diagonal hatch.
- Large variant on the detail page (cells 14×28 px, 3 px gap, wraps after 40), mini variant in the list (first 20 runs, 5×12 px).
- Each cell has a tooltip on hover and focus: "Run 7: reproduced". Tooltips open from the cell (transform origin at the cell edge they attach to).
- Verification strips (records store only counts for verification runs, `data-contracts.md`): when every run had the same outcome, the strip is exact. Otherwise the cells are drawn grouped by outcome (reproduced, then invalid, then passed), tooltips read "Reproduced (run order not recorded)", the aria-label ends with "run order not recorded", and a visible sentence under the strip says the order was not recorded. Clarification approved by the owner, 25 Sep 2026.
- Accessibility: the strip has `role="img"` and an `aria-label` summary ("Reproduced in 4 of 20 runs: runs 1, 4, 9, 15"); a visually hidden list gives every run for screen readers.

### Implementation decisions from the web-only slice (reported to the owner for review)

- **Keyboard access to cells.** An element with `role="img"` cannot contain focusable children, and a 200-run strip would be 200 tab stops. The large strip is therefore one tab stop: focusing it shows the tooltip of the current cell; arrow keys, Home and End move between cells; Escape closes the tooltip. Pointer users get the same tooltip on hover.
- **Mini strip.** The mini strip in the report list keeps the `aria-label` summary but has no per-cell tooltips, focus or hidden run list: 17 rows of 20 cells would bury the table for keyboard and screen-reader users, and the detail page carries the full strip.
- **Narrow screens.** Below 40 rem the Trials column is hidden and the mini strip (two rows of ten) sits under the result in the same row, so every verdict still sits next to its runs.
- **Fix source.** `FixSource` `bob` is shown as "Proposed by Reprise" and `human` as "Written by a person" (the wireframe says "Bob or person"; under ADR-12 the provider may not be Bob).
- **Colour of states.** Filled reproduced colour: `CONFIRMED`, `FIX_INCOMPLETE`, `REGRESSION_DETECTED`. Filled intermittent colour: `FLAKY`. Outlined clean colour: `FIX_VERIFIED` only. Every other state, including `RESOLVED` (which may be "merged without passing verification"), is an outlined ink square. The words always sit next to the mark.
- **Latest pair.** The overview's before/after pair is the most recently updated record that has a triage sequence and a verification with at least one run.
- **Design pass (owner request).** Run numbers under large strips in run order (1, 10, 20 …); a "One cell per run" key under the latest pair; claim sentences in a boxed note (clean edge, intermittent edge when evidence is limited); the sample banner edge uses the invalid-run hatch; a three-cell brand mark; whole-row links in the report table; one label width for fact lists; the timeline as a vertical rule with square markers. Details in `../05-quality/ui-review.md` Review 2.
- **Intermittent colour as text.** Light-scheme intermittent `#9A6A00` on Mist is 4.32:1, below AA for body text, so it is used only for graphics (strip cells, marks, the diagram), where the non-text minimum is 3:1.

## Motion (team rules, apply to every UI element)

- Only `transform` and `opacity` are animated.
- Entering elements start at `scale(0.95)` and `opacity: 0`, use `ease-out`, never `ease-in`.
- Every animation is under 300 ms.
- The one orchestrated moment: on the issue detail page, trial cells enter in run order with a 30 ms stagger (each cell 180 ms). Nothing else animates on load.
- Buttons use `transform: scale(0.97)` on `:active`.
- Popovers and tooltips use origin-aware transforms.
- Hover effects are wrapped in `@media (hover: hover) and (pointer: fine)`.
- `prefers-reduced-motion: reduce` disables all of the above.
- Actions triggered by the keyboard are never animated: if the page was reached or the element was activated by keyboard, the stagger and tooltip transitions are skipped (track the last input modality).
- There are no gesture-driven interactions; if any are added later, they use spring animations.

## Data loading

- `data/index.json` on the overview, `data/issues/<N>.json` on detail pages, both relative URLs.
- Hash routing: `#/`, `#/issues/<N>`, `#/how-it-works`.
- Every string from data is inserted with `textContent`. Links are built only from `url` fields that start with `https://github.com/`.
- Content-Security-Policy meta: `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'`.

## Sample data (ADR-13)

When `data/index.json` has `data_source: "sample"`, every route shows a persistent banner directly under the header, in plain text: "Sample data. These reports illustrate how Reprise works; they were not produced by a live run." It is not dismissible. In sample mode, issue, pull request, commit and branch references are shown as plain text rather than links, because the sample objects do not exist on GitHub. With `data_source: "live"` there is no banner and links follow the rule in "Data loading".

## Empty and error states

- No records: "No reports yet. When a maintainer adds the reprise label to an issue in reprise-demo-shop, it appears here within a few minutes." with a link to the repository's issues.
- Data failed to load: "The report data didn't load. Reload the page. If a deploy is in progress, it finishes within a few minutes."
- Unknown issue number: "There is no report #N. Go to all reports."

## How it works page

Four short sections in order (a real sequence, so numbering is appropriate): check the report, reproduce it, help fix it, prove the fix. One embedded static SVG of the lifecycle (exported from `issue-lifecycle.mmd` at build time or hand-drawn), and a note that visitors' new issues wait for a maintainer's label before Reprise runs.

## Quality floor

Responsive down to 360 px wide, visible focus rings in signal blue (2 px outline, 2 px offset), keyboard reachable tooltips, semantic `<table>` for the report list, `lang="en"`, page titles per route, no console errors, Lighthouse accessibility score recorded in the UI review.

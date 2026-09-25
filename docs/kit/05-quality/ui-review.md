# UI Review Template

Use this format for every UI review of the dashboard (team rule). One row per finding. Add screenshots by filename in the "Before" and "After" cells when useful.

| Area | Before | After | Why |
| --- | --- | --- | --- |
| Example: trial strip tooltip | Tooltip scaled from its centre | Tooltip scales from the edge touching the cell | Popovers use origin-aware transforms, so the motion shows where the tooltip came from |

## Review 1: web-only slice, 25 Sep 2026

Reviewed with Playwright (Chromium) on `npm run preview` (17 sample records, `data_source: "sample"`), at 360, 768 and 1440 px, light and dark schemes, keyboard only, and with `prefers-reduced-motion: reduce`. Screenshots are in the working copy's `.review/` folder (not committed). Every row is resolved.

| Area | Before | After | Why |
| --- | --- | --- | --- |
| Palette: intermittent text (found before coding, WCAG formula) | Light intermittent `#9A6A00` on Mist measures 4.32:1 | Used only for graphics (strip cells, marks, diagram swatches); every text run is ink or signal blue | AA needs 4.5:1 for body text and 3:1 for graphics. Every other pair passes: ink 13.83/13.59, reproduced 5.96/6.46, clean 5.74/8.27, signal 6.83/7.90 (light/dark); dark intermittent 8.46 |
| Trial strip: invalid cells | Rule colour `#C9D3D0` is 1.40:1 on Mist, so an invalid cell nearly vanishes | Rule fill with a diagonal hatch in ink | Invalid runs must be visible (non-text contrast 3:1); the hatch keeps the spec's "rule colour with a diagonal hatch" |
| Overview: before/after pair (1440 px) | Strips sat about 1 rem below their "Before" and "After" labels (tooltip padding) | Padding removed inside the pair; label, strip and count share one line | The pair is the first thing on the page; misalignment read as a layout bug |
| Dates | "25 Sept" (Chromium's en-GB locale data) | "25 Sep", formatted by hand in the viewer's time zone | Spec and wireframe use "25 Sep"; locale data differs between browsers |
| Overview: totals line | Wrapped at 72ch, orphaning "caught" | Full width | It is one quiet line of totals, not prose |
| Trial strip: focus ring | Ring spanned the full 677 px strip width however many cells there were | Strip sizes to its cells (`width: fit-content`) | The ring should outline the thing that has focus |
| Overview at 360 px | Title column about 70 px wide, titles five lines deep; page scrolled 2 px sideways | Trials column folds under the result (mini strip in two rows of ten); title column 137 px at 360, 166 px at 400; no horizontal scroll at 360, 400, 600, 768, 1440 | Responsive to 360 px without losing the evidence next to each verdict |
| Verification strip with mixed outcomes (#17) | Failures drawn first with no visible explanation, which reads as "the first three runs failed" | Visible sentence: "Only the counts of these runs are recorded, not their order, so the strip groups failures first."; tooltips and aria-label say "run order not recorded"; single-outcome strips count as ordered | Verification stores counts only (`data-contracts.md`); the picture must not claim an order it does not know |
| Unstable trials (#13) | "Reproduced in 5 of 15 runs" next to a 20-cell strip | "Reproduced in 5 of 15 valid runs" plus the list of invalid runs | The count must say which runs it counts |
| Sample data: #13 error text | "Stage trials: …" | "During the trials, …" | `trials` is not a `Stage` in the contract; names are contracts |
| Result mark for `RESOLVED` | Green outline, also for #20 "merged without passing verification" | Neutral outline; green is used only for `FIX_VERIFIED` | Green must not imply a verified fix that did not happen; the detail page states the resolution note |
| Mini strip (spec: tooltip per cell, hidden run list) | Per-cell tooltips and lists would add 340 tab stops or list items to the report table | Mini strip keeps the `aria-label` summary only; the detail page has the full strip. Recorded in `dashboard.md` "Implementation decisions" for owner review | Keeps the table usable by keyboard and screen reader |
| Large strip keyboard access (spec: tooltips on focus) | `role="img"` cannot hold focusable cells; a 200-run strip would be 200 tab stops | One tab stop; arrows, Home and End move between cells and show the tooltip; Escape closes it. Recorded in `dashboard.md` for owner review | Keyboard-reachable tooltips without breaking the image semantics |
| Tooling: preview servers | Two previews on different ports rebuilt the same `.preview/` folder, so one silently served the other's data | `.preview/<port>/` per server | Found while checking the empty state; a review must look at the data it thinks it is looking at |

## Checks run (no change needed)

| Check | Result |
| --- | --- |
| Motion: properties | Only `opacity` and `transform` animate (cell entrance keyframes, tooltip, button `:active` scale 0.97) |
| Motion: timing | Cells 180 ms, tooltip 120 ms, button 100 ms, all `cubic-bezier(0.22, 1, 0.36, 1)` (an ease-out curve); no ease-in anywhere |
| Motion: the one orchestrated moment | Detail page reproduction strip only: 30 ms stagger (run 20 starts at 570 ms); overview strips and verification strips do not animate |
| Motion: entry state | Cells and tooltips enter from `scale(0.95)` and opacity 0 |
| Motion: tooltips | Origin at the cell edge they attach to (`tooltip--start`, `--center`, `--end` by position) |
| Motion: hover | Every hover rule is inside `@media (hover: hover) and (pointer: fine)` |
| Reduced motion | No `strip--enter` class, `animation-name: none`, tooltip `transition-duration: 0s` |
| Keyboard-triggered actions | Enter on a report link: focus moves to the h1, `data-modality="keyboard"`, no stagger, tooltips open with no transition |
| Keyboard walkthrough | Skip link, brand, How it works, latest title, both latest strips, every report link, then detail strips; all reachable, focus ring 2 px signal blue with 2 px offset |
| Copy | Display names match the table (unit test); empty, error and unknown-issue copy exact (unit test and browser); sentence case, no all-caps or eyebrow labels |
| Banner (ADR-13) | Shown on `#/`, every `#/issues/N`, `#/how-it-works`, unknown issue and unknown page; hidden when `data_source` is `live` |
| Security T8 / S7 | Security fixture served live: title shows as literal `<img src=x onerror=alert(1)>` in the table, h1 and page title; no `img` or `script` element created, no dialog, no `javascript:` link, 0 CSP violations. Only external link is the record's `https://github.com/` issue URL |
| Links in sample mode | 0 external links on every route |
| CSP and console | `securitypolicyviolation` listener on all 21 routes: 0 violations. Console: 0 errors and 0 warnings (except the deliberate 500 in the error-state test) |
| Error, empty, unknown | `data/index.json` answering 500 shows the error copy and a Reload button; an empty data folder shows the empty copy with a link to the repository's issues; `#/issues/99` and `#/nothing` show their messages with a link to all reports |
| Dark scheme | Overview and #1 (the longest detail page) captured at 360 and 768 px; every colour is a token redefined in one `prefers-color-scheme: dark` block, contrast figures above |
| Lighthouse accessibility (13.5.0, default mobile, light) | 100 on `#/`, `#/issues/1`, `#/issues/2`, `#/issues/13`, `#/how-it-works` |

## Checklist to review against

- Motion: transform and opacity only; ease-out; entry from `scale(0.95)` and opacity 0; under 300 ms; stagger 30–80 ms; buttons `scale(0.97)` on `:active`; hover gated by `(hover: hover) and (pointer: fine)`; reduced motion respected; nothing animates on keyboard-triggered actions; no Framer Motion is used (vanilla CSS), so the `x`/`y` shorthand rule does not apply.
- Design plan from `02-specs/dashboard.md`: palette, type, left alignment, one accent colour, mono only for code, no eyebrow or all-caps labels, no shadows or gradient washes.
- Copy: display names match the table; empty and error states use the exact copy; sentence case.
- Accessibility: contrast AA in both schemes, focus visible, strip has aria summary and hidden list, table semantics, page titles.
- Security: no `innerHTML`, CSP clean, links only to `https://github.com/`.
- Responsiveness: 360 px, 768 px, 1440 px.

## Review 2: design pass, 25 Sep 2026

A refinement pass within `02-specs/dashboard.md` (the owner asked for a stronger UI): same palette, Plex 400 and 600, the type scale, left-aligned column, no shadows or gradient washes, same motion rules. The direction is "instrument readout": the trial strip is treated as a measuring device.

| Area | Before | After | Why |
| --- | --- | --- | --- |
| Large trial strips | A row of cells with no scale | Run numbers under runs 1, 10, 20 … hang from their own cells (`data-tick` plus `::after`), so the scale wraps with the strip at any width. Only strips in run order are numbered | A reader can say "it failed on runs 1, 4, 9 and 15" at a glance; the strip reads as a measurement, not decoration |
| Overview before/after | Two rows with the count straight after each strip, so counts sat at different x positions | One grid: labels, strips and counts each own a column; the claim sentence sits under the pair in a boxed note | The pair is the page's one memorable element; aligned counts make before and after directly comparable, and the claim says what the "after" proves |
| Cell key | None; a first-time visitor had to guess what filled and outlined cells mean | "One cell per run:" key drawn with the real cells (reproduced, passed, invalid run) under the pair | The page's job is to be understood in ten seconds |
| Claim sentences | Plain paragraph among others | Boxed note with a clean-colour edge; intermittent edge when the evidence is limited | The claim is the statistical result the page exists to justify |
| Sample banner | Plain box with a thick ink edge | The edge carries the invalid-run hatch | Reuses the dashboard's own sign for "not a real run"; still plain words, still on every route |
| Brand | Wordmark only | Three trial cells (reproduced, passed, reproduced) before the wordmark, matching the favicon | Identity comes from the trial strip, as the design plan says |
| Report table | Only the title text was a target | The whole row opens the report (link overlay); keyboard focus outlines the whole row where `:has()` is supported, otherwise the link's own ring stays | Bigger target, same single tab stop per row; verified by clicking the Result cell |
| Fact lists | Label column width differed per section (12 rem in Reproduction, 8 rem in Diagnosis) | One 12.5 rem label column on every fact list | Values line up down the whole page |
| Timeline | Rows separated by rules | One vertical ink rule with square markers; a filled reproduced marker for a stop, a clean-outlined marker for resolution | Reads as a lab log; squares echo the trial cells |
| How it works | Browser list numbers | Large numerals in their own column (CSS counter), `role="list"` kept for Safari | It is a real sequence; the numbers carry it |

Checks after this pass: 79 tests pass; no horizontal scroll at 360 px on the overview, #19 or How it works (dark scheme); 0 CSP violations and 0 console errors over 7 routes; Lighthouse accessibility 100 on `#/`, `#/issues/1`, `#/how-it-works`; clicking a row's Result cell opens that report; nothing new animates (the ruler numbers belong to cells and enter with them).

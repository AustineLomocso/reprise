# Phase 6 — Dashboard

**Goal:** The static dashboard and `reprise build-site`, built to the design spec and the team's motion rules.
**Repository:** `reprise`.
**Mode:** Plan, then Agent.
**Attach:** `@docs/kit/02-specs/dashboard.md`, `@docs/kit/02-specs/data-contracts.md`, `@docs/kit/02-specs/security.md` (T8), `@docs/kit/05-quality/ui-review.md`.

## Prompt

```
Build the Reprise dashboard exactly as specified in dashboard.md. Before writing code, restate the design plan (palette, type, layout, principles) and confirm nothing in it is a generic default; then implement.

1. dashboard/index.html, dashboard/app.js (ES module, hash router), dashboard/styles.css, dashboard/fonts/ (IBM Plex Sans 400 and 600, IBM Plex Mono 400, woff2, self-hosted, with the licence file).
2. Routes #/, #/issues/N, #/how-it-works with the layouts in the wireframes; display names table; empty, error and unknown-issue states with the exact copy.
3. Trial strip component in large and mini variants with tooltips, aria-label summary and a visually hidden run list.
4. Motion rules exactly as listed in "Motion (team rules)": transform and opacity only, ease-out, scale(0.95)+opacity 0 entry, under 300 ms, one staggered strip entrance at 30 ms, buttons scale(0.97) on :active, origin-aware tooltips, hover gated by (hover: hover) and (pointer: fine), prefers-reduced-motion respected, no animation for keyboard-triggered actions (track last input modality).
5. All data inserted with textContent; links only from https://github.com/ URLs; the CSP meta tag as specified.
6. src/site: `reprise build-site --data DIR --out DIR` copies dashboard assets, copies issues/*.json to out/data/issues/, generates out/data/index.json per the site-index schema (medians computed over records that have the value), and fails if any record is invalid.
7. A fixtures folder with the four recorded demo records, and `npm run preview` that builds the site into .preview/ from those fixtures and serves it with a small static server written with node:http (no extra dependency).
```

## Acceptance

- Local preview shows all four demo issues correctly on both routes, in light and dark schemes, at 360 px and 1440 px widths.
- UI review completed in `05-quality/ui-review.md` format with every row resolved.
- Keyboard-only walkthrough: every link, tooltip and control reachable; no animation when navigating by keyboard.
- No console errors; CSP produces no violations.

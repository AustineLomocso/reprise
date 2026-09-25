# Demo Target Repository — `reprise-demo-shop`

A deliberately small shop library with realistic bugs, built so that one run of the demo produces every verdict and both fix outcomes. Plain Node 24, no dependencies (ADR-10). Prices are integer centavos to avoid floating-point noise that would create unintended bugs.

## Modules

| File | Exports | Behaviour when correct |
| --- | --- | --- |
| `src/pricing.js` | `BULK_MIN_QTY = 10`, `BULK_RATE = 0.10`, `lineTotal(unitCents, qty)`, `applyBulkDiscount(subtotalCents, qty)` | 10% off the line subtotal when `qty >= BULK_MIN_QTY`; result rounded to whole centavos with `Math.round` |
| `src/shipping.js` | `FREE_SHIPPING_MIN = 150000`, `FLAT_FEE = 9900`, `shippingFee(subtotalCents)` | Free when subtotal `>= FREE_SHIPPING_MIN`, else flat fee |
| `src/inventory.js` | `createInventory(initial)` returning `{ reserve(sku, qty), available(sku) }` | `reserve` is async; succeeds and decrements only if enough stock; never allows negative stock |
| `src/cart.js` | `checkout(cart, inventory)` | Reserves every line, prices each line with bulk discount, adds shipping, returns `{ ok, totalCents, lines }` |

`src/store.js` simulates an asynchronous key-value store: `get` and `set` resolve after a short random delay. This is what makes the race condition realistic.

## Existing tests (all pass on the first commit)

`test/pricing.test.js`: line totals; no bulk discount for 9 units; bulk discount for 12 units; rounding of an odd subtotal.
`test/shipping.test.js`: fee just below the threshold; free at exactly the threshold; free above it.
`test/inventory.test.js`: sequential reservations; reservation larger than stock fails; available count after reservations.
`test/cart.test.js`: happy path total for a mixed cart; checkout fails cleanly when out of stock.

Deliberate gap: no test covers exactly 10 units, and no test reserves concurrently. That is why the seeded bugs exist without failing the suite.

## Git history plan (so bisect has a real answer)

Build the history as separate commits, in this order, with these messages:

1. `feat: pricing, shipping, inventory and cart modules with tests` — everything correct; tag `v0.1.0`.
2. `docs: add README`
3. `refactor: move pricing thresholds into named constants` — introduces **Bug A**: `applyBulkDiscount` compares `qty > BULK_MIN_QTY`.
4. `feat: simulate async storage for inventory` — introduces `src/store.js` and **Bug B**: `reserve` reads with `await store.get`, checks, then `await store.set` without any locking.
5. `chore: add Reprise config and sandbox Dockerfile`
6. `test: add test/reprise/.gitkeep`

Workflows, scripts and the issue form are added in later commits (phases 2 and 4); they do not touch `src/` or `test/`, so bisect is unaffected.

Bisect for Bug A must land on commit 3 (tag `v0.1.0` is the good commit).

## Seeded bugs

**Bug A — deterministic.** Buying exactly 10 units gets no discount. Correct fix: `qty >= BULK_MIN_QTY`.

**Bug B — intermittent.** Two concurrent `reserve(sku, 1)` calls on the last unit can both succeed, leaving stock at -1. Correct fix: serialise reservations per SKU (a promise-chain lock) or make check-and-set atomic in the store.

Tuning Bug B (phase 2): write a local script that runs a two-concurrent-reservation scenario 200 times and reports the oversell rate. Adjust `store.js` delay ranges until the measured rate is between 15% and 40%, then record the measured rate and delay values here. Do not state a rate anywhere before measuring it.

| Measurement | Value |
| --- | --- |
| Delay ranges (get / set, ms) | (fill in) |
| Oversell rate over 200 runs | (fill in) |

## Demo issues (created by `scripts/seed-demo.sh`)

Issue numbers are assigned by GitHub at creation. The script prints them; use the printed numbers in the video and slides.

**Stage 1** (created together):

| Key | Title | Body summary | Expected verdict |
| --- | --- | --- | --- |
| BULK | Bulk discount not applied when buying exactly 10 units | 10 × MUG-01 at ₱250.00. Expected 10% off (₱2,250.00 before shipping), charged ₱2,500.00. 12 units gets the discount. | `CONFIRMED`, bisect → commit 3 |
| RACE | Last item in stock can be sold twice | Two customers checked out the last LAMP-02 at the same time; both got confirmations and stock shows -1. Happens sometimes, not always. | `FLAKY` with a measured rate |
| VAGUE | Checkout total is wrong sometimes | "The total at checkout is wrong sometimes. Please fix." No items, quantities, or amounts. | `NEEDS_INFO` asking for items, quantities, expected and actual total |

**Stage 2** (created after BULK has its verdict, so a record exists to match):

| Key | Title | Body summary | Expected verdict |
| --- | --- | --- | --- |
| DUP | Ordered ten mugs, got charged full price | "I bought ten of the coffee mugs for the office and there was no bulk price, I paid the full ₱2,500." | `DUPLICATE` of BULK |

## Fix scenarios

| Scenario | How | Expected verification |
| --- | --- | --- |
| Bob fixes BULK | `/reprise fix` on BULK | `FIX_VERIFIED`, 3 clean runs, no regressions |
| Human bad fix of BULK | Maintainer opens PR from prepared branch `demo/bad-fix-bulk` that changes `BULK_MIN_QTY` to `9`, body "Fixes #BULK" | Repro test passes, but "no bulk discount for 9 units" goes from pass to fail → `REGRESSION_DETECTED` |
| Bob fixes RACE | `/reprise fix` on RACE | `FIX_VERIFIED` with required runs from the measured rate (for example 36 runs if triage saw 4 of 20) |

`scripts/prepare-bad-fix.sh` creates `demo/bad-fix-bulk` from `main` with that one-line change and pushes it. It does not open the PR; the maintainer does, on camera.

## Sandbox files

`Dockerfile.reprise`:

```dockerfile
FROM node:24-slim
WORKDIR /work
# The repository is mounted read-only at /work at run time; /out is a writable mount.
```

`.reprise.yml`: exactly the example in `../01-architecture/architecture.md`, with `bob.max_cost` values set after gate G-4.

## Issue form — `.github/ISSUE_TEMPLATE/bug.yml`

Fields: what happened (required), what you expected (required), steps or cart contents (required), logs (optional, paste as text), how often it happens (dropdown: every time, sometimes, once). The form tells reporters that a maintainer adds the `reprise` label before Reprise runs.

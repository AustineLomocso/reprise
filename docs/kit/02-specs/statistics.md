# Statistics

All functions live in `src/stats/` as pure functions with unit tests that reproduce the worked examples below exactly (to 4 decimal places). z = 1.959963984540054 (two-sided 95%). α = 0.05.

## 1. Trial outcomes

Each trial of the repro test produces exactly one outcome:

| Outcome | Symbol | Meaning |
| --- | --- | --- |
| `PASS` | `P` | Test ran and passed. |
| `FAIL_MATCH` | `F` | Test failed and the failure text matches the signature. Counts as a reproduction. |
| `FAIL_OTHER` | `X` | Test failed, but not for the reported reason. Invalid. |
| `ERROR` | `X` | Test did not run to completion (syntax, import, timeout not declared in the signature, sandbox error). Invalid. |

Valid trials `n = P + F`. Failures `k = F`. The trial sequence is stored as a string such as `PPFPPPPFPP...`.

If more than 10% of trials are invalid (more than 2 of 20), the test is unstable: return to the repro loop if attempts remain, otherwise the triage ends in `ERROR` with the invalid outputs attached.

## 2. Verdict from trials

| Condition | Verdict |
| --- | --- |
| k = n (every valid trial failed) | `CONFIRMED` |
| 0 < k < n | `FLAKY` |
| k = 0 | `NEEDS_INFO` (the test never reproduced the bug) |

## 3. Wilson score interval

```
p = k / n
d = 1 + z²/n
centre = (p + z²/(2n)) / d
margin = z * sqrt( p(1-p)/n + z²/(4n²) ) / d
low = max(0, centre - margin),  high = min(1, centre + margin)
```

Worked examples, n = 20:

| k | rate | low | high |
| --- | --- | --- | --- |
| 20 | 1.00 | 0.8389 | 1.0000 |
| 19 | 0.95 | 0.7639 | 0.9911 |
| 10 | 0.50 | 0.2993 | 0.7007 |
| 4 | 0.20 | 0.0807 | 0.4160 |
| 1 | 0.05 | 0.0089 | 0.2361 |
| 0 | 0.00 | 0.0000 | 0.1611 |

## 4. Upper bound when nothing failed

When k = 0 in n valid trials, the one-sided 95% upper bound on the true failure rate is `1 - α^(1/n)`.

| n | bound |
| --- | --- |
| 3 | 0.6316 |
| 20 | 0.1391 |
| 36 | 0.0798 |

Used in the `NEEDS_INFO` comment: "The test never failed in 20 runs, so if this bug exists here it happens in fewer than about 13.9% of runs." (Rounded per §7.)

## 5. Runs required to verify a fix

Goal: if the fix did nothing and the bug still happened at its triage rate, seeing zero failures should be unlikely (below α). Use the Wilson **low** bound from triage as a conservative rate `r`.

```
if r >= 1: required = min_runs
else: required = ceil( ln(α) / ln(1 - r) )
required = clamp(required, min_runs, max_runs)     # defaults 3 and 200
```

| Triage result | r (Wilson low) | Raw required | Used |
| --- | --- | --- | --- |
| 20/20 | 0.8389 | 2 | 3 |
| 19/20 | 0.7639 | 3 | 3 |
| 10/20 | 0.2993 | 9 | 9 |
| 4/20 | 0.0807 | 36 | 36 |
| 1/20 | 0.0089 | 336 | 200 (capped) |

## 6. Claims written in verification comments

If all `required` runs pass and the raw requirement was not capped (evidence `strong`):

> If this bug were still present at its triage rate (at least {r as %}), the chance of {required} clean runs would be below 5%.

Check: for 4/20, (1 - 0.0807)^36 = 0.048 < 0.05.

If the requirement was capped (evidence `limited`):

> {runs} clean runs rule out failure rates above {1 - α^(1/runs) as %}. The bug's triage rate may be as low as {r as %}, so this is limited evidence. Consider more runs with `/reprise verify`.

For 1/20 capped at 200: the bound is 1.5% against r = 0.9% (displayed per §7; unrounded 1.4867% and 0.8881%).

## 7. Rounding and display

Rates, bounds and claim percentages display as percentages with one decimal (20.0%); this applies to every sentence in §4 and §6 (owner decision, 25 Sep 2026). Intervals display as "8.1%–41.6%". Stored values keep full precision.

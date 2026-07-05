# Evaluation methodology

A bias-detection tool is only as trustworthy as its measured behaviour. FairHire
ships a reproducible eval harness that scores the [analysis engine](./ANALYSIS.md)
against a labelled dataset and reports precision / recall / F1 — plus a fairness
breakdown — with no hand-waving.

```bash
npm run eval    # → npx tsx api/src/analysis/eval/run.ts
```

- [What it measures against](#what-it-measures-against)
- [Metrics & formulas](#metrics--formulas)
- [How predictions are matched to labels](#how-predictions-are-matched-to-labels)
- [Fairness breakdown](#fairness-breakdown)
- [Output](#output)
- [Known limitations](#known-limitations)

The code is split into a pure scoring module,
[`api/src/analysis/eval/metrics.ts`](../api/src/analysis/eval/metrics.ts) (no
I/O, fully unit-tested), and a runner,
[`api/src/analysis/eval/run.ts`](../api/src/analysis/eval/run.ts) (reads the DB,
re-runs the engine, writes the report).

---

## What it measures against

Ground truth is the set of **seeded `Flag` rows** on each meeting in the
database — the hand-authored bias patterns from
[`scripts/seed.ts`](../scripts/seed.ts), stored as real `Flag` rows rather than a
separate fixture file. The runner is strictly read-only:

1. Read every meeting with its labelled flags (`flagType`, `excerpt`,
   `confidenceScore`) and its candidates' demographics.
2. Re-run the analysis engine on each transcript.
3. Score the engine's predicted flags against the labelled flags.

If there are no meetings, it tells you to run `npm run seed:reset` first.

---

## Metrics & formulas

`computePRF({ tp, fp, fn })` computes the standard trio:

```
precision = tp / (tp + fp)
recall    = tp / (tp + fn)
f1        = 2 · precision · recall / (precision + recall)
```

with one deliberate wrinkle: **undefined metrics return `null`, not `0`**. No
predictions → `precision = null`; no ground truth → `recall = null`. This keeps
"we made no claims" distinct from "every claim was wrong," which matters for a
tool that is intentionally conservative.

There is **no accuracy metric** — there is no meaningful "true negative" for
free-text spans, so precision/recall/F1 (plus raw TP/FP/FN counts) are the honest
set. Metrics are reported **overall and per flag type**.

---

## How predictions are matched to labels

A predicted flag matches a labelled flag when **both** hold:

1. **Same `flagType`**, and
2. **Excerpt overlap ≥ 0.5** — `spanOverlap` normalises whitespace/case and
   computes `longestCommonSubstring(a, b) / min(len(a), len(b))`.

Matching is **greedy 1:1**: each labelled flag can be claimed by at most one
prediction. Leftover predictions are false positives; unclaimed labels are false
negatives. The overlap test is intentionally more lenient than the engine's own
dedup containment check, so a near-miss span still counts as a hit rather than
being unfairly penalised as both a miss and a false alarm.

---

## Fairness breakdown

Beyond PRF, the runner reports a non-metric **fairness view**: candidates bucketed
by demographic dimension — `race`, `gender`, `ageBand`, `nationalityStatus`
(missing values bucket as `unknown`) — with the number of flagged candidates and
total flags per bucket. This surfaces whether flags concentrate on a group,
which is the whole point of the tool, without pretending to be a calibrated
fairness score.

---

## Output

The runner writes a timestamped JSON report to `evals/runs/<timestamp>.json` and
prints a Markdown summary to the console. It is **reporting-only**: there is no
pass/fail threshold and it does not fail CI on low scores — it sets a non-zero
exit code only if the run itself throws.

The unit test
[`evalMetrics.test.ts`](../api/src/__tests__/evalMetrics.test.ts) asserts the
*scoring math* (PRF values, `null` semantics, span-overlap, greedy 1:1 matching,
fairness bucketing) — not model quality. Quality is read from the report, by a
human, deliberately.

---

## Known limitations

Stated honestly, because a mentor will find them:

- **Hiring-mode only.** The runner calls the engine without a `meetingType`, so
  it always evaluates in hiring mode; the four promotion-mode rules do not fire
  in the eval as currently written. Making the eval mode-aware is a known TODO.
- **Coarse fairness attribution.** A meeting's total predicted flags are
  attributed to *every* candidate in that meeting, rather than resolved
  per-candidate. Fine for the current 1-candidate-per-meeting seed; worth
  tightening before reading too much into multi-candidate meetings.

See **[ANALYSIS.md](./ANALYSIS.md)** for how the flags being scored here are
produced.

# Phase 2 — scope

Phase 1 delivered a working, privacy-first bias-awareness tool: manual transcript
upload, a hybrid rules + LLM analysis engine, the Decision Companion / Pattern
Mirror / HR Overview surfaces, database-enforced tenant isolation, and a
reproducible eval harness (see [ARCHITECTURE](./ARCHITECTURE.md),
[SECURITY](./SECURITY.md), [ANALYSIS](./ANALYSIS.md), [EVALUATION](./EVALUATION.md)).

Phase 2 turns the demo into something deployable inside a real organisation:
authoritative identity/data, live capture, a tuned and owned model, and a
platform decision. Five workstreams, roughly in dependency order.

---

## 1. HRIS integration

**Today:** managers, orgs, and candidates are seeded or created by hand; identity
is Clerk with **demo-only role self-select** (`auth.ts` — a registrant picks
`manager`/`hr_admin`, which is a privilege boundary that must not be self-served
in production).

**Phase 2:** treat the HRIS (Workday / SuccessFactors / BambooHR) as the source
of truth. Sync organisations, departments, managers, and candidates via SCIM
provisioning + change webhooks; derive **role and division from the HRIS**, not
self-select, closing the demo privilege gap. Map the HRIS org tree onto the
existing `Organisation`/`Department`/`Manager` tables so RLS scoping is unchanged.

**Watch:** demographic data is now authoritative and regulated — provenance,
consent, and retention become first-class, and the [SECURITY](./SECURITY.md)
model's aggregate-only HR guarantees get a compliance review.

---

## 2. Live transcription

**Today:** a manager pastes or uploads a finished transcript; analysis runs
asynchronously off the request path (`pending → running → completed`).

**Phase 2:** capture the debrief live — stream audio to an ASR provider
(Whisper / Deepgram / AssemblyAI) with speaker diarization, and feed the
finalized transcript into the **same** analysis pipeline. The existing async run
lifecycle already models "analysis in progress," so the engine largely doesn't
change; the new surface area is capture, consent prompts, and streaming ASR.

**Watch:** recording an interview raises consent + storage obligations well
beyond pasting text; diarization quality directly affects excerpt spans.

---

## 3. Model fine-tuning

**Today:** `gpt-4o-2024-08-06` with prompt-defined taxonomies, a 0.5 confidence
floor, merged with deterministic rules.

**Phase 2:** fine-tune on labelled flags to lift precision/recall and cut
cost/latency. The [eval harness](./EVALUATION.md) is the enabler — its ground-truth
`Flag` rows are the seed of a training/eval split, and its precision/recall/F1
report becomes the gate a fine-tune must beat before shipping. Candidate wins: a
smaller/cheaper model at parity, fewer JSON-repair retries, mode-aware scoring.

**Watch:** fine-tuning on real interview data needs de-identification and a
governance path; keep the rules layer as the explainable floor.

---

## 4. Nudge threshold tuning

**Today:** nudge fire thresholds are **conservative stubs** — `mirror-constants.ts`
(per-manager) and `hr-constants.ts` (org-level). They intentionally under-fire so
a bias-awareness tool never over-claims on sparse data.

**Phase 2:** tune from real behaviour. Add telemetry on fire rates and
nudge engagement, calibrate per-org (org N varies widely), and A/B thresholds
against a "useful vs noisy" signal. The severity-sort + top-N cap means lowering
a threshold surfaces marginal nudges without hiding strong ones, so tuning down
is the safe first move.

**Watch:** keep the two threshold sets distinct — per-manager and org-level have
different base rates and must not share numbers.

---

## 5. FastAPI migration (note, not commitment)

Workstreams 2–3 pull the centre of gravity toward the Python ML ecosystem
(ASR clients, fine-tuning, model serving, eval tooling). Worth evaluating whether
the analysis surface — or the whole API — should move from **Express/TypeScript**
to **Python/FastAPI** to sit closer to those tools.

**If pursued, preserve the security model verbatim:** the isolation guarantee is
the `app_user` role + the transaction-local `app.current_manager_id` session GUC
(today's `withManagerContext`). A FastAPI port must reproduce this exactly
(SQLAlchemy/asyncpg setting the same GUC per request-transaction) and re-run the
adversarial + policy-coverage suites against it before cutover — the RLS
contract, not the language, is what protects tenants.

**Leaning:** a **hybrid** is likely cheaper than a rewrite — keep the Express API,
extract the analysis engine into a Python service behind the existing
secret-authenticated `POST /internal/analysis/:runId/results` callback (already
designed for an external worker). That isolates the Python surface to where it
earns its keep without re-porting auth, RLS, and every CRUD route.

---

## Sequencing

HRIS (1) unblocks real deployment; live transcription (2) and fine-tuning (3) are
the product bets and can run in parallel once data is authoritative; threshold
tuning (4) needs real usage telemetry, so it trails adoption; the FastAPI
decision (5) should be made **before** (3) commits heavily, since it determines
where model code lives.

-- Week 5: Hiring/Promotion split + FlagSpan for per-occurrence highlighting.
--
-- Combines:
--   * DecisionOutcome enum widening (promoted, held)
--   * New MeetingType enum + meeting_type column on meetings
--   * Four new FlagType values for promotion-mode rules
--   * New flag_spans table + index (1:N with flags, ON DELETE CASCADE)
--   * Three promotion-only columns on candidates
--
-- All additive; no data loss. Existing meetings default to 'hiring'.
-- RLS policies for the new flag_spans table live in
-- prisma/manual/003_rls_flag_spans.sql — run that after this migration.

-- ── DecisionOutcome: widen with promoted + held ───────────────────────────
-- Postgres requires ADD VALUE outside a transaction; Prisma migrate splits
-- these into separate statements automatically.

ALTER TYPE "DecisionOutcome" ADD VALUE 'promoted';
ALTER TYPE "DecisionOutcome" ADD VALUE 'held';


-- ── FlagType: four new promotion-mode values ──────────────────────────────

ALTER TYPE "FlagType" ADD VALUE 'potential_vs_performance';
ALTER TYPE "FlagType" ADD VALUE 'tenure_framing';
ALTER TYPE "FlagType" ADD VALUE 'peer_comparison_bias';
ALTER TYPE "FlagType" ADD VALUE 'confidence_proxy';


-- ── MeetingType: new enum + column on meetings ────────────────────────────

CREATE TYPE "MeetingType" AS ENUM ('hiring', 'promotion');

ALTER TABLE "meetings"
  ADD COLUMN "meeting_type" "MeetingType" NOT NULL DEFAULT 'hiring';


-- ── candidates: promotion-only fields ─────────────────────────────────────
-- All nullable; populated only via promotion uploads. For hiring candidates
-- these stay null.

ALTER TABLE "candidates"
  ADD COLUMN "current_role"     TEXT,
  ADD COLUMN "tenure_years"     INTEGER,
  ADD COLUMN "last_promoted_at" TIMESTAMP(3);


-- ── flag_spans: per-occurrence offsets ────────────────────────────────────
-- One row per textual occurrence of a Flag in its meeting transcript.
-- start_offset / end_offset are character indexes into the transcript
-- string. CASCADE on flag delete keeps the table consistent with the
-- existing dismiss-or-keep flag lifecycle.

CREATE TABLE "flag_spans" (
  "id"           TEXT    NOT NULL,
  "flag_id"      TEXT    NOT NULL,
  "start_offset" INTEGER NOT NULL,
  "end_offset"   INTEGER NOT NULL,

  CONSTRAINT "flag_spans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flag_spans_flag_id_idx" ON "flag_spans"("flag_id");

ALTER TABLE "flag_spans"
  ADD CONSTRAINT "flag_spans_flag_id_fkey"
  FOREIGN KEY ("flag_id") REFERENCES "flags"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

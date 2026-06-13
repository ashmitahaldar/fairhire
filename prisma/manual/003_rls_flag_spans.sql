-- ============================================================
-- 003_rls_flag_spans.sql — RLS for flag_spans
--
-- Run this in the Supabase SQL editor AFTER applying:
--   prisma/migrations/<ts>_week5_flow_split/migration.sql
--
-- Why a separate file: flag_spans was added in Week 5 to back TipTap's
-- decoration ranges (one row per textual occurrence of a Flag in its
-- meeting transcript). Access is derived from the parent flag's
-- meeting ownership — same shape as the existing flags policies, just
-- with one extra JOIN.
--
-- Kept in manual/ rather than baked into the Prisma migration to match
-- how 001/002 are organised: RLS lives next to the table it protects,
-- not in the schema migration, so the security model can be reviewed
-- (and tightened later) without rewriting migration history.
-- ============================================================


-- ─── Enable RLS ───────────────────────────────────────────────────────────

ALTER TABLE flag_spans ENABLE ROW LEVEL SECURITY;

-- Restated explicitly even though 001_rls.sql:33-34's default-privilege
-- grant already covers new tables. Reads standalone.
GRANT SELECT, INSERT, UPDATE, DELETE ON flag_spans TO app_user;


-- ─── Policies ─────────────────────────────────────────────────────────────
-- Mirror flags (001_rls.sql:196-224): SELECT/INSERT/UPDATE all gated by
-- the parent flag's meeting ownership. DELETE is omitted — app code
-- never deletes spans directly; they cascade with the parent Flag, and
-- re-runs of analysis create fresh flag rows (Section 5 of the Week 5
-- plan). If a future code path needs DELETE, add an explicit policy.

CREATE POLICY "managers_select_own_flag_spans"
  ON flag_spans FOR SELECT TO app_user
  USING (
    flag_id IN (
      SELECT f.id
      FROM flags f
      JOIN meetings m ON m.id = f.meeting_id
      WHERE m.manager_id = current_manager_id()
    )
  );

CREATE POLICY "managers_insert_own_flag_spans"
  ON flag_spans FOR INSERT TO app_user
  WITH CHECK (
    flag_id IN (
      SELECT f.id
      FROM flags f
      JOIN meetings m ON m.id = f.meeting_id
      WHERE m.manager_id = current_manager_id()
    )
  );

CREATE POLICY "managers_update_own_flag_spans"
  ON flag_spans FOR UPDATE TO app_user
  USING (
    flag_id IN (
      SELECT f.id
      FROM flags f
      JOIN meetings m ON m.id = f.meeting_id
      WHERE m.manager_id = current_manager_id()
    )
  )
  WITH CHECK (
    flag_id IN (
      SELECT f.id
      FROM flags f
      JOIN meetings m ON m.id = f.meeting_id
      WHERE m.manager_id = current_manager_id()
    )
  );


-- ─── Verify ───────────────────────────────────────────────────────────────
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename = 'flag_spans';
--
-- SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'flag_spans';

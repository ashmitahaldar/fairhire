-- ============================================================
-- 004_rls_flags_delete.sql — DELETE policy for flags
--
-- Run this in the Supabase SQL editor AFTER 001_rls.sql.
--
-- Bug it fixes: re-running analysis on a meeting doubled the flag set.
-- The re-run handler (POST /meetings/:id/analyse) wipes existing flags
-- with `tx.flag.deleteMany({ where: { meetingId } })` inside
-- withManagerContext (app_user role) before the new run writes fresh
-- flags. But 001_rls.sql only created SELECT/INSERT/UPDATE policies on
-- flags — there was no DELETE policy. Under RLS, a DELETE with no
-- permissive policy matches zero rows and does NOT error, so the wipe
-- silently no-op'd and runAnalysis appended a second copy of every flag.
--
-- The DELETE predicate mirrors the existing SELECT/UPDATE policies
-- (001_rls.sql:196-224): a manager may delete flags on meetings they own.
-- flag_spans cascade with the parent flag via the FK (ON DELETE CASCADE),
-- and FK cascade actions bypass RLS, so no flag_spans DELETE policy is
-- needed — see the note in 003_rls_flag_spans.sql.
--
-- Idempotent: drops the policy first so this file is safe to re-run.
-- ============================================================


-- RLS + the table grant are already established in 001_rls.sql; the GRANT
-- is restated so this file reads standalone (GRANT is idempotent).
GRANT DELETE ON flags TO app_user;

DROP POLICY IF EXISTS "managers_delete_own_flags" ON flags;

CREATE POLICY "managers_delete_own_flags"
  ON flags FOR DELETE TO app_user
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE manager_id = current_manager_id()
    )
  );


-- ─── Verify ───────────────────────────────────────────────────────────────
-- SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'flags' ORDER BY cmd;
-- -- expect a row: managers_delete_own_flags | DELETE

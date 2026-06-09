-- ============================================================
-- 002_rls_candidate_demographics.sql — RLS for candidate_demographics
--
-- Run this in the Supabase SQL editor AFTER applying all pending migrations:
--   npm run db:migrate
--
-- Why a separate file: the `candidate_demographics` table was carved out of
-- `candidates` so protected/self-reported attributes can be access-controlled
-- independently from the rest of the candidate record. Keeping its policies in
-- their own file leaves room to tighten the policy later (e.g. audit/HR only)
-- without re-editing 001_rls.sql or another migration.
--
-- For now: mirror the org-level pattern already used by `candidates` — any
-- manager in the org may SELECT and INSERT.
-- ============================================================


-- ─── Enable RLS ───────────────────────────────────────────────────────────

ALTER TABLE candidate_demographics ENABLE ROW LEVEL SECURITY;

-- Table privileges stay broad — SELECT/INSERT/UPDATE/DELETE — matching the
-- default-privilege grant in 001_rls.sql:33-34 (which already covers every new
-- table) and every other table in the schema. Restated explicitly so the file
-- reads standalone. Access is narrowed to read+insert by the policies below,
-- not by withholding table privileges — see the note there.
GRANT SELECT, INSERT, UPDATE, DELETE ON candidate_demographics TO app_user;


-- ─── Policies ─────────────────────────────────────────────────────────────
-- Mirrors `candidates` (001_rls.sql:108-145):
--   SELECT + INSERT are org-scoped (any manager in the org).
--   UPDATE is narrower — only managers who have interviewed the candidate
--   (matches requireOwnership('candidate') and the candidates UPDATE policy).
-- DELETE policy is omitted: app code never hard-deletes a demographics row;
-- when present rows are upserted, when absent they are created via the
-- INSERT policy. No code path needs DELETE.

CREATE POLICY "managers_select_org_candidate_demographics"
  ON candidate_demographics FOR SELECT TO app_user
  USING (
    org_id = (SELECT org_id FROM managers WHERE id = current_manager_id())
  );

CREATE POLICY "managers_insert_org_candidate_demographics"
  ON candidate_demographics FOR INSERT TO app_user
  WITH CHECK (
    org_id = (SELECT org_id FROM managers WHERE id = current_manager_id())
  );

CREATE POLICY "managers_update_linked_candidate_demographics"
  ON candidate_demographics FOR UPDATE TO app_user
  USING (
    EXISTS (
      SELECT 1
      FROM meeting_candidates mc
      JOIN meetings m ON m.id = mc.meeting_id
      WHERE mc.candidate_id = candidate_demographics.candidate_id
        AND m.manager_id = current_manager_id()
    )
  )
  WITH CHECK (
    org_id = (SELECT org_id FROM managers WHERE id = current_manager_id())
  );


-- ─── Verify ───────────────────────────────────────────────────────────────
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename = 'candidate_demographics';
--
-- SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'candidate_demographics';

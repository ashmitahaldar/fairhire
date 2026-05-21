-- ============================================================
-- 002_rls_candidate_demographics.sql — RLS for candidate_demographics
--
-- Run this in the Supabase SQL editor AFTER:
--   npm run db:migrate -- --name normalize_candidate_demographics
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
-- Mirrors `candidates` (001_rls.sql:108-118): org-scoped SELECT + INSERT.
-- Only SELECT and INSERT *policies* are defined. UPDATE/DELETE policies are
-- deliberately omitted: table privileges above remain broad, but with no
-- UPDATE/DELETE policy RLS blocks those operations for app_user anyway. Net
-- effective access is read+insert — same as `candidates`.

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


-- ─── Verify ───────────────────────────────────────────────────────────────
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename = 'candidate_demographics';
--
-- SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'candidate_demographics';

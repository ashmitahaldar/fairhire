-- ============================================================
-- 001_rls.sql — Row-Level Security setup
--
-- Run this in the Supabase SQL editor AFTER running:
--   npm run db:migrate
--
-- Step-by-step:
--   1. Replace REPLACE_WITH_STRONG_PASSWORD below with a real password
--   2. Paste and run this entire file in Supabase → SQL Editor
--   3. Update your .env DATABASE_URL to connect as app_user:
--      postgresql://app_user:<password>@<host>:6543/postgres?pgbouncer=true
--      (DIRECT_URL stays as the postgres superuser connection)
-- ============================================================


-- ─── app_user role ────────────────────────────────────────────────────────
-- Non-superuser role used by the Prisma client (API).
-- RLS policies apply to this role; postgres superuser bypasses RLS.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD '456Password123';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Ensures future tables (e.g. after new migrations) also get permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;


-- ─── Enable RLS on all tables ─────────────────────────────────────────────

ALTER TABLE organisations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_candidates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE flags               ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_runs       ENABLE ROW LEVEL SECURITY;


-- ─── Helper function ──────────────────────────────────────────────────────
-- Returns the current manager UUID from the session variable.
-- The API sets this via: SELECT set_config('app.current_manager_id', id, true)
-- The second argument (true) makes it transaction-local.
-- Returns NULL if not set (no policies will match → no rows returned).

CREATE OR REPLACE FUNCTION current_manager_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_manager_id', true), '')
$$;


-- ─── organisations ────────────────────────────────────────────────────────

CREATE POLICY "managers_select_own_org"
  ON organisations FOR SELECT TO app_user
  USING (
    id = (SELECT org_id FROM managers WHERE id = current_manager_id())
  );


-- ─── departments ──────────────────────────────────────────────────────────

CREATE POLICY "managers_select_org_departments"
  ON departments FOR SELECT TO app_user
  USING (
    org_id = (SELECT org_id FROM managers WHERE id = current_manager_id())
  );


-- ─── managers ─────────────────────────────────────────────────────────────
-- A manager can only read their own row — prevents lateral snooping.

CREATE POLICY "managers_select_self"
  ON managers FOR SELECT TO app_user
  USING (id = current_manager_id());

-- Allow insert during first-login onboarding (auth sync endpoint).
-- The API inserts the new Manager row before the session variable is set,
-- so this uses a permissive insert policy checked by application logic instead.
CREATE POLICY "managers_insert_self"
  ON managers FOR INSERT TO app_user
  WITH CHECK (true);

CREATE POLICY "managers_update_self"
  ON managers FOR UPDATE TO app_user
  USING (id = current_manager_id())
  WITH CHECK (id = current_manager_id());


-- ─── candidates ───────────────────────────────────────────────────────────
-- Candidates are org-scoped for SELECT/INSERT (any manager in the org can
-- read and create) but writes (UPDATE — covers soft-delete via deleted_at)
-- are narrower: only managers who have actually interviewed the candidate
-- (i.e. there is a meeting_candidates row joined to a meeting they own).
-- This matches requireOwnership('candidate') in
-- api/src/middleware/requireOwnership.ts so the JS-side gate and the
-- database-side gate agree.

CREATE POLICY "managers_select_org_candidates"
  ON candidates FOR SELECT TO app_user
  USING (
    org_id = (SELECT org_id FROM managers WHERE id = current_manager_id())
  );

CREATE POLICY "managers_insert_org_candidates"
  ON candidates FOR INSERT TO app_user
  WITH CHECK (
    org_id = (SELECT org_id FROM managers WHERE id = current_manager_id())
  );

CREATE POLICY "managers_update_linked_candidates"
  ON candidates FOR UPDATE TO app_user
  USING (
    EXISTS (
      SELECT 1
      FROM meeting_candidates mc
      JOIN meetings m ON m.id = mc.meeting_id
      WHERE mc.candidate_id = candidates.id
        AND m.manager_id = current_manager_id()
    )
  )
  WITH CHECK (
    org_id = (SELECT org_id FROM managers WHERE id = current_manager_id())
  );


-- ─── meetings ─────────────────────────────────────────────────────────────

CREATE POLICY "managers_select_own_meetings"
  ON meetings FOR SELECT TO app_user
  USING (manager_id = current_manager_id());

CREATE POLICY "managers_insert_own_meetings"
  ON meetings FOR INSERT TO app_user
  WITH CHECK (manager_id = current_manager_id());

CREATE POLICY "managers_update_own_meetings"
  ON meetings FOR UPDATE TO app_user
  USING  (manager_id = current_manager_id())
  WITH CHECK (manager_id = current_manager_id());


-- ─── meeting_candidates ───────────────────────────────────────────────────

CREATE POLICY "managers_select_own_meeting_candidates"
  ON meeting_candidates FOR SELECT TO app_user
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE manager_id = current_manager_id()
    )
  );

CREATE POLICY "managers_insert_own_meeting_candidates"
  ON meeting_candidates FOR INSERT TO app_user
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM meetings WHERE manager_id = current_manager_id()
    )
  );


-- ─── decisions ────────────────────────────────────────────────────────────

CREATE POLICY "managers_select_own_decisions"
  ON decisions FOR SELECT TO app_user
  USING (manager_id = current_manager_id());

CREATE POLICY "managers_insert_own_decisions"
  ON decisions FOR INSERT TO app_user
  WITH CHECK (manager_id = current_manager_id());

CREATE POLICY "managers_update_own_decisions"
  ON decisions FOR UPDATE TO app_user
  USING  (manager_id = current_manager_id())
  WITH CHECK (manager_id = current_manager_id());


-- ─── flags ────────────────────────────────────────────────────────────────
-- Flags belong to meetings; access is derived from meeting ownership.

CREATE POLICY "managers_select_own_flags"
  ON flags FOR SELECT TO app_user
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE manager_id = current_manager_id()
    )
  );

CREATE POLICY "managers_insert_own_flags"
  ON flags FOR INSERT TO app_user
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM meetings WHERE manager_id = current_manager_id()
    )
  );

-- Dismiss-with-reason is the only update a manager performs on a flag.
CREATE POLICY "managers_update_own_flags"
  ON flags FOR UPDATE TO app_user
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE manager_id = current_manager_id()
    )
  )
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM meetings WHERE manager_id = current_manager_id()
    )
  );


-- ─── analysis_runs ────────────────────────────────────────────────────────

CREATE POLICY "managers_select_own_analysis_runs"
  ON analysis_runs FOR SELECT TO app_user
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE manager_id = current_manager_id()
    )
  );

-- Inserts and updates come from the internal API endpoint.
-- That endpoint resolves the meeting's manager_id and sets the session variable
-- before writing, so the same ownership policy applies.
CREATE POLICY "managers_insert_own_analysis_runs"
  ON analysis_runs FOR INSERT TO app_user
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM meetings WHERE manager_id = current_manager_id()
    )
  );

CREATE POLICY "managers_update_own_analysis_runs"
  ON analysis_runs FOR UPDATE TO app_user
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE manager_id = current_manager_id()
    )
  )
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM meetings WHERE manager_id = current_manager_id()
    )
  );


-- ─── Verify ───────────────────────────────────────────────────────────────
-- Run this query to confirm all tables have RLS enabled and policies created:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- SELECT schemaname, tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- ============================================================
-- 005_hr_aggregates.sql — HR org-level aggregate read functions
--
-- Run this in the Supabase SQL editor AFTER 001–004.
--
-- Why functions (not the base tables): the HR view's central promise is that
-- HR sees only aggregated, anonymised org metrics — never an individual
-- manager's rows. These SECURITY DEFINER functions return ONLY aggregate
-- columns (no manager_id / excerpt / reasoning), so a manager-identifiable
-- row is structurally unrepresentable, not merely filtered in app code.
--
-- How access works:
--   * SECURITY DEFINER → the function body runs as its owner (postgres, the
--     role that runs this file), which bypasses base-table RLS so the
--     aggregation can actually see the org's rows. Without this the app_user
--     caller would aggregate over its own RLS-limited rows → all zeros.
--   * Org is derived from current_manager_id() INSIDE the function, never
--     passed by the caller — so a caller cannot aggregate a different org.
--     The API reads these inside withManagerContext(req.manager.id, …) so the
--     session GUC is set; the function reads the same GUC.
--   * The /hr route still enforces requireRole('hr_admin') — the functions
--     are aggregate-only defense-in-depth, not the role gate.
--
-- Period is scoped on meetings.date to match the Pattern Mirror's windows.
-- Idempotent: CREATE OR REPLACE.
-- ============================================================


-- ─── hr_flag_summary ──────────────────────────────────────────────────────
-- One row per flag type fired in the window, with raised + dismissed counts.

CREATE OR REPLACE FUNCTION hr_flag_summary(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(flag_type text, count bigint, dismissed bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.flag_type::text,
         COUNT(*)::bigint,
         COUNT(*) FILTER (WHERE f.dismissed)::bigint
  FROM flags f
  JOIN meetings m ON m.id = f.meeting_id
  WHERE m.org_id = (SELECT org_id FROM managers WHERE id = current_manager_id())
    AND m.date >= p_start AND m.date <= p_end
  GROUP BY f.flag_type
$$;


-- ─── hr_decision_summary ──────────────────────────────────────────────────
-- One row per decision outcome recorded in the window.

CREATE OR REPLACE FUNCTION hr_decision_summary(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(outcome text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.outcome::text,
         COUNT(*)::bigint
  FROM decisions d
  JOIN meetings m ON m.id = d.meeting_id
  WHERE m.org_id = (SELECT org_id FROM managers WHERE id = current_manager_id())
    AND m.date >= p_start AND m.date <= p_end
  GROUP BY d.outcome
$$;


-- ─── hr_demographic_summary ───────────────────────────────────────────────
-- Org-level composition across the hiring funnel, by race (with 'unknown'
-- for candidates whose demographics row is missing or whose race is null —
-- mirrors the Pattern Mirror's pipeline conventions). applied = candidates
-- added to the org in the window; hired/rejected = distinct candidates with a
-- hiring decision of that outcome in the window. The race spine guarantees a
-- row for every segment so the client renders a stable shape at zero.

CREATE OR REPLACE FUNCTION hr_demographic_summary(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(race text, applied bigint, hired bigint, rejected bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (
    SELECT org_id FROM managers WHERE id = current_manager_id()
  ),
  applied AS (
    SELECT COALESCE(cd.race::text, 'unknown') AS race, COUNT(*)::bigint AS n
    FROM candidates c
    LEFT JOIN candidate_demographics cd ON cd.candidate_id = c.id
    WHERE c.org_id = (SELECT org_id FROM org)
      AND c.deleted_at IS NULL
      AND c.created_at >= p_start AND c.created_at <= p_end
    GROUP BY 1
  ),
  decided AS (
    SELECT COALESCE(cd.race::text, 'unknown') AS race,
           d.outcome::text AS outcome,
           COUNT(DISTINCT d.candidate_id)::bigint AS n
    FROM decisions d
    JOIN meetings m ON m.id = d.meeting_id
    LEFT JOIN candidate_demographics cd ON cd.candidate_id = d.candidate_id
    WHERE m.org_id = (SELECT org_id FROM org)
      AND m.date >= p_start AND m.date <= p_end
      AND d.outcome IN ('hired', 'rejected')
    GROUP BY 1, 2
  )
  SELECT r.race,
         COALESCE(a.n, 0)  AS applied,
         COALESCE(h.n, 0)  AS hired,
         COALESCE(rj.n, 0) AS rejected
  FROM (SELECT unnest(ARRAY['chinese', 'malay', 'indian', 'other', 'unknown']) AS race) r
  LEFT JOIN applied a  ON a.race = r.race
  LEFT JOIN decided h  ON h.race = r.race AND h.outcome = 'hired'
  LEFT JOIN decided rj ON rj.race = r.race AND rj.outcome = 'rejected'
$$;


-- ─── Grants ───────────────────────────────────────────────────────────────
-- app_user may EXECUTE; the SECURITY DEFINER body runs as the owner.

GRANT EXECUTE ON FUNCTION hr_flag_summary(timestamptz, timestamptz)        TO app_user;
GRANT EXECUTE ON FUNCTION hr_decision_summary(timestamptz, timestamptz)    TO app_user;
GRANT EXECUTE ON FUNCTION hr_demographic_summary(timestamptz, timestamptz) TO app_user;


-- ─── candidate_flag_counts ────────────────────────────────────────────────
-- Per-candidate flag counts for the caller's org — INCLUDING flags raised by
-- other managers. This deliberately crosses the manager-isolation boundary
-- the same way the HR functions do: it returns only counts, never another
-- manager's flag content, reasoning, or identity. `total` is org-wide;
-- `own` is the slice from the caller's own debriefs (so the UI can show
-- "N across the org · M by you"). A flag belongs to a meeting, so it counts
-- toward every candidate linked to that meeting (in practice one per meeting
-- in both hiring and promotion). Org derived from current_manager_id().
--
-- Same caveat as the HR aggregates: with a sparse org, total−own can point at
-- a single other manager. Accepted for this feature; surfaced as a count, not
-- as per-manager rows.

CREATE OR REPLACE FUNCTION candidate_flag_counts()
RETURNS TABLE(candidate_id text, total bigint, own bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mc.candidate_id,
         COUNT(*)::bigint AS total,
         COUNT(*) FILTER (WHERE m.manager_id = current_manager_id())::bigint AS own
  FROM meeting_candidates mc
  JOIN meetings m ON m.id = mc.meeting_id
  JOIN flags f ON f.meeting_id = m.id
  WHERE m.org_id = (SELECT org_id FROM managers WHERE id = current_manager_id())
  GROUP BY mc.candidate_id
$$;

GRANT EXECUTE ON FUNCTION candidate_flag_counts() TO app_user;


-- ─── Verify ───────────────────────────────────────────────────────────────
-- Confirm the functions exist and are SECURITY DEFINER (prosecdef = true):
--
-- SELECT proname, prosecdef
-- FROM pg_proc
-- WHERE proname IN ('hr_flag_summary', 'hr_decision_summary',
--                   'hr_demographic_summary', 'candidate_flag_counts')
-- ORDER BY proname;

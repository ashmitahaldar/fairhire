import {
  FLAG_TYPE_LABELS,
  type FlagType,
  type MirrorData,
  type MirrorDecision,
  type MirrorDecisionOutcome,
  type MirrorPeriod,
  type MirrorSummary,
  type PipelineRow,
} from '@fairhire/shared';
import type { TransactionClient } from '../lib/prisma';

// Pure aggregation service for the Pattern Mirror. Takes the authenticated
// manager and a period, returns the full MirrorData shape. Phase A
// populates `manager`, `summary`, `decisions`, `recentDecisions` from real
// DB data. Phase B/C/D fields (pipeline, languageFlags, nudges) ship as
// empty arrays for now and get filled in by Steps 5/6/7. See Section 1 of
// the Week 4 plan.
//
// Filtering convention: everything is scoped to meetings whose `date` falls
// in the period window. "Interviews this quarter" reads naturally, and
// derived metrics (flags raised, decisions recorded) inherit the same
// window so the numbers stay coherent across the screen.

// ── Period windows ────────────────────────────────────────────────────────

const PERIOD_DAYS: Record<MirrorPeriod, number> = {
  '30d': 30,
  '90d': 90,
  '12m': 365,
};

const PERIOD_LABELS: Record<MirrorPeriod, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
};

// Display options for the TimeRangeSelector. Order matters — the selector
// renders them as-is, so this is the canonical sequence shown to users.
export const PERIOD_OPTIONS: string[] = Object.values(PERIOD_LABELS);

export interface PeriodWindow {
  start: Date;
  end: Date;
}
export interface PeriodWindows {
  current: PeriodWindow;
  previous: PeriodWindow;
}

// Both windows are length-equal in days. The previous window sits
// immediately before the current — used by Phase B's delta computation
// but kept here so the period helpers stay one source of truth.
export function getPeriodWindows(period: MirrorPeriod, now: Date = new Date()): PeriodWindows {
  const ms = PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  const end = now;
  const start = new Date(end.getTime() - ms);
  const prevStart = new Date(start.getTime() - ms);
  return {
    current: { start, end },
    previous: { start: prevStart, end: start },
  };
}

// ── Public input/output ───────────────────────────────────────────────────

export interface AggregateMirrorInput {
  managerId: string;
  manager: { name: string; team: string };
  period: MirrorPeriod;
  now?: Date;
}

// Mirrored outcome labels for the Mirror view. The schema's
// DecisionOutcome is functional (hired | rejected | in_progress); the
// Mirror's display vocabulary is editorial. 'Advanced' isn't expressible
// in the current schema so Phase A omits it.
const OUTCOME_MAP: Record<'hired' | 'rejected' | 'in_progress', MirrorDecisionOutcome> = {
  hired: 'Hired',
  rejected: 'Declined',
  in_progress: 'Pending',
};

// ── Aggregator ────────────────────────────────────────────────────────────

export async function aggregateMirror(
  tx: TransactionClient,
  input: AggregateMirrorInput,
): Promise<MirrorData> {
  const { managerId, manager, period } = input;
  const now = input.now ?? new Date();
  const windows = getPeriodWindows(period, now);

  // Single fetch covers Phase A. Includes candidates (for role/name on
  // decisions), flags (for type counts + dismissed totals), and decisions
  // (for the editorial rows). RLS scopes to this manager via the calling
  // withManagerContext; the explicit managerId filter is belt-and-braces.
  const meetings = await tx.meeting.findMany({
    where: {
      managerId,
      date: { gte: windows.current.start, lte: windows.current.end },
    },
    select: {
      id: true,
      date: true,
      candidates: {
        select: {
          candidateId: true,
          candidate: { select: { name: true, roleAppliedFor: true } },
        },
      },
      flags: {
        select: { flagType: true, dismissed: true },
      },
      decisions: {
        select: { id: true, outcome: true, candidateId: true },
      },
    },
    orderBy: { date: 'desc' },
  });

  const summary = buildSummary(meetings);
  const decisions = buildDecisions(meetings, now);
  const recentDecisions = [...decisions].sort((a, b) => a.daysAgo - b.daysAgo).slice(0, 8);

  return {
    manager: {
      name: manager.name,
      team: manager.team,
      initials: initialsOf(manager.name),
    },
    period: PERIOD_LABELS[period],
    periodKey: period,
    periodOptions: PERIOD_OPTIONS,
    summary,
    decisions,
    recentDecisions,
    // Phase B/C/D placeholders. The frontend gates these per-section per
    // Section 1; an empty array is a valid "no data yet" signal.
    pipeline: [] as PipelineRow[],
    languageFlags: [],
    nudges: [],
  };
}

// ── Summary math ──────────────────────────────────────────────────────────

type MeetingRow = {
  id: string;
  date: Date;
  candidates: Array<{
    candidateId: string;
    candidate: { name: string; roleAppliedFor: string };
  }>;
  flags: Array<{ flagType: FlagType; dismissed: boolean }>;
  decisions: Array<{ id: string; outcome: 'hired' | 'rejected' | 'in_progress'; candidateId: string }>;
};

function buildSummary(meetings: MeetingRow[]): MirrorSummary {
  const interviewsCount = meetings.length;

  // Distinct roles across every candidate attached to a meeting in scope.
  // Meeting-level role uniqueness rather than candidate-level — a role
  // shared across managers is one role each, not double-counted.
  const roles = new Set<string>();
  for (const m of meetings) {
    for (const mc of m.candidates) {
      roles.add(mc.candidate.roleAppliedFor);
    }
  }

  const allFlags = meetings.flatMap((m) => m.flags);
  const totalFlags = allFlags.length;
  const dismissedFlags = allFlags.filter((f) => f.dismissed).length;
  const avgFlagsPerInterview =
    interviewsCount === 0 ? 0 : Number((totalFlags / interviewsCount).toFixed(1));

  // Top category by raw count. Ties go to whichever the groupBy returns
  // first — acceptable for a single-headline number; full distribution is
  // exposed via languageFlags in Phase B. Empty data → '—' / 0.
  const typeCounts = new Map<FlagType, number>();
  for (const f of allFlags) {
    typeCounts.set(f.flagType, (typeCounts.get(f.flagType) ?? 0) + 1);
  }
  let topType: FlagType | null = null;
  let topCount = 0;
  for (const [t, c] of typeCounts) {
    if (c > topCount) {
      topCount = c;
      topType = t;
    }
  }

  return {
    interviewsCount,
    rolesCount: roles.size,
    topCategory: topType ? FLAG_TYPE_LABELS[topType] : '—',
    topCategoryCount: topCount,
    avgFlagsPerInterview,
    dismissedFlags,
    totalFlags,
  };
}

// ── Decisions list ────────────────────────────────────────────────────────

function buildDecisions(meetings: MeetingRow[], now: Date): MirrorDecision[] {
  const out: MirrorDecision[] = [];
  for (const m of meetings) {
    // Lookup table so each decision can resolve to the right candidate
    // (a meeting can have multiple candidates and multiple decisions).
    const byId = new Map(m.candidates.map((c) => [c.candidateId, c.candidate]));
    const flagsCount = m.flags.length;
    for (const d of m.decisions) {
      const cand = byId.get(d.candidateId);
      if (!cand) continue; // orphan defensive — shouldn't happen with FK
      const { given, surname } = splitName(cand.name);
      out.push({
        id: d.id,
        date: shortDate(m.date),
        candidate: given,
        surname,
        role: cand.roleAppliedFor,
        flags: flagsCount,
        outcome: OUTCOME_MAP[d.outcome],
        daysAgo: daysBetween(m.date, now),
      });
    }
  }
  return out;
}

// ── Small helpers ─────────────────────────────────────────────────────────

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function splitName(name: string): { given: string; surname: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return { given: '', surname: '' };
  if (parts.length === 1) return { given: parts[0]!, surname: '' };
  return { given: parts[0]!, surname: parts.slice(1).join(' ') };
}

function shortDate(d: Date): string {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

function daysBetween(then: Date, now: Date): number {
  const ms = now.getTime() - then.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

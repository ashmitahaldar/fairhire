import {
  DELTA_PRIOR_WINDOW_MIN_FLAGS,
  RACE_SEGMENT_KEYS,
  type DecisionOutcome,
  type FlagType,
  type HrDecisionsResponse,
  type HrDemographicsResponse,
  type HrFlagsResponse,
  type MirrorPeriod,
  type RaceSegmentKey,
} from '@fairhire/shared';
import type { TransactionClient } from '../lib/prisma';
import { getPeriodWindows } from '../mirror/aggregator';

// Pure aggregation service for the HR org-level view. Distinct from
// mirror/aggregator.ts — that one is manager-scoped and returns named
// individual decisions; this one reads the SECURITY DEFINER aggregate
// functions in prisma/manual/005_hr_aggregates.sql, which expose only
// org-level counts (no manager identity / excerpt / reasoning).
//
// Every function takes the RLS-context transaction (the caller wraps these in
// withManagerContext so the functions' current_manager_id()-derived org
// scoping resolves) and a period, and returns the matching /hr/* shape.
//
// $queryRaw results count via COUNT(*)::bigint, so every numeric column comes
// back as a JS bigint — Number()'d at the edge here so the wire payload is
// plain numbers.

type FlagRow = { flag_type: string; count: bigint; dismissed: bigint };
type DecisionRow = { outcome: string; count: bigint };
type DemographicRow = { race: string; applied: bigint; hired: bigint; rejected: bigint };

export async function aggregateHrFlags(
  tx: TransactionClient,
  period: MirrorPeriod,
  now: Date = new Date(),
): Promise<HrFlagsResponse> {
  const w = getPeriodWindows(period, now);

  // Two windows: current drives the rows; previous drives the delta pip. Run
  // sequentially — the interactive-transaction client is a single connection.
  const current = await tx.$queryRaw<FlagRow[]>`
    SELECT flag_type, count, dismissed
    FROM hr_flag_summary(${w.current.start}, ${w.current.end})`;
  const previous = await tx.$queryRaw<FlagRow[]>`
    SELECT flag_type, count, dismissed
    FROM hr_flag_summary(${w.previous.start}, ${w.previous.end})`;

  const prevByType = new Map<string, number>(previous.map((r) => [r.flag_type, Number(r.count)]));
  const prevTotal = previous.reduce((s, r) => s + Number(r.count), 0);
  // Mirror's convention: suppress the delta when the prior window is too
  // sparse to compare against honestly.
  const sparse = prevTotal < DELTA_PRIOR_WINDOW_MIN_FLAGS;

  let total = 0;
  let dismissed = 0;
  const byType = current.map((r) => {
    const count = Number(r.count);
    const dis = Number(r.dismissed);
    total += count;
    dismissed += dis;
    return {
      type: r.flag_type as FlagType,
      count,
      dismissed: dis,
      delta: sparse ? null : count - (prevByType.get(r.flag_type) ?? 0),
    };
  });
  byType.sort((a, b) => b.count - a.count);

  return { period, total, dismissed, byType };
}

export async function aggregateHrDecisions(
  tx: TransactionClient,
  period: MirrorPeriod,
  now: Date = new Date(),
): Promise<HrDecisionsResponse> {
  const w = getPeriodWindows(period, now);
  const rows = await tx.$queryRaw<DecisionRow[]>`
    SELECT outcome, count
    FROM hr_decision_summary(${w.current.start}, ${w.current.end})`;

  let total = 0;
  const byOutcome = rows.map((r) => {
    const count = Number(r.count);
    total += count;
    return { outcome: r.outcome as DecisionOutcome, count };
  });
  byOutcome.sort((a, b) => b.count - a.count);

  return { period, total, byOutcome };
}

export async function aggregateHrDemographics(
  tx: TransactionClient,
  period: MirrorPeriod,
  now: Date = new Date(),
): Promise<HrDemographicsResponse> {
  const w = getPeriodWindows(period, now);
  const rows = await tx.$queryRaw<DemographicRow[]>`
    SELECT race, applied, hired, rejected
    FROM hr_demographic_summary(${w.current.start}, ${w.current.end})`;

  const order = new Map<string, number>(RACE_SEGMENT_KEYS.map((k, i) => [k, i]));
  const byRace = rows
    .map((r) => ({
      race: r.race as RaceSegmentKey,
      applied: Number(r.applied),
      hired: Number(r.hired),
      rejected: Number(r.rejected),
    }))
    .sort((a, b) => (order.get(a.race) ?? 99) - (order.get(b.race) ?? 99));

  return { period, byRace };
}

import { useState, type ReactNode } from 'react';
import {
  FLAG_TYPE_LABELS,
  RACE_SEGMENT_KEYS,
  decisionOutcomeLabel,
  type HrDecisionsResponse,
  type HrDemographicsResponse,
  type HrFlagsResponse,
  type MirrorPeriod,
} from '@fairhire/shared';
import type { LanguageFlagRow, PipelineRow, RaceSegmentKey } from '../lib/mirrorData';
import { useHrFlags, useHrDecisions, useHrDemographics, useHrNudges } from '../lib/useHrSummary';
import { Section } from '../components/pattern-mirror/Section';
import { NudgeCard } from '../components/pattern-mirror/NudgeCard';
import { TimeRangeSelector } from '../components/pattern-mirror/TimeRangeSelector';
import { LollipopChart } from '../components/pattern-mirror/charts/LollipopChart';
import { StackedBarChart } from '../components/pattern-mirror/charts/StackedBarChart';
import { TabBar } from '../components/shared/TabBar';
import { ChartSkeleton, InlineError } from '../components/shared/primitives';

// HR org-level view. Mirrors the Pattern Mirror's chrome (period selector,
// tab bar, editorial header) but reads the anonymised /hr/* aggregates — no
// individual manager, candidate, or flag is identifiable here. Charts are
// reused from the Mirror by shaping the HR aggregates into their existing
// prop types.

const PERIOD_LABELS: Record<MirrorPeriod, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
};
const LABEL_TO_KEY: Record<string, MirrorPeriod> = {
  'Last 30 days': '30d',
  'Last 90 days': '90d',
  'Last 12 months': '12m',
};
const PERIOD_OPTIONS = Object.values(PERIOD_LABELS);

const TABS = ['Overview', 'Flags', 'Demographics'] as const;
type Tab = (typeof TABS)[number];

// A nudge's linkTo carries a tab name; narrow it before switching tabs so an
// unrecognised value is ignored rather than landing on a non-existent tab.
function isTab(value: string | undefined): value is Tab {
  return value !== undefined && (TABS as readonly string[]).includes(value);
}

export default function HRDashboard() {
  const [period, setPeriod] = useState<MirrorPeriod>('90d');
  const [tab, setTab] = useState<Tab>('Overview');

  // Small payloads — fetch all on mount; each tab reads what it needs.
  const flags = useHrFlags(period);
  const decisions = useHrDecisions(period);
  const demographics = useHrDemographics(period);
  const nudges = useHrNudges(period);

  return (
    <div className="max-w-mirror mx-auto" data-screen-label={`HR · ${tab}`}>
      <Header
        period={PERIOD_LABELS[period]}
        onChangePeriod={(label) => {
          const key = LABEL_TO_KEY[label];
          if (key) setPeriod(key);
        }}
      />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      <div role="tabpanel" aria-label={tab} className="pt-10 pb-32">
        {tab === 'Overview' && (
          <OverviewTab flags={flags} decisions={decisions} nudges={nudges} onSeeIn={setTab} />
        )}
        {tab === 'Flags' && <FlagsTab flags={flags} />}
        {tab === 'Demographics' && <DemographicsTab demographics={demographics} />}
      </div>
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

function Header({
  period,
  onChangePeriod,
}: {
  period: string;
  onChangePeriod: (label: string) => void;
}) {
  return (
    <div className="pt-8 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-6">
        <div>
          <div className="font-serif italic text-base text-ink-tertiary mb-2">HR Overview</div>
          <h1 className="font-serif text-page text-ink leading-tight mb-3">
            Organisation-wide patterns
          </h1>
          <div className="font-serif italic text-section text-ink-secondary">
            Aggregated and anonymised — no individual manager is identifiable here.
          </div>
        </div>
        <TimeRangeSelector options={PERIOD_OPTIONS} value={period} onChange={onChangePeriod} />
      </div>
    </div>
  );
}

function Stat({ children }: { children: ReactNode }) {
  return <span className="font-mono text-base tabular-nums">{children}</span>;
}

// ── Shared query-state wrappers ──────────────────────────────────────────────

function Loading() {
  return <ChartSkeleton />;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="font-serif italic text-base text-ink-tertiary">{children}</p>;
}

// ── Adapters: HR aggregates → existing chart prop shapes ─────────────────────

function flagsToLollipop(data: HrFlagsResponse): LanguageFlagRow[] {
  return data.byType.map((r) => ({
    id: r.type,
    label: FLAG_TYPE_LABELS[r.type],
    count: r.count,
    delta: r.delta,
  }));
}

function demographicsToPipeline(data: HrDemographicsResponse): PipelineRow[] {
  const stages: Array<{ stage: string; key: 'applied' | 'hired' | 'rejected' }> = [
    { stage: 'Applied', key: 'applied' },
    { stage: 'Hired', key: 'hired' },
    { stage: 'Rejected', key: 'rejected' },
  ];
  return stages.map(({ stage, key }) => {
    const segments = {} as Record<RaceSegmentKey, number>;
    for (const k of RACE_SEGMENT_KEYS) segments[k] = 0;
    for (const row of data.byRace) segments[row.race] = row[key];
    const total = RACE_SEGMENT_KEYS.reduce((s, k) => s + segments[k], 0);
    return { stage, segments, total };
  });
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({
  flags,
  decisions,
  nudges,
  onSeeIn,
}: {
  flags: ReturnType<typeof useHrFlags>;
  decisions: ReturnType<typeof useHrDecisions>;
  nudges: ReturnType<typeof useHrNudges>;
  onSeeIn: (tab: Tab) => void;
}) {
  if (flags.isLoading || decisions.isLoading) return <Loading />;
  if (flags.isError)
    return <InlineError error={flags.error} onRetry={() => void flags.refetch()} fallback="Couldn’t load this data." />;
  if (decisions.isError)
    return <InlineError error={decisions.error} onRetry={() => void decisions.refetch()} fallback="Couldn’t load this data." />;
  if (!flags.data || !decisions.data) return null;

  const f = flags.data;
  const d = decisions.data;
  const nothing = f.total === 0 && d.total === 0;

  if (nothing) {
    return <Empty>No organisation-wide activity in this period — try a wider range.</Empty>;
  }

  // Nudges are supplementary: a load failure shouldn't blank the Overview, so
  // we only render the strip when they resolve with at least one reflection.
  const visibleNudges = nudges.data?.nudges ?? [];

  // Unlike the Mirror (always exactly three), HR fires a variable 0–3. Size the
  // grid to the count so one or two nudges fill the row instead of floating in a
  // fixed 3-column track with empty cells. Literal classes keep Tailwind's JIT
  // happy (it can't see an interpolated `grid-cols-${n}`).
  const nudgeCols =
    visibleNudges.length === 1
      ? 'grid-cols-1'
      : visibleNudges.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-3';

  return (
    <>
      <p className="font-serif text-section text-ink leading-snug max-w-3xl [text-wrap:pretty] mb-12">
        Across the organisation, <Stat>{f.total}</Stat> language{' '}
        {f.total === 1 ? 'flag was' : 'flags were'} raised over <Stat>{d.total}</Stat>{' '}
        {d.total === 1 ? 'decision' : 'decisions'} this period, of which{' '}
        <Stat>{f.dismissed}</Stat> {f.dismissed === 1 ? 'flag was' : 'flags were'} dismissed.
      </p>

      {visibleNudges.length > 0 && (
        <Section
          title="Patterns worth a closer look"
          caption="Drawn from the organisation-wide aggregates below — never an individual manager."
          anchor="hr-nudges"
        >
          <div className={`grid ${nudgeCols} gap-4`}>
            {visibleNudges.map((n) => (
              <NudgeCard
                key={n.id}
                nudge={n}
                onSeeInstances={(nudge) => {
                  if (isTab(nudge.linkTo)) onSeeIn(nudge.linkTo);
                }}
              />
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Most frequent flag categories"
        caption="Across the whole organisation, by count"
        anchor="hr-flags"
      >
        {f.byType.length === 0 ? (
          <Empty>No flags raised across the organisation in this period.</Empty>
        ) : (
          <LollipopChart data={flagsToLollipop(f)} />
        )}
      </Section>

      <Section
        title="Decisions by outcome"
        caption="Organisation-wide decision distribution"
        anchor="hr-decisions"
      >
        {d.byOutcome.length === 0 ? (
          <Empty>No decisions recorded across the organisation in this period.</Empty>
        ) : (
          <OutcomeBreakdown data={d} />
        )}
      </Section>
    </>
  );
}

// Compact outcome distribution. Uses the same hairline-track / ink-fill idiom
// as the Mirror's charts rather than a new chart type — decision outcomes
// aren't a FlagType, so they can't ride the LollipopChart contract.
function OutcomeBreakdown({ data }: { data: HrDecisionsResponse }) {
  const max = Math.max(1, ...data.byOutcome.map((o) => o.count));
  return (
    <div className="space-y-2.5">
      {data.byOutcome.map((o) => {
        const widthPct = (o.count / max) * 100;
        return (
          <div
            key={o.outcome}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: '160px 1fr 56px' }}
          >
            <div className="text-base text-ink truncate">
              {decisionOutcomeLabel('hiring', o.outcome)}
            </div>
            <div className="relative h-3">
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-hairline" />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-px"
                style={{ width: `${widthPct}%`, background: 'var(--color-text-primary)' }}
              />
            </div>
            <div className="font-mono text-sm tabular-nums text-right text-ink">{o.count}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Flags ─────────────────────────────────────────────────────────────────────

function FlagsTab({ flags }: { flags: ReturnType<typeof useHrFlags> }) {
  if (flags.isLoading) return <Loading />;
  if (flags.isError)
    return <InlineError error={flags.error} onRetry={() => void flags.refetch()} fallback="Couldn’t load this data." />;
  if (!flags.data) return null;

  const f = flags.data;
  return (
    <Section
      title="Flags by category"
      caption="Across the whole organisation, sorted by frequency. Delta vs the previous period."
      anchor="hr-flags-detail"
    >
      {f.byType.length === 0 ? (
        <Empty>No flags raised across the organisation in this period.</Empty>
      ) : (
        <LollipopChart data={flagsToLollipop(f)} labelWidth={300} />
      )}
    </Section>
  );
}

// ── Demographics ───────────────────────────────────────────────────────────────

function DemographicsTab({
  demographics,
}: {
  demographics: ReturnType<typeof useHrDemographics>;
}) {
  if (demographics.isLoading) return <Loading />;
  if (demographics.isError)
    return (
      <InlineError
        error={demographics.error}
        onRetry={() => void demographics.refetch()}
        fallback="Couldn’t load this data."
      />
    );
  if (!demographics.data) return null;

  const pipeline = demographicsToPipeline(demographics.data);
  const empty = pipeline.every((row) => row.total === 0);

  return (
    <Section
      title="Composition by stage"
      caption="Representation across the hiring funnel, organisation-wide"
      anchor="hr-composition"
    >
      {empty ? (
        <Empty>No demographic data across the organisation in this period.</Empty>
      ) : (
        <StackedBarChart data={pipeline} totalLabel="Total candidates" />
      )}
    </Section>
  );
}

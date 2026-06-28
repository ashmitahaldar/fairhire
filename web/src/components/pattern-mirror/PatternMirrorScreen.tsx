import { useEffect, useState, type ReactNode } from 'react';
import { MEETING_TYPES, MEETING_TYPE_LABELS, type MeetingType } from '@fairhire/shared';
import type { MirrorData } from '../../lib/mirrorData';
import { Section } from './Section';
import { NudgeCard } from './NudgeCard';
import { TabBar } from '../shared/TabBar';
import { TimeRangeSelector } from './TimeRangeSelector';
import { RecentDecisionsTable } from './RecentDecisionsTable';
import { ConversionGrid } from './ConversionGrid';
import { LangSmallMultiples } from './LangSmallMultiples';
import { TimelineChart } from './charts/TimelineChart';
import { StackedBarChart } from './charts/StackedBarChart';
import { LollipopChart } from './charts/LollipopChart';

// Hiring shows all four tabs. Promotion drops Demographics — the
// pipeline-funnel concept doesn't apply to promotion decisioning, and
// the aggregator returns an empty pipeline in that mode anyway.
const HIRING_TABS = ['Overview', 'Decisions', 'Language', 'Demographics'] as const;
const PROMOTION_TABS = ['Overview', 'Decisions', 'Language'] as const;
type Tab = (typeof HIRING_TABS)[number];

interface PatternMirrorScreenProps {
  data: MirrorData;
  // The active mode. Optional with a hiring default so mock-data
  // previews (no wiring) keep rendering the original 4-tab view.
  meetingType?: MeetingType;
  onMeetingTypeChange?: (mt: MeetingType) => void;
  // When provided the period selector becomes controlled — the wrapper
  // converts label → MirrorPeriod key, refetches, and the new data.period
  // re-flows through this prop. When omitted (mock-data preview), clicks
  // are no-ops since the mock has only one period anyway.
  onPeriodChange?: (label: string) => void;
}

export function PatternMirrorScreen({
  data,
  meetingType = 'hiring',
  onMeetingTypeChange,
  onPeriodChange,
}: PatternMirrorScreenProps) {
  const tabs: readonly Tab[] = meetingType === 'promotion' ? PROMOTION_TABS : HIRING_TABS;
  const [tab, setTab] = useState<Tab>('Overview');

  // Switching mode can knock the active tab out of the available set
  // (Demographics → Promotion). Snap back to Overview when that happens
  // so the user isn't stranded on a non-existent tab.
  useEffect(() => {
    if (!tabs.includes(tab)) setTab('Overview');
  }, [tabs, tab]);

  // Nudge "See in {tab} ›" link handler. nudge.linkTo carries a tab name
  // (e.g. 'Language', 'Decisions') — switch to it when valid AND the tab
  // exists in the current mode, no-op otherwise.
  const seeInstances = (linkTo: string | undefined) => {
    if (!linkTo) return;
    if ((tabs as readonly string[]).includes(linkTo)) {
      setTab(linkTo as Tab);
    }
  };

  // Zero interviews in the selected period: the editorial sentence and every
  // chart would render against empty data. Show one editorial empty state
  // instead, keeping the header (period selector + mode toggle) so the user
  // can widen the range or switch mode.
  const noData = data.summary.interviewsCount === 0;

  return (
    <div className="max-w-mirror mx-auto" data-screen-label={`01 Mirror · ${meetingType} · ${tab}`}>
      <MirrorHeader
        data={data}
        period={data.period}
        meetingType={meetingType}
        onChangeMeetingType={onMeetingTypeChange}
        onChangePeriod={onPeriodChange ?? (() => {})}
      />
      {noData ? (
        <EmptyPeriod meetingType={meetingType} />
      ) : (
        <>
          <TabBar tabs={tabs} active={tab} onChange={setTab} />
          <div role="tabpanel" aria-label={tab} className="pt-10 pb-32">
            {tab === 'Overview' && (
              <OverviewTab
                data={data}
                meetingType={meetingType}
                onOpenAllDecisions={() => setTab('Decisions')}
                onSeeInstances={seeInstances}
              />
            )}
            {tab === 'Decisions' && <DecisionsTab data={data} />}
            {tab === 'Language' && <LanguageTab data={data} onSeeInstances={seeInstances} />}
            {tab === 'Demographics' && <DemographicsTab data={data} onSeeInstances={seeInstances} />}
          </div>
        </>
      )}
    </div>
  );
}

// Whole-screen empty state when there are no interviews/discussions in the
// selected period. Editorial tone, consistent with the Candidates empty state.
function EmptyPeriod({ meetingType }: { meetingType: MeetingType }) {
  const noun = meetingType === 'promotion' ? 'promotion discussions' : 'interviews';
  return (
    <div className="border-t border-hairline pt-12">
      <p className="font-serif italic text-section text-ink-secondary [text-wrap:pretty]">
        No {noun} in this period. Upload a debrief or widen the range above to see your
        patterns.
      </p>
    </div>
  );
}

// Inline empty note for a single section (e.g. no flags raised this period).
function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="font-serif italic text-base text-ink-tertiary">{children}</p>;
}

// ── Header: manager + range + the editorial summary sentence ───────────────

function MirrorHeader({
  data,
  period,
  meetingType,
  onChangeMeetingType,
  onChangePeriod,
}: {
  data: MirrorData;
  period: string;
  meetingType: MeetingType;
  onChangeMeetingType?: (mt: MeetingType) => void;
  onChangePeriod: (p: string) => void;
}) {
  const { manager, summary, periodOptions } = data;
  return (
    <div className="pt-10 pb-10">
      <div className="flex items-end justify-between gap-8 mb-8">
        <div>
          <div className="font-serif italic text-base text-ink-tertiary mb-2">Pattern Mirror</div>
          <h1 className="font-serif text-page text-ink leading-tight mb-3">{manager.name}</h1>
          <div className="font-serif italic text-section text-ink-secondary">{manager.team}</div>
        </div>
        <div className="flex flex-col items-end gap-3">
          {onChangeMeetingType && (
            <ModeToggle value={meetingType} onChange={onChangeMeetingType} />
          )}
          <TimeRangeSelector
            options={periodOptions}
            value={period}
            onChange={onChangePeriod}
          />
        </div>
      </div>

      {summary.interviewsCount > 0 && (
        <p className="font-serif text-section text-ink leading-snug max-w-3xl [text-wrap:pretty]">
          Across{' '}
          <Stat>{summary.interviewsCount}</Stat> interviews and{' '}
          <Stat>{summary.rolesCount}</Stat> roles this quarter, your most frequent flag category was{' '}
          <em className="text-accent">“{summary.topCategory}”</em> (
          <Stat>{summary.topCategoryCount}</Stat> instances). On average you flagged{' '}
          <Stat>{summary.avgFlagsPerInterview}</Stat> spans per interview, and dismissed{' '}
          <Stat>{summary.dismissedFlags}</Stat> of <Stat>{summary.totalFlags}</Stat> flags overall.
        </p>
      )}
    </div>
  );
}

function Stat({ children }: { children: ReactNode }) {
  return <span className="font-mono text-base tabular-nums">{children}</span>;
}

// Hiring | Promotion segmented toggle. Same visual language as the
// gutter's Marginalia / Queue switch so the page reads as one design
// system without inventing new chrome.
function ModeToggle({
  value,
  onChange,
}: {
  value: MeetingType;
  onChange: (mt: MeetingType) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Mirror mode"
      className="flex items-center text-sm border border-hairline rounded-input"
    >
      {MEETING_TYPES.map((mt, i) => {
        const active = value === mt;
        return (
          <button
            key={mt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mt)}
            className={`px-3 py-1.5 transition-colors duration-120 ${
              active ? 'bg-ink text-ink-inverse' : 'text-ink-secondary hover:text-ink'
            } ${i > 0 ? 'border-l border-hairline' : ''}`}
          >
            {MEETING_TYPE_LABELS[mt]}
          </button>
        );
      })}
    </div>
  );
}

// ── Tab bodies ─────────────────────────────────────────────────────────────

function OverviewTab({
  data,
  meetingType,
  onOpenAllDecisions,
  onSeeInstances,
}: {
  data: MirrorData;
  meetingType: MeetingType;
  onOpenAllDecisions: () => void;
  onSeeInstances: (linkTo: string | undefined) => void;
}) {
  const visibleNudges = data.nudges.slice(0, 3);
  const showPipeline = meetingType === 'hiring';
  const interviewsNoun = meetingType === 'promotion' ? 'discussions' : 'interviews';
  return (
    <>
      <Section
        title="Decision timeline"
        caption={`${data.decisions.length} ${interviewsNoun} across 90 days · tick height encodes flags raised`}
        anchor="timeline"
      >
        <TimelineChart decisions={data.decisions} />
      </Section>

      <div
        className={`${showPipeline ? 'grid grid-cols-[1.05fr_0.95fr] gap-16' : ''} mb-16`}
      >
        {showPipeline && (
          <Section
            title="Pipeline composition"
            caption="Distribution by represented background, by stage"
            anchor="pipeline"
          >
            <StackedBarChart data={data.pipeline} totalLabel="Total candidates" />
          </Section>
        )}
        <Section
          title="Top language flags"
          caption="Category count vs previous 90 days"
          anchor="language"
        >
          {data.languageFlags.length === 0 ? (
            <EmptyNote>No language flags raised this period.</EmptyNote>
          ) : (
            <LollipopChart data={data.languageFlags} />
          )}
        </Section>
      </div>

      <Section
        title="Three nudges from your own data"
        caption="Reflections drawn from the patterns above"
        anchor="nudges"
      >
        <div className="grid grid-cols-3 gap-4">
          {visibleNudges.map((n) => (
            <NudgeCard
              key={n.id}
              nudge={n}
              onSeeInstances={(nudge) => onSeeInstances(nudge.linkTo)}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Recent decisions"
        caption="Last 8 interviews"
        anchor="recent"
        action={
          // The full decisions list lives under the Decisions tab; the in-page
          // `#all` anchor we shipped initially had no target on this tab. Make
          // the affordance actually take the user there by switching tabs.
          <button
            type="button"
            onClick={onOpenAllDecisions}
            className="text-sm text-ink-secondary hover:text-ink underline decoration-hairline underline-offset-4 hover:decoration-ink whitespace-nowrap"
          >
            View all {data.decisions.length} →
          </button>
        }
      >
        <RecentDecisionsTable decisions={data.recentDecisions} />
      </Section>
    </>
  );
}

function DecisionsTab({ data }: { data: MirrorData }) {
  return (
    <>
      <Section title="Decision velocity" caption="All interviews, last 90 days" anchor="velocity">
        <TimelineChart decisions={data.decisions} width={1100} height={200} />
      </Section>
      <Section
        title="All decisions"
        caption={`${data.decisions.length} interviews · sorted by most recent`}
        anchor="all-decisions"
      >
        <RecentDecisionsTable decisions={data.decisions} />
      </Section>
    </>
  );
}

function LanguageTab({
  data,
  onSeeInstances,
}: {
  data: MirrorData;
  onSeeInstances: (linkTo: string | undefined) => void;
}) {
  const langNudges = data.nudges.filter((n) => /Language|Self-pattern/i.test(n.tag));
  if (data.languageFlags.length === 0) {
    return <EmptyNote>No language flags raised this period.</EmptyNote>;
  }
  return (
    <>
      <Section
        title="Top language flags"
        caption="Across the last 90 days, sorted by frequency. Delta vs previous 90 days."
        anchor="top-language"
      >
        <LollipopChart data={data.languageFlags} labelWidth={300} />
      </Section>

      <Section
        title="What the patterns suggest"
        caption="Reflections from your language data"
        anchor="lang-nudges"
      >
        <div className="grid grid-cols-2 gap-4">
          {langNudges.map((n) => (
            <NudgeCard
              key={n.id}
              nudge={n}
              onSeeInstances={(nudge) => onSeeInstances(nudge.linkTo)}
            />
          ))}
        </div>
      </Section>

      <Section
        title="By category, over time"
        caption="Small multiples — each cell shows the per-week count for one category"
        anchor="lang-small-multiples"
      >
        <LangSmallMultiples categories={data.languageFlags.slice(0, 6)} />
      </Section>
    </>
  );
}

function DemographicsTab({
  data,
  onSeeInstances,
}: {
  data: MirrorData;
  onSeeInstances: (linkTo: string | undefined) => void;
}) {
  const demoNudges = data.nudges.filter((n) => /Pipeline/i.test(n.tag));
  return (
    <>
      <Section
        title="Pipeline composition"
        caption="Where representation changes between stages of the funnel"
        anchor="pipeline-detail"
      >
        <StackedBarChart data={data.pipeline} totalLabel="Total candidates" />
      </Section>

      <Section
        title="Conversion between stages"
        caption="Share of each group advancing"
        anchor="conversion"
      >
        <ConversionGrid pipeline={data.pipeline} />
      </Section>

      <Section title="Reflections" anchor="demo-nudges">
        <div className="grid grid-cols-2 gap-4">
          {demoNudges.map((n) => (
            <NudgeCard
              key={n.id}
              nudge={n}
              onSeeInstances={(nudge) => onSeeInstances(nudge.linkTo)}
            />
          ))}
        </div>
      </Section>
    </>
  );
}

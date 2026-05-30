import { useState } from 'react';
import type { MirrorData } from '../../lib/mirrorData';
import { Section } from './Section';
import { NudgeCard } from './NudgeCard';
import { TimeRangeSelector } from './TimeRangeSelector';
import { RecentDecisionsTable } from './RecentDecisionsTable';
import { ConversionGrid } from './ConversionGrid';
import { LangSmallMultiples } from './LangSmallMultiples';
import { TimelineChart } from './charts/TimelineChart';
import { StackedBarChart } from './charts/StackedBarChart';
import { LollipopChart } from './charts/LollipopChart';

const TABS = ['Overview', 'Decisions', 'Language', 'Demographics'] as const;
type Tab = (typeof TABS)[number];

interface PatternMirrorScreenProps {
  data: MirrorData;
}

export function PatternMirrorScreen({ data }: PatternMirrorScreenProps) {
  const [tab, setTab] = useState<Tab>('Overview');
  const [period, setPeriod] = useState<string>(data.period);

  return (
    <div className="max-w-mirror mx-auto" data-screen-label={`01 Mirror · ${tab}`}>
      <MirrorHeader data={data} period={period} onChangePeriod={setPeriod} />
      <TabBar active={tab} onChange={setTab} />
      <div className="pt-10 pb-32">
        {tab === 'Overview' && <OverviewTab data={data} />}
        {tab === 'Decisions' && <DecisionsTab data={data} />}
        {tab === 'Language' && <LanguageTab data={data} />}
        {tab === 'Demographics' && <DemographicsTab data={data} />}
      </div>
    </div>
  );
}

// ── Header: manager + range + the editorial summary sentence ───────────────

function MirrorHeader({
  data,
  period,
  onChangePeriod,
}: {
  data: MirrorData;
  period: string;
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
        <TimeRangeSelector
          options={periodOptions}
          value={period}
          onChange={onChangePeriod}
        />
      </div>

      <p className="font-serif text-section text-ink leading-snug max-w-3xl [text-wrap:pretty]">
        Across{' '}
        <Stat>{summary.interviewsCount}</Stat> interviews and{' '}
        <Stat>{summary.rolesCount}</Stat> roles this quarter, your most frequent flag category was{' '}
        <em className="text-accent">“{summary.topCategory}”</em> (
        <Stat>{summary.topCategoryCount}</Stat> instances). On average you flagged{' '}
        <Stat>{summary.avgFlagsPerInterview}</Stat> spans per interview, and dismissed{' '}
        <Stat>{summary.dismissedFlags}</Stat> of <Stat>{summary.totalFlags}</Stat> flags overall.
      </p>
    </div>
  );
}

function Stat({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-base tabular-nums">{children}</span>;
}

// ── Tab bar ────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="border-b border-hairline">
      <div className="flex items-end gap-8">
        {TABS.map((t) => {
          const isActive = active === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              className="relative font-serif text-section py-4 transition-colors duration-120"
              style={{
                color: isActive
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-tertiary)',
              }}
            >
              {t}
              <span
                aria-hidden="true"
                className={`absolute left-0 right-0 -bottom-px h-px bg-accent transition-opacity duration-160 ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab bodies ─────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: MirrorData }) {
  const visibleNudges = data.nudges.slice(0, 3);
  return (
    <>
      <Section
        title="Decision timeline"
        caption={`${data.decisions.length} interviews across 90 days · tick height encodes flags raised`}
        anchor="timeline"
      >
        <TimelineChart decisions={data.decisions} />
      </Section>

      <div className="grid grid-cols-[1.05fr_0.95fr] gap-16 mb-16">
        <Section
          title="Pipeline composition"
          caption="Distribution by represented background, by stage"
          anchor="pipeline"
        >
          <StackedBarChart data={data.pipeline} totalLabel="Total candidates" />
        </Section>
        <Section
          title="Top language flags"
          caption="Category count vs previous 90 days"
          anchor="language"
        >
          <LollipopChart data={data.languageFlags} highlightId="age-tone" />
        </Section>
      </div>

      <Section
        title="Three nudges from your own data"
        caption="Reflections drawn from the patterns above"
        anchor="nudges"
      >
        <div className="grid grid-cols-3 gap-4">
          {visibleNudges.map((n) => (
            <NudgeCard key={n.id} nudge={n} />
          ))}
        </div>
      </Section>

      <Section
        title="Recent decisions"
        caption="Last 8 interviews · click a row to open the debrief"
        anchor="recent"
        action={
          <a
            href="#all"
            className="text-sm text-ink-secondary hover:text-ink underline decoration-hairline underline-offset-4 hover:decoration-ink whitespace-nowrap"
          >
            View all {data.decisions.length} →
          </a>
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

function LanguageTab({ data }: { data: MirrorData }) {
  const langNudges = data.nudges.filter((n) => /Language|Self-pattern/i.test(n.tag));
  return (
    <>
      <Section
        title="Top language flags"
        caption="Across the last 90 days, sorted by frequency. Delta vs previous 90 days."
        anchor="top-language"
      >
        <LollipopChart data={data.languageFlags} highlightId="age-tone" labelWidth={300} />
      </Section>

      <Section
        title="What the patterns suggest"
        caption="Reflections from your language data"
        anchor="lang-nudges"
      >
        <div className="grid grid-cols-2 gap-4">
          {langNudges.map((n) => (
            <NudgeCard key={n.id} nudge={n} />
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

function DemographicsTab({ data }: { data: MirrorData }) {
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
            <NudgeCard key={n.id} nudge={n} />
          ))}
        </div>
      </Section>
    </>
  );
}

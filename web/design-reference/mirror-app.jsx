/* ─────────────────────────────────────────────────────────────
   Mirror app composition.
   Four tabs: Overview · Decisions · Language · Demographics
   Editorial pacing within each, not one long scroll.
   ───────────────────────────────────────────────────────────── */

const M = window.mirrorData;

function TabBar({ active, onChange }) {
  const tabs = ["Overview", "Decisions", "Language", "Demographics"];
  return (
    <div className="border-b border-hairline">
      <div className="flex items-end gap-8">
        {tabs.map((t) => {
          const isActive = active === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              className="relative font-serif text-section py-4 transition-colors duration-120"
              style={{ color: isActive ? "var(--color-text-primary)" : "var(--color-text-tertiary)" }}
            >
              {t}
              <span
                aria-hidden="true"
                className={`absolute left-0 right-0 -bottom-px h-px bg-accent transition-opacity duration-160 ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Mirror header: manager + range + summary sentence ─────────
function MirrorHeader({ period, onChangePeriod }) {
  return (
    <div className="pt-10 pb-10">
      <div className="flex items-end justify-between gap-8 mb-8">
        <div>
          <div className="font-serif italic text-base text-ink-tertiary mb-2">Pattern Mirror</div>
          <h1 className="font-serif text-page text-ink leading-tight mb-3">
            {M.manager.name}
          </h1>
          <div className="font-serif italic text-section text-ink-secondary">
            {M.manager.team}
          </div>
        </div>
        <TimeRangeSelector
          options={M.periodOptions}
          value={period}
          onChange={onChangePeriod}
        />
      </div>

      {/* Summary sentence — the editorial moment */}
      <p className="font-serif text-section text-ink leading-snug max-w-3xl [text-wrap:pretty]">
        Across <span className="font-mono text-base tabular-nums">{M.summary.interviewsCount}</span> interviews
        and <span className="font-mono text-base tabular-nums">{M.summary.rolesCount}</span> roles this quarter,
        your most frequent flag category was
        {" "}<em className="text-accent">“{M.summary.topCategory}”</em>
        {" "}(<span className="font-mono text-base tabular-nums">{M.summary.topCategoryCount}</span> instances).
        On average you flagged <span className="font-mono text-base tabular-nums">{M.summary.avgFlagsPerInterview}</span> spans
        per interview, and dismissed <span className="font-mono text-base tabular-nums">{M.summary.dismissedFlags}</span> of
        {" "}<span className="font-mono text-base tabular-nums">{M.summary.totalFlags}</span> flags overall.
      </p>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────
function OverviewTab() {
  const visibleNudges = M.nudges.slice(0, 3);
  return (
    <>
      <Section
        title="Decision timeline"
        caption="47 interviews across 90 days · tick height encodes flags raised"
        anchor="timeline"
      >
        <TimelineChart decisions={M.decisions} />
      </Section>

      <div className="grid grid-cols-[1.05fr_0.95fr] gap-16 mb-16">
        <Section
          title="Pipeline composition"
          caption="Distribution by represented background, by stage"
          anchor="pipeline"
        >
          <StackedBarChart data={M.pipeline} totalLabel="Total candidates" />
        </Section>
        <Section
          title="Top language flags"
          caption="Category count vs previous 90 days"
          anchor="language"
        >
          <LollipopChart data={M.languageFlags} highlightId="age-tone" />
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
          <a href="#" className="text-sm text-ink-secondary hover:text-ink underline decoration-hairline underline-offset-4 hover:decoration-ink whitespace-nowrap">
            View all 47 →
          </a>
        }
      >
        <RecentDecisionsTable decisions={M.recentDecisions} />
      </Section>
    </>
  );
}

// ── Decisions tab ─────────────────────────────────────────────
function DecisionsTab() {
  return (
    <>
      <Section
        title="Decision velocity"
        caption="All interviews, last 90 days"
        anchor="velocity"
      >
        <TimelineChart decisions={M.decisions} width={1100} height={200} />
      </Section>

      <Section
        title="All decisions"
        caption={`${M.decisions.length} interviews · sorted by most recent`}
        anchor="all-decisions"
      >
        <RecentDecisionsTable decisions={M.decisions} />
      </Section>
    </>
  );
}

// ── Language tab ──────────────────────────────────────────────
function LanguageTab() {
  const langNudges = M.nudges.filter((n) => /Language|Self-pattern/.test(n.tag));
  return (
    <>
      <Section
        title="Top language flags"
        caption="Across the last 90 days, sorted by frequency. Delta vs previous 90 days."
        anchor="top-language"
      >
        <LollipopChart data={M.languageFlags} highlightId="age-tone" labelWidth={300} />
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
        <LangSmallMultiples categories={M.languageFlags.slice(0, 6)} />
      </Section>
    </>
  );
}

// Small-multiples sparkline grid for the Language tab
function LangSmallMultiples({ categories }) {
  // Deterministic fake series for each category — keeps the layout honest.
  function series(seed, total) {
    let s = seed;
    const out = [];
    let remaining = total;
    for (let i = 0; i < 13; i++) {
      s = (s * 9301 + 49297) % 233280;
      const r = s / 233280;
      const v = Math.min(remaining, Math.round(r * (total / 7) + 0.3));
      out.push(v);
      remaining -= v;
    }
    return out;
  }
  return (
    <div className="grid grid-cols-3 gap-x-12 gap-y-8">
      {categories.map((c, i) => {
        const data = series(c.count * 991 + i * 17, c.count);
        const max = Math.max(1, ...data);
        return (
          <div key={c.id}>
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-base text-ink truncate">{c.label}</div>
              <div className="font-mono text-sm tabular-nums text-ink-secondary">{c.count}</div>
            </div>
            <svg width="100%" height="40" viewBox="0 0 200 40" preserveAspectRatio="none" className="block">
              {data.map((v, j) => {
                const x = (j / (data.length - 1)) * 200;
                const h = (v / max) * 32;
                return (
                  <line
                    key={j}
                    x1={x} y1={36}
                    x2={x} y2={36 - h}
                    stroke="var(--color-text-primary)"
                    strokeWidth="1"
                  />
                );
              })}
              <line x1="0" y1="37" x2="200" y2="37" stroke="var(--color-border)" strokeWidth="1" />
            </svg>
            <div className="flex justify-between font-mono text-xs text-ink-tertiary mt-2">
              <span>13 wks ago</span>
              <span>this week</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Demographics tab ──────────────────────────────────────────
function DemographicsTab() {
  const demoNudges = M.nudges.filter((n) => /Pipeline/.test(n.tag));
  return (
    <>
      <Section
        title="Pipeline composition"
        caption="Where representation changes between stages of the funnel"
        anchor="pipeline-detail"
      >
        <StackedBarChart data={M.pipeline} totalLabel="Total candidates" />
      </Section>

      <Section
        title="Conversion between stages"
        caption="Share of each group advancing"
        anchor="conversion"
      >
        <ConversionGrid pipeline={M.pipeline} />
      </Section>

      <Section
        title="Reflections"
        caption=""
        anchor="demo-nudges"
      >
        <div className="grid grid-cols-2 gap-4">
          {demoNudges.map((n) => (
            <NudgeCard key={n.id} nudge={n} />
          ))}
        </div>
      </Section>
    </>
  );
}

function ConversionGrid({ pipeline }) {
  // Compute rep/maj conversion stage→stage
  const rows = [];
  for (let i = 1; i < pipeline.length; i++) {
    const prev = pipeline[i - 1];
    const curr = pipeline[i];
    rows.push({
      label: `${prev.stage} → ${curr.stage}`,
      repPct: (curr.represented / prev.represented) * 100,
      majPct: (curr.majority / prev.majority) * 100,
    });
  }
  return (
    <div className="space-y-5">
      {rows.map((row, i) => {
        const gap = row.majPct - row.repPct;
        return (
          <div key={i} className="grid grid-cols-[260px_1fr] gap-8 items-center">
            <div className="text-base text-ink">{row.label}</div>
            <div className="grid grid-cols-[1fr_1fr_120px] gap-4 items-center">
              <div>
                <div className="font-mono text-sm text-ink-tertiary mb-1">Represented</div>
                <div className="flex items-baseline gap-3">
                  <div className="font-serif text-section text-ink tabular-nums">{row.repPct.toFixed(0)}%</div>
                  <div className="h-1 flex-1" style={{ background: "var(--color-border)" }}>
                    <div className="h-full" style={{ width: `${row.repPct}%`, background: "var(--color-text-primary)" }} />
                  </div>
                </div>
              </div>
              <div>
                <div className="font-mono text-sm text-ink-tertiary mb-1">Majority</div>
                <div className="flex items-baseline gap-3">
                  <div className="font-serif text-section text-ink tabular-nums">{row.majPct.toFixed(0)}%</div>
                  <div className="h-1 flex-1" style={{ background: "var(--color-border)" }}>
                    <div className="h-full" style={{ width: `${row.majPct}%`, background: "var(--color-text-primary)" }} />
                  </div>
                </div>
              </div>
              <div className="text-sm text-right">
                <span className="font-serif italic text-ink-tertiary">gap </span>
                <span className={`font-mono tabular-nums ${gap > 5 ? "text-accent" : "text-ink"}`}>
                  {gap > 0 ? "+" : ""}{gap.toFixed(0)}pp
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────
function MirrorApp() {
  const [tab, setTab] = React.useState("Overview");
  const [period, setPeriod] = React.useState(M.period);

  return (
    <div className="min-h-screen">
      <MirrorTopBar active="mirror" />

      <main className="max-w-mirror mx-auto px-8" data-screen-label="01 Mirror · Overview">
        <MirrorHeader period={period} onChangePeriod={setPeriod} />
        <TabBar active={tab} onChange={setTab} />

        <div className="pt-10 pb-32">
          {tab === "Overview"     && <OverviewTab />}
          {tab === "Decisions"    && <DecisionsTab />}
          {tab === "Language"     && <LanguageTab />}
          {tab === "Demographics" && <DemographicsTab />}
        </div>
      </main>
    </div>
  );
}

const _root = ReactDOM.createRoot(document.getElementById("root"));
_root.render(<MirrorApp />);

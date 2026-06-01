/* ─────────────────────────────────────────────────────────────
   Mirror primitives — NudgeCard, RecentDecisionsTable, Section,
   TimeRangeSelector.
   ───────────────────────────────────────────────────────────── */

// ── Section: editorial section header with caption ─────────────
function Section({ title, caption, anchor, children, action }) {
  return (
    <section id={anchor} className="mb-16">
      <div className="flex items-end justify-between gap-8 mb-6 pb-3 border-b border-hairline">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-section text-ink leading-tight">{title}</h2>
          {caption && <p className="font-serif italic text-sm text-ink-tertiary mt-1">{caption}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// ── NudgeCard: serif pull-quote, no border, paper-darker tile ─
function NudgeCard({ nudge, onSeeInstances }) {
  return (
    <article className="bg-surface-sunk p-8 flex flex-col h-full">
      <div className="font-serif italic text-sm text-ink-tertiary mb-5">{nudge.tag}</div>
      <p className="font-serif text-section text-ink leading-snug mb-6 [text-wrap:pretty] flex-1">
        {nudge.sentence}
      </p>
      {nudge.linkTo && (
        <button
          type="button"
          onClick={() => onSeeInstances && onSeeInstances(nudge)}
          className="self-start text-sm text-ink font-medium underline decoration-hairline underline-offset-4 hover:decoration-ink transition-colors duration-120"
        >
          See in {nudge.linkTo} ›
        </button>
      )}
    </article>
  );
}

// ── TimeRangeSelector: simple labeled toggle ───────────────────
function TimeRangeSelector({ options, value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 border border-hairline rounded-input">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`text-sm px-3 py-1.5 transition-colors duration-120 ${
            value === opt
              ? "bg-ink text-ink-inverse"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          {opt.replace("Last ", "")}
        </button>
      ))}
    </div>
  );
}

// ── RecentDecisionsTable: quiet, dense, scannable ─────────────
function RecentDecisionsTable({ decisions, showRoleCol = true }) {
  return (
    <div className="border-t border-hairline">
      <table className="w-full text-base">
        <thead>
          <tr className="font-serif italic text-sm text-ink-tertiary text-left">
            <th className="py-3 pr-4 font-normal border-b border-hairline w-[12%]">Date</th>
            <th className="py-3 pr-4 font-normal border-b border-hairline w-[20%]">Candidate</th>
            {showRoleCol && <th className="py-3 pr-4 font-normal border-b border-hairline">Role</th>}
            <th className="py-3 pr-4 font-normal border-b border-hairline text-right w-[8%]">Flags</th>
            <th className="py-3 pr-4 font-normal border-b border-hairline w-[14%]">Outcome</th>
            <th className="py-3 font-normal border-b border-hairline text-right w-[10%]"></th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((d) => (
            <tr key={d.id} className="text-ink hover:bg-surface-sunk transition-colors duration-120 cursor-pointer">
              <td className="py-3 pr-4 border-b border-hairline font-mono text-sm text-ink-secondary tabular-nums">{d.date}</td>
              <td className="py-3 pr-4 border-b border-hairline whitespace-nowrap">
                <span className="font-mono text-sm text-ink mr-1">{d.candidate}</span>
                <span className="text-ink-tertiary text-sm">· {d.surname}</span>
              </td>
              {showRoleCol && <td className="py-3 pr-4 border-b border-hairline text-ink-secondary">{d.role}</td>}
              <td className="py-3 pr-4 border-b border-hairline font-mono text-base tabular-nums text-right">{d.flags}</td>
              <td className="py-3 pr-4 border-b border-hairline">
                <OutcomeBadge outcome={d.outcome} />
              </td>
              <td className="py-3 border-b border-hairline text-right text-sm text-ink-tertiary">
                <span className="opacity-0 group-hover:opacity-100">Open ›</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Outcome treatments — typography + a single hairline rule, no badge pill
function OutcomeBadge({ outcome }) {
  const styles = {
    Hired:     "text-accent font-medium",
    Advanced:  "text-ink font-medium",
    Declined:  "text-ink-tertiary",
    Pending:   "text-ink-secondary italic",
  };
  return <span className={`text-base ${styles[outcome] || "text-ink"}`}>{outcome}</span>;
}

// ── Shared TopBar with anchor-tag navigation ──────────────────
function MirrorTopBar({ active }) {
  const { InitialsAvatar } = window;
  const tabClass = (isActive) =>
    `relative text-sm font-medium px-1 py-3 transition-colors duration-120 ${
      isActive ? "text-ink" : "text-ink-tertiary hover:text-ink-secondary"
    }`;
  const D = window.mirrorData || window.fairhireData || {};
  const initials = (D.manager || D.author || {}).initials || "DW";
  return (
    <header className="sticky top-0 z-30 bg-bg border-b border-hairline">
      <div className="max-w-mirror mx-auto px-8 h-[52px] flex items-center justify-between">
        <div className="flex items-center gap-10">
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="font-serif text-section text-ink tracking-wide">FairHire</span>
            <span className="font-serif italic text-sm text-ink-tertiary">
              Group Strategy &amp; Sustainability
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <a href="Flag Review Screen.html" className={tabClass(active === "companion")}>
              Companion
              <span aria-hidden="true" className={`absolute left-0 right-0 -bottom-px h-px bg-accent transition-opacity duration-160 ${active === "companion" ? "opacity-100" : "opacity-0"}`} />
            </a>
            <a href="Pattern Mirror.html" className={tabClass(active === "mirror")}>
              Mirror
              <span aria-hidden="true" className={`absolute left-0 right-0 -bottom-px h-px bg-accent transition-opacity duration-160 ${active === "mirror" ? "opacity-100" : "opacity-0"}`} />
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-sm text-ink-tertiary hover:text-ink-secondary transition-colors duration-120 flex items-center gap-2 whitespace-nowrap"
          >
            <span>Search candidates</span>
            <span className="font-mono text-xs border border-hairline rounded-input px-1.5 py-0.5">⌘K</span>
          </button>
          <InitialsAvatar initials={initials} />
        </div>
      </div>
    </header>
  );
}

Object.assign(window, {
  Section,
  NudgeCard,
  TimeRangeSelector,
  RecentDecisionsTable,
  OutcomeBadge,
  MirrorTopBar,
});

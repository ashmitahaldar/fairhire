import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useManager } from '../lib/ManagerContext';
import { useMeetings, type AnalysisStatus, type MeetingListItem } from '../lib/meetingsApi';

// Decision Companion home — lists every meeting the signed-in manager has
// uploaded, newest first. Each row links to the per-meeting flag-review.

export default function Dashboard() {
  const manager = useManager();
  const query = useMeetings();

  const firstName = manager.name.split(' ')[0] ?? manager.name;
  const meetings = query.data ?? [];
  const totalFlags = meetings.reduce((s, m) => s + m._count.flags, 0);

  return (
    <div className="max-w-companion mx-auto">
      <Header firstName={firstName} />

      {query.isLoading && (
        <p className="font-mono text-sm text-ink-tertiary">Loading meetings…</p>
      )}

      {query.isError && (
        <p className="font-mono text-sm text-ink-secondary">
          Couldn’t load your meetings.{' '}
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="text-ink font-medium hover:text-accent transition-colors duration-120"
          >
            Retry
          </button>
        </p>
      )}

      {query.data && meetings.length === 0 && <EmptyState />}

      {query.data && meetings.length > 0 && (
        <>
          <SummarySentence count={meetings.length} flags={totalFlags} />
          <MeetingsTable meetings={meetings} />
        </>
      )}
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────

function Header({ firstName }: { firstName: string }) {
  return (
    <div className="pt-10 pb-10">
      <div className="flex items-end justify-between gap-8 mb-8">
        <div>
          <div className="font-serif italic text-base text-ink-tertiary mb-2">
            Decision companion
          </div>
          <h1 className="font-serif text-page text-ink leading-tight mb-3">
            Welcome, {firstName}
          </h1>
          <div className="font-serif italic text-section text-ink-secondary">
            Your panel debriefs, analysed for bias.
          </div>
        </div>
        <Link
          to="/meetings/upload"
          className="text-sm font-medium text-ink-inverse bg-ink px-4 py-2 rounded-input hover:bg-accent transition-colors duration-120 whitespace-nowrap"
        >
          Upload transcript
        </Link>
      </div>
    </div>
  );
}

// ── Summary sentence above the table ─────────────────────────────────────

function SummarySentence({ count, flags }: { count: number; flags: number }) {
  return (
    <p className="font-serif text-section text-ink leading-snug max-w-3xl mb-8 [text-wrap:pretty]">
      You have <Stat>{count}</Stat> {count === 1 ? 'analysed debrief' : 'analysed debriefs'} on
      file, with <Stat>{flags}</Stat> flag{flags === 1 ? '' : 's'} raised in total.
    </p>
  );
}

function Stat({ children }: { children: ReactNode }) {
  return <span className="font-mono text-base tabular-nums">{children}</span>;
}

// ── Empty state ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="border-t border-hairline pt-12">
      <p className="font-serif italic text-section text-ink-secondary mb-6 [text-wrap:pretty]">
        Nothing on file yet. Upload your first panel debrief to see flags surface here.
      </p>
      <Link
        to="/meetings/upload"
        className="text-sm font-medium text-ink underline decoration-hairline underline-offset-4 hover:decoration-ink transition-colors duration-120"
      >
        Upload transcript →
      </Link>
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────

function MeetingsTable({ meetings }: { meetings: MeetingListItem[] }) {
  const navigate = useNavigate();
  return (
    <div className="border-t border-hairline">
      <table className="w-full text-base">
        <thead>
          <tr className="font-serif italic text-sm text-ink-tertiary text-left">
            <th className="py-3 pr-4 font-normal border-b border-hairline w-[12%]">Date</th>
            <th className="py-3 pr-4 font-normal border-b border-hairline w-[22%]">Candidate</th>
            <th className="py-3 pr-4 font-normal border-b border-hairline">Title</th>
            <th className="py-3 pr-4 font-normal border-b border-hairline text-right w-[8%]">
              Flags
            </th>
            <th className="py-3 pr-4 font-normal border-b border-hairline w-[14%]">Status</th>
            <th className="py-3 font-normal border-b border-hairline text-right w-[8%]" />
          </tr>
        </thead>
        <tbody>
          {meetings.map((m) => {
            const candidate = m.candidates[0]?.candidate;
            const status = m.analysisRuns[0]?.status ?? 'pending';
            const open = () => navigate(`/meetings/${m.id}`);
            return (
              <tr
                key={m.id}
                role="link"
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => {
                  // Enter/Space activate the row, matching native link semantics
                  // declared by role="link" above. preventDefault on Space keeps
                  // the page from scrolling before navigation kicks in.
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open();
                  }
                }}
                className="group text-ink hover:bg-surface-sunk focus:bg-surface-sunk focus:outline-none transition-colors duration-120 cursor-pointer"
              >
                <td className="py-3 pr-4 border-b border-hairline font-mono text-sm text-ink-secondary tabular-nums">
                  {formatDate(m.date)}
                </td>
                <td className="py-3 pr-4 border-b border-hairline whitespace-nowrap">
                  {candidate ? (
                    <>
                      <span className="font-mono text-sm text-ink mr-1">{candidate.name}</span>
                      <span className="text-ink-tertiary text-sm">
                        · {candidate.roleAppliedFor}
                      </span>
                      {m.candidates.length > 1 && (
                        <span className="text-ink-tertiary text-sm">
                          {' '}+{m.candidates.length - 1}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-ink-tertiary text-sm italic">no candidate</span>
                  )}
                </td>
                <td className="py-3 pr-4 border-b border-hairline text-ink-secondary truncate">
                  {m.title}
                </td>
                <td className="py-3 pr-4 border-b border-hairline font-mono text-base tabular-nums text-right">
                  {m._count.flags}
                </td>
                <td className="py-3 pr-4 border-b border-hairline">
                  <StatusLabel status={status} />
                </td>
                <td className="py-3 border-b border-hairline text-right text-sm text-ink-tertiary">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-120">
                    Open ›
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Typography-only status: completed = primary ink, pending/running = italic
// secondary, failed = accent. Mirrors the Mirror's OutcomeBadge treatment.
const STATUS_CLASS: Record<AnalysisStatus, string> = {
  completed: 'text-ink font-medium',
  pending: 'text-ink-secondary italic',
  running: 'text-ink-secondary italic',
  failed: 'text-accent',
};

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  completed: 'Analysed',
  pending: 'Pending',
  running: 'Analysing',
  failed: 'Failed',
};

function StatusLabel({ status }: { status: AnalysisStatus }) {
  return <span className={`text-base ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

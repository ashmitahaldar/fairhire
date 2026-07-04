import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  AGE_BAND_LABELS,
  FLAG_TYPE_LABELS,
  GENDER_LABELS,
  MEETING_TYPE_LABELS,
  NATIONALITY_STATUS_LABELS,
  RACE_LABELS,
} from '@fairhire/shared';
import {
  useCandidateFlags,
  type CandidateFlag,
  type CandidateListItem,
} from '../../lib/candidatesApi';
import { severityFor } from '../../lib/severity';
import { SeverityBadge } from '../flag-review/SeverityBadge';
import { InlineError } from '../shared/primitives';

// Read-only candidate detail dialog, opened by clicking a candidate name on the
// Candidates page. Shows identity + demographics, the org-wide flag count with
// its privacy framing, and the caller's OWN flags on this candidate in full
// (grouped by debrief). The org-wide count crosses the manager boundary only as
// an aggregate; the flag *content* below is strictly the caller's own — see
// GET /candidates/:id/flags.

interface CandidateDetailModalProps {
  candidate: CandidateListItem | null; // null → closed
  onClose: () => void;
}

function demographicsLine(d: CandidateListItem['demographics']): string | null {
  if (!d) return null;
  const parts: string[] = [];
  if (d.race) parts.push(RACE_LABELS[d.race]);
  if (d.gender) parts.push(GENDER_LABELS[d.gender]);
  if (d.ageBand) parts.push(AGE_BAND_LABELS[d.ageBand]);
  if (d.nationalityStatus) parts.push(NATIONALITY_STATUS_LABELS[d.nationalityStatus]);
  return parts.length ? parts.join(' · ') : null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Group flags by their meeting, preserving the server's order (meeting date
// desc, then confidence desc). Each group heads a debrief with a link to it.
interface FlagGroup {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  meetingType: CandidateFlag['meetingType'];
  flags: CandidateFlag[];
}

function groupByMeeting(flags: CandidateFlag[]): FlagGroup[] {
  const groups: FlagGroup[] = [];
  const byId = new Map<string, FlagGroup>();
  for (const f of flags) {
    let g = byId.get(f.meetingId);
    if (!g) {
      g = {
        meetingId: f.meetingId,
        meetingTitle: f.meetingTitle,
        meetingDate: f.meetingDate,
        meetingType: f.meetingType,
        flags: [],
      };
      byId.set(f.meetingId, g);
      groups.push(g);
    }
    g.flags.push(f);
  }
  return groups;
}

export function CandidateDetailModal({ candidate, onClose }: CandidateDetailModalProps) {
  const titleId = 'candidate-detail-title';
  const panelRef = useRef<HTMLDivElement>(null);
  const flagsQuery = useCandidateFlags(candidate?.id ?? null);

  // Esc closes (shares the close path with the backdrop click).
  useEffect(() => {
    if (!candidate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [candidate, onClose]);

  // Move focus into the panel when it opens so keyboard/screen-reader users
  // start inside the dialog rather than on the page underneath.
  useEffect(() => {
    if (candidate) requestAnimationFrame(() => panelRef.current?.focus());
  }, [candidate]);

  if (!candidate) return null;

  const demo = demographicsLine(candidate.demographics);
  const { total, own } = candidate.flagCount;

  // Rendered through a portal to <body> so the fixed overlay always covers the
  // viewport, regardless of any ancestor that establishes a containing block.
  // The scrim colour is an inline style, not `bg-ink/40`: the design tokens are
  // bare `var(--color-*)` values, and Tailwind v3 can't inject an alpha into a
  // bare var() — hence the codebase's baked-alpha tokens (e.g. accent-soft).
  // The panel scrolls internally (max-h) so a long flag list never overflows.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
      style={{ backgroundColor: 'oklch(0.20 0.008 70 / 0.45)' }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-surface rounded-card shadow-float border border-hairline outline-none"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-hairline">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="font-serif italic text-base text-ink-tertiary mb-2">Candidate</div>
              <h2 id={titleId} className="font-serif text-section text-ink leading-tight">
                {candidate.name}
              </h2>
              <div className="text-sm text-ink-secondary mt-1">{candidate.roleAppliedFor}</div>
              {demo && <div className="text-sm text-ink-tertiary mt-1">{demo}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-ink-secondary hover:text-ink transition-colors duration-120 shrink-0"
            >
              Close
            </button>
          </div>

          {/* Org-wide count + privacy framing */}
          <p className="text-sm text-ink-secondary mt-5 [text-wrap:pretty]">
            {total === 0 ? (
              <>No flags have been raised for this candidate across the organisation.</>
            ) : (
              <>
                <span className="font-mono tabular-nums text-ink">{total}</span>{' '}
                flag{total === 1 ? '' : 's'} raised for this candidate across the organisation —
                including other managers’ debriefs.{' '}
                <span className="font-mono tabular-nums text-ink">{own}</span> from your own
                interviews. Other managers’ flag content and identity stay private.
              </>
            )}
          </p>
        </div>

        {/* Own flags */}
        <div className="px-8 py-6">
          <div className="fh-label mb-4">Flags from your interviews</div>
          <FlagsBody query={flagsQuery} own={own} total={total} onNavigate={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FlagsBody({
  query,
  own,
  total,
  onNavigate,
}: {
  query: ReturnType<typeof useCandidateFlags>;
  own: number;
  total: number;
  onNavigate: () => void;
}) {
  if (query.isLoading) {
    return <p className="font-mono text-sm text-ink-tertiary">Loading your flags…</p>;
  }
  if (query.isError) {
    return (
      <InlineError
        error={query.error}
        onRetry={() => void query.refetch()}
        fallback="Couldn’t load flags for this candidate."
      />
    );
  }

  const flags = query.data ?? [];

  if (flags.length === 0) {
    // Distinguish "nobody flagged them" from "others did, but that's private".
    if (total > own) {
      return (
        <p className="font-serif italic text-base text-ink-tertiary [text-wrap:pretty]">
          Other managers have flagged this candidate, but flag content stays private. You haven’t
          raised any flags on them yourself.
        </p>
      );
    }
    return (
      <p className="font-serif italic text-base text-ink-tertiary">
        No flags raised for this candidate.
      </p>
    );
  }

  const groups = groupByMeeting(flags);

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.meetingId}>
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <div className="text-sm text-ink-secondary">
              <span className="text-ink">{g.meetingTitle}</span>
              <span className="text-ink-tertiary">
                {' '}
                · {formatDate(g.meetingDate)} · {MEETING_TYPE_LABELS[g.meetingType]}
              </span>
            </div>
            <Link
              to={`/meetings/${g.meetingId}`}
              onClick={onNavigate}
              className="text-sm font-medium text-ink whitespace-nowrap underline decoration-hairline underline-offset-4 hover:decoration-ink transition-colors duration-120"
            >
              Open debrief →
            </Link>
          </div>

          <ul className="space-y-4">
            {g.flags.map((f) => {
              const sev = severityFor(f.confidenceScore);
              return (
                <li
                  key={f.id}
                  className={`border-l-2 border-hairline pl-4 ${f.dismissed ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <SeverityBadge tier={sev.key} label={sev.label} score={f.confidenceScore} />
                    <span className="text-sm font-medium text-ink">
                      {FLAG_TYPE_LABELS[f.flagType]}
                    </span>
                    {f.dismissed && (
                      <span className="font-mono text-xs uppercase tracking-meta text-ink-tertiary">
                        dismissed
                      </span>
                    )}
                  </div>
                  <p className="font-serif italic text-ink-secondary [text-wrap:pretty] mb-1">
                    “{f.excerpt}”
                  </p>
                  <p className="text-sm text-ink-tertiary [text-wrap:pretty]">{f.reasoning}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

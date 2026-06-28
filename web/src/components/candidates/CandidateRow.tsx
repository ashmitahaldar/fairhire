import type { CandidateListItem } from '../../lib/candidatesApi';
import { decisionOutcomeLabel, type Gender, type Race } from '@fairhire/shared';
import { InfoPopover } from '../shared/primitives';

// One row of the Candidates table. Edit/delete buttons are disabled when
// canModify is false (the caller hasn't interviewed this candidate, per
// the hybrid access rule). The disabled affordance has a tooltip so the
// user understands why — see Section 5 of the Week 4 plan.

interface CandidateRowProps {
  candidate: CandidateListItem;
  onEdit: (candidate: CandidateListItem) => void;
  onDelete: (candidate: CandidateListItem) => void;
}

const RACE_SHORT: Record<Race, string> = {
  chinese: 'Chinese',
  malay: 'Malay',
  indian: 'Indian',
  other: 'Other',
};
const GENDER_SHORT: Record<Gender, string> = {
  male: 'M',
  female: 'F',
  non_binary: 'NB',
  prefer_not_to_say: '—',
};

function demographicsChip(d: CandidateListItem['demographics']) {
  if (!d) return null;
  const parts: string[] = [];
  if (d.race) parts.push(RACE_SHORT[d.race]);
  if (d.gender) parts.push(GENDER_SHORT[d.gender]);
  return parts.length === 0 ? null : parts.join(' · ');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Org-wide flag count. `total` includes flags raised in other managers'
// debriefs, so a manager sees a candidate's full flag history without seeing
// any other manager's flag content or identity. When others have contributed
// (own < total) we surface "· N by you" so the split is legible; a focusable
// InfoPopover carries the full breakdown and the privacy framing.
function FlagCountCell({ flagCount }: { flagCount: CandidateListItem['flagCount'] }) {
  const { total, own } = flagCount;
  if (total === 0) {
    return <span className="text-ink-tertiary italic font-serif">—</span>;
  }
  const aria = `${total} flag${total === 1 ? '' : 's'} across the organisation, ${own} by you. What this count means.`;
  return (
    <InfoPopover
      label={aria}
      align="right"
      triggerClassName="underline decoration-dotted decoration-hairline underline-offset-2 hover:decoration-ink transition-colors duration-120 tabular-nums"
      content={
        <>
          <span className="font-serif italic text-ink">
            {total} flag{total === 1 ? '' : 's'}
          </span>{' '}
          raised for this candidate across the organisation — including other managers’ debriefs.{' '}
          {own} of those {own === 1 ? 'is' : 'are'} from your own interviews. No other manager’s flag
          content or identity is shown.
        </>
      }
    >
      {total}
      {own < total && <span className="text-ink-tertiary"> · {own} by you</span>}
    </InfoPopover>
  );
}

// Display labels come from the canonical shared map so the Candidates page,
// the Flag Review decision panel, and the Pattern Mirror summary read the
// same vocabulary (Hired / Declined / Pending).

export function CandidateRow({ candidate, onEdit, onDelete }: CandidateRowProps) {
  const chip = demographicsChip(candidate.demographics);
  const lock = candidate.canModify
    ? undefined
    : "You haven't interviewed this candidate yet.";

  return (
    <tr className="text-ink hover:bg-surface-sunk transition-colors duration-120">
      <td className="py-3 pr-4 border-b border-hairline">
        <span className="font-mono text-sm text-ink">{candidate.name}</span>
      </td>
      <td className="py-3 pr-4 border-b border-hairline text-ink-secondary text-sm">
        {candidate.roleAppliedFor}
      </td>
      <td className="py-3 pr-4 border-b border-hairline text-sm text-ink-secondary">
        {chip ?? <span className="text-ink-tertiary italic">—</span>}
      </td>
      <td className="py-3 pr-4 border-b border-hairline font-mono text-sm tabular-nums text-right">
        {candidate.meetingCount}
      </td>
      <td className="py-3 pr-4 border-b border-hairline font-mono text-sm tabular-nums text-right">
        <FlagCountCell flagCount={candidate.flagCount} />
      </td>
      <td className="py-3 pr-4 border-b border-hairline text-sm">
        {candidate.lastDecisionOutcome ? (
          <span className="text-ink">
            {decisionOutcomeLabel(
              candidate.lastDecisionMeetingType ?? 'hiring',
              candidate.lastDecisionOutcome,
            )}
          </span>
        ) : (
          <span className="text-ink-tertiary italic">—</span>
        )}
      </td>
      <td className="py-3 pr-4 border-b border-hairline font-mono text-sm text-ink-secondary tabular-nums">
        {formatDate(candidate.createdAt)}
      </td>
      <td className="py-3 border-b border-hairline text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => onEdit(candidate)}
          disabled={!candidate.canModify}
          title={lock}
          className="text-sm font-medium text-ink-secondary hover:text-ink transition-colors duration-120 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-ink-secondary mr-4"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(candidate)}
          disabled={!candidate.canModify}
          title={lock}
          className="text-sm font-medium text-accent hover:underline transition-colors duration-120 disabled:opacity-30 disabled:cursor-not-allowed disabled:no-underline"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

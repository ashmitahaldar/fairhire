import type { CandidateListItem } from '../../lib/candidatesApi';
import type { Gender, Race } from '@fairhire/shared';

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

const OUTCOME_LABEL: Record<NonNullable<CandidateListItem['lastDecisionOutcome']>, string> = {
  hired: 'Hired',
  rejected: 'Rejected',
  in_progress: 'In progress',
};

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
      <td className="py-3 pr-4 border-b border-hairline text-sm">
        {candidate.lastDecisionOutcome ? (
          <span className="text-ink">{OUTCOME_LABEL[candidate.lastDecisionOutcome]}</span>
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

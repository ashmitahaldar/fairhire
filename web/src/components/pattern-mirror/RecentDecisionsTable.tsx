import type { DecisionOutcome, MirrorDecision } from '../../lib/mirrorData';

interface RecentDecisionsTableProps {
  decisions: MirrorDecision[];
  showRoleCol?: boolean;
}

// Quiet, dense, scannable decisions table — no zebra rows, single hairline
// rule per row. Read-only on the Mirror screen: the mock data carries no
// real meeting IDs to navigate to, so the row-as-link affordance from the
// original mockup is intentionally omitted here. When Pattern Mirror is
// wired to real data and each row corresponds to a real meeting, restore
// the row click handler + the hover-revealed "Open ›" cell from the
// Dashboard's MeetingsTable for parity.
export function RecentDecisionsTable({ decisions, showRoleCol = true }: RecentDecisionsTableProps) {
  return (
    <div className="border-t border-hairline">
      <table className="w-full text-base">
        <thead>
          <tr className="font-serif italic text-sm text-ink-tertiary text-left">
            <th className="py-3 pr-4 font-normal border-b border-hairline w-[12%]">Date</th>
            <th className="py-3 pr-4 font-normal border-b border-hairline w-[20%]">Candidate</th>
            {showRoleCol && (
              <th className="py-3 pr-4 font-normal border-b border-hairline">Role</th>
            )}
            <th className="py-3 pr-4 font-normal border-b border-hairline text-right w-[8%]">
              Flags
            </th>
            <th className="py-3 font-normal border-b border-hairline w-[14%]">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((d) => (
            <tr key={d.id} className="text-ink">
              <td className="py-3 pr-4 border-b border-hairline font-mono text-sm text-ink-secondary tabular-nums">
                {d.date}
              </td>
              <td className="py-3 pr-4 border-b border-hairline whitespace-nowrap">
                <span className="font-mono text-sm text-ink mr-1">{d.candidate}</span>
                <span className="text-ink-tertiary text-sm">· {d.surname}</span>
              </td>
              {showRoleCol && (
                <td className="py-3 pr-4 border-b border-hairline text-ink-secondary">{d.role}</td>
              )}
              <td className="py-3 pr-4 border-b border-hairline font-mono text-base tabular-nums text-right">
                {d.flags}
              </td>
              <td className="py-3 border-b border-hairline">
                <OutcomeBadge outcome={d.outcome} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Typography-only outcome — no pill, no chip. Hired gets the accent treatment;
// pending sits in italic secondary; declined drops to tertiary.
const OUTCOME_CLASS: Record<DecisionOutcome, string> = {
  Hired: 'text-accent font-medium',
  Advanced: 'text-ink font-medium',
  Declined: 'text-ink-tertiary',
  Pending: 'text-ink-secondary italic',
};

function OutcomeBadge({ outcome }: { outcome: DecisionOutcome }) {
  return <span className={`text-base ${OUTCOME_CLASS[outcome]}`}>{outcome}</span>;
}

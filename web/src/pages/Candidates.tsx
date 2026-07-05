import { useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import {
  useCandidatesList,
  useSoftDeleteCandidate,
  type CandidateListItem,
} from '../lib/candidatesApi';
import { CandidateRow } from '../components/candidates/CandidateRow';
import { CandidateModal } from '../components/candidates/CandidateModal';
import { CandidateDetailModal } from '../components/candidates/CandidateDetailModal';
import { InlineError, TableSkeleton } from '../components/shared/primitives';
import { useManager } from '../lib/ManagerContext';

// Candidates CRUD page. Lists every candidate in the org, sortable by
// header click and filterable via search box. Add/Edit open the same
// modal in different modes; Delete is a soft-delete (sets deletedAt on
// the server) gated by the canModify per-row flag from the api. See
// Section 5 of the Week 4 plan.

type SortKey = 'name' | 'roleAppliedFor' | 'meetingCount' | 'createdAt';
type SortDir = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  dir: SortDir;
}

export default function Candidates() {
  const query = useCandidatesList();
  const softDelete = useSoftDeleteCandidate();
  // HR admins conduct no interviews, so `canModify` is false on every row and the
  // Edit/Delete controls would be uniformly greyed — which reads as broken rather
  // than intentional. For HR we drop the row actions entirely (see CandidateRow).
  const isHr = useManager().role === 'hr_admin';

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<CandidateListItem | null>(null);
  const [detailCandidate, setDetailCandidate] = useState<CandidateListItem | null>(null);

  const candidates = query.data ?? [];

  const filteredSorted = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? candidates.filter(
          (c) =>
            c.name.toLowerCase().includes(needle) ||
            c.roleAppliedFor.toLowerCase().includes(needle),
        )
      : candidates;
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      // null-safe — primitives only on this row type
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [candidates, search, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );

  const openCreate = () => {
    setEditingCandidate(null);
    setModalOpen(true);
  };
  const openEdit = (c: CandidateListItem) => {
    setEditingCandidate(c);
    setModalOpen(true);
  };
  const openDetail = (c: CandidateListItem) => setDetailCandidate(c);
  const onDelete = (c: CandidateListItem) => {
    // window.confirm is functional and accessible for POC. A styled
    // AlertDialog can replace it later without changing the call site.
    const ok = window.confirm(
      `Delete ${c.name}? This hides the candidate from lists but keeps the analysis history intact.`,
    );
    if (!ok) return;
    softDelete.mutate(c.id);
  };

  return (
    <div className="max-w-companion mx-auto">
      <Header onAdd={openCreate} />

      {query.isLoading && <TableSkeleton />}

      {query.isError && (
        <InlineError
          error={query.error}
          onRetry={() => void query.refetch()}
          fallback="Couldn’t load candidates."
        />
      )}

      {softDelete.isError && (
        <p className="font-mono text-sm text-accent mb-4" role="alert">
          Couldn’t delete that candidate. Try again, or refresh the page if
          the problem persists.{' '}
          <button
            type="button"
            onClick={() => softDelete.reset()}
            className="underline decoration-hairline underline-offset-4 hover:decoration-ink"
          >
            Dismiss
          </button>
        </p>
      )}

      {query.data && candidates.length === 0 && <EmptyState onAdd={openCreate} />}

      {query.data && candidates.length > 0 && (
        <>
          <Controls search={search} onSearch={setSearch} total={filteredSorted.length} />
          <CandidatesTable
            candidates={filteredSorted}
            sort={sort}
            onToggleSort={toggleSort}
            onOpen={openDetail}
            onEdit={openEdit}
            onDelete={onDelete}
            isHr={isHr}
          />
        </>
      )}

      <CandidateModal
        open={modalOpen}
        candidate={editingCandidate}
        onClose={() => setModalOpen(false)}
      />

      <CandidateDetailModal
        candidate={detailCandidate}
        onClose={() => setDetailCandidate(null)}
      />
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────

function Header({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="pt-8 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-6">
        <div>
          <div className="font-serif italic text-base text-ink-tertiary mb-2">
            Candidates
          </div>
          <h1 className="font-serif text-page text-ink leading-tight mb-3">
            Your org’s candidate roster
          </h1>
          <div className="font-serif italic text-section text-ink-secondary">
            Add, edit, and review demographics. Click a name to see the flags raised for that
            candidate.
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-inverse bg-ink px-4 py-2 rounded-input hover:bg-accent transition-colors duration-120 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add candidate
        </button>
      </div>
    </div>
  );
}

// ── Controls (search + result count) ─────────────────────────────────────

function Controls({
  search,
  onSearch,
  total,
}: {
  search: string;
  onSearch: (v: string) => void;
  total: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 mb-4">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search by name or role…"
        aria-label="Search candidates"
        className="w-full max-w-sm bg-surface border border-hairline rounded-input px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary outline-none focus:border-ink-secondary transition-colors duration-120"
      />
      <span className="font-mono text-xs text-ink-tertiary tabular-nums whitespace-nowrap">
        {total} {total === 1 ? 'candidate' : 'candidates'}
      </span>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="border-t border-hairline pt-12">
      <Users className="h-5 w-5 text-ink-tertiary mb-4" aria-hidden="true" />
      <p className="font-serif italic text-section text-ink-secondary mb-6 [text-wrap:pretty]">
        No candidates on file yet. Add one to get started.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="text-sm font-medium text-ink underline decoration-hairline underline-offset-4 hover:decoration-ink transition-colors duration-120"
      >
        Add candidate →
      </button>
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────

interface TableProps {
  candidates: CandidateListItem[];
  sort: SortState;
  onToggleSort: (key: SortKey) => void;
  onOpen: (c: CandidateListItem) => void;
  onEdit: (c: CandidateListItem) => void;
  onDelete: (c: CandidateListItem) => void;
  isHr: boolean;
}

function CandidatesTable({
  candidates,
  sort,
  onToggleSort,
  onOpen,
  onEdit,
  onDelete,
  isHr,
}: TableProps) {
  return (
    <div className="border-t border-hairline overflow-x-auto">
      <table className="w-full text-base min-w-[720px]">
        <thead>
          <tr className="font-serif italic text-sm text-ink-tertiary text-left">
            <Th onClick={() => onToggleSort('name')} active={sort.key === 'name'} dir={sort.dir}>
              Name
            </Th>
            <Th
              onClick={() => onToggleSort('roleAppliedFor')}
              active={sort.key === 'roleAppliedFor'}
              dir={sort.dir}
            >
              Role
            </Th>
            <th className="py-3 pr-4 font-normal border-b border-hairline">Demographics</th>
            <Th
              onClick={() => onToggleSort('meetingCount')}
              active={sort.key === 'meetingCount'}
              dir={sort.dir}
              align="right"
            >
              Meetings
            </Th>
            <th className="py-3 pr-4 font-normal border-b border-hairline">Your last outcome</th>
            <Th
              onClick={() => onToggleSort('createdAt')}
              active={sort.key === 'createdAt'}
              dir={sort.dir}
            >
              Added
            </Th>
            <th className="py-3 font-normal border-b border-hairline text-right w-[10%]" />
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <CandidateRow
              key={c.id}
              candidate={c}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
              isHr={isHr}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  align,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: SortDir;
  align?: 'right';
}) {
  const indicator = active ? (dir === 'asc' ? '↑' : '↓') : '';
  return (
    <th
      className={`py-3 pr-4 font-normal border-b border-hairline ${align === 'right' ? 'text-right' : ''}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`font-serif italic text-sm text-ink-tertiary hover:text-ink-secondary transition-colors duration-120 ${active ? 'text-ink-secondary' : ''}`}
      >
        {children}
        {indicator && <span className="ml-1.5 font-mono text-xs">{indicator}</span>}
      </button>
    </th>
  );
}

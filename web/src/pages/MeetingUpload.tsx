import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MEETING_TYPES, MEETING_TYPE_LABELS, type MeetingType } from '@fairhire/shared';
import {
  readTranscriptFile,
  validateTranscript,
  validatePromotionFields,
  type PromotionFields,
} from '../lib/upload';
import { useCandidates, useCreateCandidate, useCreateMeeting } from '../lib/uploadApi';
import type { CandidateOption } from '../lib/upload';

const EMPTY_PROMOTION: PromotionFields = {
  currentRole: '',
  tenureYears: '',
  lastPromotedAt: '',
};

// yyyy-MM-ddThh:mm for <input type="datetime-local">, in local time.
function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MeetingUpload() {
  const navigate = useNavigate();
  const candidatesQuery = useCandidates();
  const createMeeting = useCreateMeeting();

  const [meetingType, setMeetingType] = useState<MeetingType>('hiring');
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [filename, setFilename] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [when, setWhen] = useState(() => toLocalDatetimeValue(new Date()));
  const [promotion, setPromotion] = useState<PromotionFields>(EMPTY_PROMOTION);
  const [error, setError] = useState<string | null>(null);
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [candidateFilter, setCandidateFilter] = useState('');

  const isPromotion = meetingType === 'promotion';

  // Promotion targets a single employee (Section 3 — the route nests the
  // promotion fields onto the first candidate). Selecting a candidate in
  // promotion mode replaces any prior pick rather than toggling a set.
  const toggleCandidate = (id: string) => {
    if (isPromotion) {
      setSelected((prev) => (prev.has(id) ? new Set() : new Set([id])));
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Switching tabs resets mode-specific selections that no longer apply:
  // promotion is single-select, so a multi-pick hiring selection would be
  // ambiguous on switch. Clear it and the promotion fields for a clean slate.
  const switchMode = (next: MeetingType) => {
    if (next === meetingType) return;
    setMeetingType(next);
    setSelected(new Set());
    setPromotion(EMPTY_PROMOTION);
    setError(null);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setTranscript(await readTranscriptFile(file));
      setFilename(file.name);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  const onCandidateCreated = (c: CandidateOption) => {
    setSelected((prev) => new Set(prev).add(c.id));
    setAddingCandidate(false);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Add a title.');
      return;
    }
    const transcriptError = validateTranscript(transcript);
    if (transcriptError) {
      setError(transcriptError);
      return;
    }
    if (selected.size === 0) {
      setError(isPromotion ? 'Select the employee being considered.' : 'Select at least one candidate.');
      return;
    }
    if (isPromotion) {
      const promoError = validatePromotionFields(promotion);
      if (promoError) {
        setError(promoError);
        return;
      }
    }

    try {
      const base = {
        title: title.trim(),
        transcript,
        transcriptFilename: filename ?? undefined,
        date: new Date(when).toISOString(),
        candidateIds: [...selected],
      };
      const meeting = await createMeeting.mutateAsync(
        isPromotion
          ? {
              ...base,
              meetingType: 'promotion',
              currentRole: promotion.currentRole.trim(),
              tenureYears: Number(promotion.tenureYears),
              lastPromotedAt: promotion.lastPromotedAt
                ? new Date(promotion.lastPromotedAt).toISOString()
                : undefined,
            }
          : { ...base, meetingType: 'hiring' },
      );
      navigate(`/meetings/${meeting.id}`);
    } catch {
      setError('Upload failed. Please try again.');
    }
  };

  return (
    <div className="max-w-prose mx-auto">
      <h1 className="font-serif text-page text-ink leading-tight mb-2">Upload debrief</h1>
      <p className="font-serif italic text-section text-ink-secondary mb-6">
        Paste or upload a panel transcript to analyse for bias.
      </p>

      {/* Hiring | Promotion mode tabs (Section 3). The choice writes
          meetingType onto the created meeting and branches the engine,
          decision panel, and Mirror downstream. Tablist semantics so the
          mode reads correctly to assistive tech. */}
      <div role="tablist" aria-label="Debrief type" className="flex gap-1 border-b border-hairline mb-8">
        {MEETING_TYPES.map((type) => {
          const active = type === meetingType;
          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchMode(type)}
              className={`-mb-px px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-120 ${
                active
                  ? 'border-accent text-ink'
                  : 'border-transparent text-ink-tertiary hover:text-ink-secondary'
              }`}
            >
              {MEETING_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="space-y-8">
        <div>
          <label htmlFor="title" className="fh-label block mb-2">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. VP Sustainable Finance · panel debrief"
            className="w-full bg-surface border border-hairline rounded-input px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary outline-none focus:border-ink-secondary transition-colors duration-120"
          />
        </div>

        <div>
          <label htmlFor="when" className="fh-label block mb-2">
            Date
          </label>
          <input
            id="when"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="bg-surface border border-hairline rounded-input px-3 py-2 text-sm text-ink outline-none focus:border-ink-secondary transition-colors duration-120"
          />
        </div>

        {isPromotion && (
          <PromotionFieldset fields={promotion} onChange={setPromotion} />
        )}

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="fh-label">{isPromotion ? 'Employee' : 'Candidates'}</span>
            <button
              type="button"
              onClick={() => setAddingCandidate((v) => !v)}
              className="text-xs font-medium text-ink-secondary hover:text-ink transition-colors duration-120"
            >
              {addingCandidate ? 'Cancel' : isPromotion ? '+ Add a new employee' : '+ Add a new candidate'}
            </button>
          </div>
          {isPromotion && (
            <p className="text-xs text-ink-tertiary mb-2">
              Select the one employee being considered for promotion.
            </p>
          )}

          {addingCandidate && (
            <AddCandidateForm
              onCreated={onCandidateCreated}
              onCancel={() => setAddingCandidate(false)}
            />
          )}

          {candidatesQuery.isLoading && (
            <p className="text-sm text-ink-tertiary">Loading candidates…</p>
          )}
          {candidatesQuery.isError && (
            <p className="text-sm text-ink-tertiary">Couldn’t load candidates.</p>
          )}
          {candidatesQuery.data && candidatesQuery.data.length === 0 && !addingCandidate && (
            <p className="text-sm text-ink-tertiary">
              No candidates in your org yet — use “Add a new candidate” above.
            </p>
          )}
          {candidatesQuery.data && candidatesQuery.data.length > 0 && (
            <CandidatePicker
              candidates={candidatesQuery.data}
              selected={selected}
              onToggle={toggleCandidate}
              filter={candidateFilter}
              onFilter={setCandidateFilter}
            />
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label htmlFor="transcript" className="fh-label">
              Transcript
            </label>
            <label className="text-xs font-medium text-ink-secondary hover:text-ink cursor-pointer transition-colors duration-120">
              {filename ? `Loaded: ${filename}` : 'Upload .txt'}
              <input type="file" accept=".txt,text/plain" onChange={onFile} className="hidden" />
            </label>
          </div>
          <textarea
            id="transcript"
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              setFilename(null);
            }}
            rows={12}
            placeholder="Paste the panel debrief transcript…"
            className="w-full bg-surface border border-hairline rounded-input px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary leading-relaxed outline-none focus:border-ink-secondary transition-colors duration-120 resize-y"
          />
        </div>

        {error && <p className="text-sm text-accent">{error}</p>}

        <div className="space-y-3">
          <button
            type="submit"
            disabled={createMeeting.isPending}
            className="text-sm font-medium text-ink-inverse bg-ink px-4 py-2 rounded-input hover:bg-accent transition-colors duration-120 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {createMeeting.isPending ? 'Analysing…' : 'Upload & analyse'}
          </button>
          {/* Pre-submit framing per Section 4 of the Week 5 plan — sets
              user expectation that analysis takes ~a minute and is safe
              to leave alone. Editorial tone, no bold or icon. */}
          <p className="font-serif italic text-sm text-ink-tertiary">
            Your debrief will be analysed for language patterns — this takes about a
            minute, and it's safe to leave the page once it starts.
          </p>
        </div>
      </form>
    </div>
  );
}

// ── Scrollable, searchable, multi-select candidate list ──────────────────
// Replaces the prior label+checkbox list. Bounded height with overflow so
// the page stays uncluttered as the org grows. Selected rows pick up
// bg-surface-active and a trailing accent dot; the row itself is the click
// target so the whole strip is hit-test-able. Listbox semantics carry the
// multi-select state to assistive tech without a visible checkbox.

interface CandidatePickerProps {
  candidates: CandidateOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  filter: string;
  onFilter: (next: string) => void;
}

function CandidatePicker({
  candidates,
  selected,
  onToggle,
  filter,
  onFilter,
}: CandidatePickerProps) {
  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? candidates.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.roleAppliedFor.toLowerCase().includes(needle),
      )
    : candidates;

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
        placeholder="Search candidates…"
        aria-label="Search candidates"
        className="w-full bg-surface border border-hairline rounded-input px-3 py-1.5 text-sm text-ink placeholder:text-ink-tertiary outline-none focus:border-ink-secondary transition-colors duration-120"
      />
      <div className="border border-hairline rounded-input max-h-72 overflow-y-auto bg-surface">
        {visible.length === 0 ? (
          <p className="px-3 py-3 text-sm text-ink-tertiary italic">
            No candidates match “{filter.trim()}”.
          </p>
        ) : (
          <ul
            role="listbox"
            aria-multiselectable="true"
            aria-label="Candidates"
            className="divide-y divide-hairline"
          >
            {visible.map((c) => {
              const isSel = selected.has(c.id);
              return (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={isSel}
                  tabIndex={0}
                  onClick={() => onToggle(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggle(c.id);
                    }
                  }}
                  className={`flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer transition-colors duration-120 focus:outline-none ${
                    isSel
                      ? 'bg-surface-active text-ink'
                      : 'text-ink hover:bg-surface-sunk focus:bg-surface-sunk'
                  }`}
                >
                  <span>
                    <span>{c.name}</span>
                    <span className="text-ink-tertiary"> · {c.roleAppliedFor}</span>
                  </span>
                  {isSel && (
                    <span
                      aria-hidden="true"
                      className="inline-block w-1.5 h-1.5 rounded-full bg-accent shrink-0"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Promotion-specific fieldset ───────────────────────────────────────────
// Rendered only on the Promotion tab. Captures the target employee's
// current role/level, tenure, and (optionally) last promotion date. These
// are persisted by the route onto the selected candidate row — see Section
// 3 of the Week 5 plan. The target level itself reuses the candidate's
// roleAppliedFor, set when the employee is added.

interface PromotionFieldsetProps {
  fields: PromotionFields;
  onChange: (next: PromotionFields) => void;
}

function PromotionFieldset({ fields, onChange }: PromotionFieldsetProps) {
  const set = (patch: Partial<PromotionFields>) => onChange({ ...fields, ...patch });
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
      <div>
        <label htmlFor="currentRole" className="fh-label block mb-2">
          Current role / level
        </label>
        <input
          id="currentRole"
          type="text"
          value={fields.currentRole}
          onChange={(e) => set({ currentRole: e.target.value })}
          placeholder="e.g. Vice President"
          className="w-full bg-surface border border-hairline rounded-input px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary outline-none focus:border-ink-secondary transition-colors duration-120"
        />
      </div>
      <div>
        <label htmlFor="tenureYears" className="fh-label block mb-2">
          Tenure (years)
        </label>
        <input
          id="tenureYears"
          type="number"
          min={0}
          max={60}
          step={1}
          value={fields.tenureYears}
          onChange={(e) => set({ tenureYears: e.target.value })}
          placeholder="e.g. 6"
          className="w-full bg-surface border border-hairline rounded-input px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary outline-none focus:border-ink-secondary transition-colors duration-120"
        />
      </div>
      <div>
        <label htmlFor="lastPromotedAt" className="fh-label block mb-2">
          Last promoted <span className="text-ink-tertiary font-normal">(optional)</span>
        </label>
        <input
          id="lastPromotedAt"
          type="date"
          value={fields.lastPromotedAt}
          onChange={(e) => set({ lastPromotedAt: e.target.value })}
          className="bg-surface border border-hairline rounded-input px-3 py-2 text-sm text-ink outline-none focus:border-ink-secondary transition-colors duration-120"
        />
      </div>
    </div>
  );
}

// ── Add-candidate sub-form ────────────────────────────────────────────────
// Inline expand/collapse on the upload form so the user can add a missing
// candidate without leaving the flow. Lives on a sunk-surface tile to stay
// visually contained to the Candidates section. onCreated auto-selects the
// new row in the parent's picker so the next step is one continuous action.

interface AddCandidateFormProps {
  onCreated: (candidate: CandidateOption) => void;
  onCancel: () => void;
}

function AddCandidateForm({ onCreated, onCancel }: AddCandidateFormProps) {
  const createCandidate = useCreateCandidate();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    if (!trimmedName || !trimmedRole) {
      setError('Both name and role are required.');
      return;
    }
    try {
      const created = await createCandidate.mutateAsync({
        name: trimmedName,
        roleAppliedFor: trimmedRole,
      });
      onCreated(created);
    } catch {
      setError('Could not add candidate. Please try again.');
    }
  };

  // Enter-to-submit on either input. Nested <form> inside the outer upload
  // form would be invalid, so this is a plain div with explicit handlers.
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="bg-surface-sunk p-4 mb-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKey}
          placeholder="Candidate name"
          aria-label="Candidate name"
          autoFocus
          className="w-full bg-surface border border-hairline rounded-input px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary outline-none focus:border-ink-secondary transition-colors duration-120"
        />
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={onKey}
          placeholder="Role applied for"
          aria-label="Role applied for"
          className="w-full bg-surface border border-hairline rounded-input px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary outline-none focus:border-ink-secondary transition-colors duration-120"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={createCandidate.isPending}
          className="text-xs font-medium text-ink-inverse bg-ink px-3 py-1.5 rounded-input hover:bg-accent transition-colors duration-120 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {createCandidate.isPending ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-ink-secondary hover:text-ink transition-colors duration-120"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-accent">{error}</span>}
      </div>
    </div>
  );
}

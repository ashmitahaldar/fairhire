import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { readTranscriptFile, validateTranscript } from '../lib/upload';
import { useCandidates, useCreateCandidate, useCreateMeeting } from '../lib/uploadApi';
import type { CandidateOption } from '../lib/upload';

// yyyy-MM-ddThh:mm for <input type="datetime-local">, in local time.
function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MeetingUpload() {
  const navigate = useNavigate();
  const candidatesQuery = useCandidates();
  const createMeeting = useCreateMeeting();

  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [filename, setFilename] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [when, setWhen] = useState(() => toLocalDatetimeValue(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [addingCandidate, setAddingCandidate] = useState(false);

  const toggleCandidate = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      setError('Select at least one candidate.');
      return;
    }

    try {
      const meeting = await createMeeting.mutateAsync({
        title: title.trim(),
        transcript,
        transcriptFilename: filename ?? undefined,
        date: new Date(when).toISOString(),
        candidateIds: [...selected],
      });
      navigate(`/meetings/${meeting.id}`);
    } catch {
      setError('Upload failed. Please try again.');
    }
  };

  return (
    <div className="max-w-prose mx-auto">
      <h1 className="font-serif text-page text-ink leading-tight mb-2">Upload debrief</h1>
      <p className="font-serif italic text-section text-ink-secondary mb-8">
        Paste or upload a panel transcript to analyse for bias.
      </p>

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

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="fh-label">Candidates</span>
            <button
              type="button"
              onClick={() => setAddingCandidate((v) => !v)}
              className="text-xs font-medium text-ink-secondary hover:text-ink transition-colors duration-120"
            >
              {addingCandidate ? 'Cancel' : '+ Add a new candidate'}
            </button>
          </div>

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
            <div className="space-y-1.5">
              {candidatesQuery.data.map((c) => (
                <label key={c.id} className="flex items-center gap-3 text-sm text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleCandidate(c.id)}
                    className="accent-accent"
                  />
                  <span>{c.name}</span>
                  <span className="text-ink-tertiary">· {c.roleAppliedFor}</span>
                </label>
              ))}
            </div>
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

        <button
          type="submit"
          disabled={createMeeting.isPending}
          className="text-sm font-medium text-ink-inverse bg-ink px-4 py-2 rounded-input hover:bg-accent transition-colors duration-120 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {createMeeting.isPending ? 'Analysing…' : 'Upload & analyse'}
        </button>
      </form>
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

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { readTranscriptFile, validateTranscript } from '../lib/upload';
import { useCandidates, useCreateMeeting } from '../lib/uploadApi';

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
          <span className="fh-label block mb-2">Candidates</span>
          {candidatesQuery.isLoading && (
            <p className="text-sm text-ink-tertiary">Loading candidates…</p>
          )}
          {candidatesQuery.isError && (
            <p className="text-sm text-ink-tertiary">Couldn’t load candidates.</p>
          )}
          {candidatesQuery.data && candidatesQuery.data.length === 0 && (
            <p className="text-sm text-ink-tertiary">No candidates in your org yet.</p>
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

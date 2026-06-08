import type { AnalysisStatus, FlagType } from '@fairhire/shared';
import { severityFor } from './severity';
import {
  FLAG_TYPE_LABELS,
  type DecisionOutcome,
  type FlagVM,
  type MeetingVM,
  type TranscriptParagraph,
} from './flagReview';

// ── Raw GET /meetings/:id response (only the fields we consume) ──────────────

interface FlagResponse {
  id: string;
  flagType: FlagType;
  excerpt: string;
  reasoning: string;
  confidenceScore: number;
  suggestedAlt: string | null;
}

interface AnalysisRunResponse {
  status: AnalysisStatus;
  modelVersion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

interface DecisionResponse {
  id: string;
  candidateId: string;
  outcome: DecisionOutcome;
}

export interface MeetingResponse {
  id: string;
  title: string;
  transcript: string;
  date: string;
  candidates: { candidate: { id: string; name: string; roleAppliedFor: string } }[];
  flags: FlagResponse[];
  analysisRuns: AnalysisRunResponse[];
  decisions: DecisionResponse[];
}

// ── Transcript segmentation ──────────────────────────────────────────────────
// Split the raw transcript into paragraphs and locate each flag's excerpt as a
// span. Exact-substring match; a flag whose excerpt isn't found simply gets no
// highlight (it still appears in the gutter). Each flag is highlighted at most
// once — in the first paragraph it's found in.

function splitParagraphs(transcript: string): string[] {
  const byBlankLine = transcript
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (byBlankLine.length > 1) return byBlankLine;
  return transcript
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);
}

interface SpanMatch {
  start: number;
  len: number;
  flagId: string;
}

function segmentParagraph(text: string, flags: FlagResponse[]): TranscriptParagraph {
  const matches: SpanMatch[] = flags
    .map((f) => ({ start: text.indexOf(f.excerpt), len: f.excerpt.length, flagId: f.id }))
    .filter((m) => m.start !== -1 && m.len > 0)
    .sort((a, b) => a.start - b.start);

  // Drop overlaps, keeping the earliest match.
  const kept: SpanMatch[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      kept.push(m);
      lastEnd = m.start + m.len;
    }
  }

  const segments: TranscriptParagraph = [];
  let cursor = 0;
  for (const m of kept) {
    if (m.start > cursor) segments.push({ kind: 'text', text: text.slice(cursor, m.start) });
    segments.push({ kind: 'flag', text: text.slice(m.start, m.start + m.len), flagId: m.flagId });
    cursor = m.start + m.len;
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}

function segmentTranscript(transcript: string, flags: FlagResponse[]): TranscriptParagraph[] {
  const used = new Set<string>();
  return splitParagraphs(transcript).map((para) => {
    const available = flags.filter((f) => !used.has(f.id));
    const segs = segmentParagraph(para, available);
    for (const s of segs) if (s.kind === 'flag') used.add(s.flagId);
    return segs;
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export function adaptMeeting(res: MeetingResponse): MeetingVM {
  const flags: FlagVM[] = res.flags.map((f, i) => {
    const sev = severityFor(f.confidenceScore);
    return {
      id: f.id,
      index: i + 1,
      flagType: f.flagType,
      category: FLAG_TYPE_LABELS[f.flagType] ?? f.flagType,
      span: f.excerpt,
      reasoning: f.reasoning,
      suggestion: f.suggestedAlt,
      confidence: f.confidenceScore,
      severityKey: sev.key,
      severityLabel: sev.label,
    };
  });

  const run = res.analysisRuns[0] ?? null;
  const candidate = res.candidates[0]?.candidate;
  // Decision for the primary candidate, if any has been recorded. The
  // schema permits multiple decisions per (meeting, candidate) but UX-wise
  // we treat the latest as the canonical one and PATCH it on change.
  const decision = candidate
    ? (res.decisions.find((d) => d.candidateId === candidate.id) ?? null)
    : null;

  return {
    id: res.id,
    title: res.title,
    candidateId: candidate?.id ?? null,
    candidateName: candidate?.name ?? 'Unknown candidate',
    candidateRole: candidate?.roleAppliedFor ?? '',
    panelDate: formatDate(res.date),
    wordCount: wordCount(res.transcript),
    transcript: segmentTranscript(res.transcript, res.flags),
    flags,
    analysis: {
      status: run?.status ?? 'pending',
      durationLabel: run ? formatDuration(run.startedAt, run.completedAt) : null,
      model: run?.modelVersion ?? null,
      // The engine doesn't track spans evaluated; transcript word count is a
      // reasonable display proxy and the streaming counter animates up to it.
      spansEvaluated: wordCount(res.transcript),
      error: run?.error ?? null,
    },
    decision: decision
      ? { id: decision.id, outcome: decision.outcome }
      : { id: null, outcome: 'in_progress' },
  };
}

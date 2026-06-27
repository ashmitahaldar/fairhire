import type { AnalysisStatus, FlagType, MeetingType } from '@fairhire/shared';
import { severityFor } from './severity';
import {
  FLAG_TYPE_LABELS,
  type DecisionOutcome,
  type FlagSpanRef,
  type FlagVM,
  type MeetingVM,
} from './flagReview';

// ── Raw GET /meetings/:id response (only the fields we consume) ──────────────

interface FlagSpanResponse {
  id: string;
  startOffset: number;
  endOffset: number;
}

interface FlagResponse {
  id: string;
  flagType: FlagType;
  excerpt: string;
  reasoning: string;
  confidenceScore: number;
  suggestedAlt: string | null;
  // Dismissal state lives on the row itself (Flag.dismissed +
  // dismissReason). Surfaced into the VM so the screen can seed its
  // dismissed-set from the server on mount and the state persists
  // across reloads.
  dismissed: boolean;
  dismissReason: string | null;
  // Server-supplied character offsets into the transcript — one entry per
  // textual occurrence (Week 5 Step 1 persists, Step 2 adopts on the wire).
  // Pre-Week-5 flags backfilled via scripts/backfill-flag-spans.ts; LLM
  // excerpts that weren't verbatim substrings come through with an empty
  // array and fall back to gutter-only display.
  spans: FlagSpanResponse[];
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
  meetingType: MeetingType;
  candidates: { candidate: { id: string; name: string; roleAppliedFor: string } }[];
  flags: FlagResponse[];
  analysisRuns: AnalysisRunResponse[];
  decisions: DecisionResponse[];
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

// Flatten every flag's spans into one document-level list. Filter out
// inverted or zero-length spans defensively — the engine shouldn't emit
// them, but a future ingestion path could, and an inverted decoration
// would crash the editor.
function flattenSpans(flags: FlagResponse[]): FlagSpanRef[] {
  const out: FlagSpanRef[] = [];
  for (const f of flags) {
    for (const s of f.spans) {
      if (s.endOffset > s.startOffset) {
        out.push({ flagId: f.id, start: s.startOffset, end: s.endOffset });
      }
    }
  }
  // Stable order by start offset so the renderer's decoration set is
  // deterministic per render and any selector that targets the "first"
  // occurrence (scroll-into-view) picks the earliest.
  out.sort((a, b) => a.start - b.start);
  return out;
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
      dismissed: f.dismissed,
      dismissReason: f.dismissReason,
      // Mirror the wire spans length — only the valid spans the renderer
      // will actually highlight. The Found-in-N footer keys off this, so
      // a flag with zero verbatim matches (LLM paraphrase) shows 0 and
      // suppresses the affordance.
      instanceCount: f.spans.filter((s) => s.endOffset > s.startOffset).length,
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
    meetingType: res.meetingType,
    candidateId: candidate?.id ?? null,
    candidateName: candidate?.name ?? 'Unknown candidate',
    candidateRole: candidate?.roleAppliedFor ?? '',
    panelDate: formatDate(res.date),
    wordCount: wordCount(res.transcript),
    transcriptText: res.transcript,
    flagSpans: flattenSpans(res.flags),
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

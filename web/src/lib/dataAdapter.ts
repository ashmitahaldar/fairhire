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
  // Server-supplied character offsets into the transcript — one entry per
  // textual occurrence (Week 5 Step 2). Pre-Week-5 flags backfilled via
  // scripts/backfill-flag-spans.ts; LLM excerpts that weren't verbatim
  // substrings come through with an empty array and gracefully fall back to
  // gutter-only display.
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
  candidates: { candidate: { id: string; name: string; roleAppliedFor: string } }[];
  flags: FlagResponse[];
  analysisRuns: AnalysisRunResponse[];
  decisions: DecisionResponse[];
}

// ── Transcript segmentation ──────────────────────────────────────────────────
// Splits the raw transcript into paragraphs and partitions each
// server-supplied FlagSpan into the paragraph that contains it. The
// renderer (Transcript.tsx) consumes `TranscriptParagraph[]` and is
// unchanged from Week 4 — the only switch is the source of truth for
// span positions (server FlagSpan rows instead of client-side indexOf).
//
// Multi-instance behaves naturally: a flag with N spans across one or
// more paragraphs emits N flag segments with the same flagId, each
// getting its own superscript at render time.
//
// Overlap: spans that overlap within a single paragraph drop the
// later one and keep the earliest, matching the Week 4 behaviour. TipTap
// (Step 3) will layer overlapping decorations additively instead.

interface ParagraphRange {
  text: string;
  start: number; // offset of this paragraph in the original transcript
  end: number;   // exclusive
}

// Split the transcript into paragraphs while tracking each paragraph's
// absolute offset range within the original transcript. We need the
// ranges to translate server-supplied document-level FlagSpan offsets
// into paragraph-local segment offsets. The split mirrors the Week 4
// shape (blank-line first, single-newline fallback) so visual layout
// stays identical.
function splitParagraphsWithRanges(transcript: string): ParagraphRange[] {
  // Pick the same separator strategy the Week 4 splitter used.
  // The simplest way to preserve absolute offsets across the chosen
  // separator is to scan once with a regex; tracking is then cheap.
  const blankLineRe = /\n\s*\n/g;
  const splitsBlank: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = blankLineRe.exec(transcript)) !== null) {
    splitsBlank.push(m.index);
    splitsBlank.push(m.index + m[0].length);
  }

  // Build raw paragraph ranges from the chosen separator.
  function rangesFromSplitOffsets(offs: number[]): ParagraphRange[] {
    const out: ParagraphRange[] = [];
    let cursor = 0;
    for (let i = 0; i < offs.length; i += 2) {
      const sepStart = offs[i];
      const sepEnd = offs[i + 1];
      if (sepStart > cursor) {
        out.push({ text: transcript.slice(cursor, sepStart), start: cursor, end: sepStart });
      }
      cursor = sepEnd;
    }
    if (cursor < transcript.length) {
      out.push({ text: transcript.slice(cursor), start: cursor, end: transcript.length });
    }
    return out;
  }

  // Trim each range to skip leading/trailing whitespace while preserving
  // the absolute start offset of the remaining content.
  function trimRange(r: ParagraphRange): ParagraphRange | null {
    let s = 0;
    let e = r.text.length;
    while (s < e && /\s/.test(r.text[s])) s += 1;
    while (e > s && /\s/.test(r.text[e - 1])) e -= 1;
    if (s === e) return null;
    return { text: r.text.slice(s, e), start: r.start + s, end: r.start + e };
  }

  const blankSplit = rangesFromSplitOffsets(splitsBlank)
    .map(trimRange)
    .filter((r): r is ParagraphRange => r !== null);

  if (blankSplit.length > 1) return blankSplit;

  // Fallback to single-newline split — same as Week 4. Rebuild offsets.
  const newlineRe = /\n/g;
  const splitsNl: number[] = [];
  while ((m = newlineRe.exec(transcript)) !== null) {
    splitsNl.push(m.index);
    splitsNl.push(m.index + 1);
  }
  return rangesFromSplitOffsets(splitsNl)
    .map(trimRange)
    .filter((r): r is ParagraphRange => r !== null);
}

interface SpanPlacement {
  start: number; // paragraph-local offset
  end: number;   // paragraph-local offset
  flagId: string;
}

// Distribute a flat list of server FlagSpan rows into per-paragraph
// buckets, translating absolute transcript offsets to paragraph-local
// offsets. A span that straddles a paragraph boundary is dropped — that
// case shouldn't arise (the engine writes verbatim excerpts, and the
// excerpt extractor walks sentence boundaries) but the guard keeps the
// renderer's invariants honest.
function partitionSpansByParagraph(
  paragraphs: ParagraphRange[],
  flags: FlagResponse[],
): SpanPlacement[][] {
  const buckets: SpanPlacement[][] = paragraphs.map(() => []);
  for (const flag of flags) {
    for (const span of flag.spans) {
      const pIdx = paragraphs.findIndex(
        (p) => span.startOffset >= p.start && span.endOffset <= p.end,
      );
      if (pIdx === -1) continue;
      const p = paragraphs[pIdx];
      buckets[pIdx].push({
        start: span.startOffset - p.start,
        end: span.endOffset - p.start,
        flagId: flag.id,
      });
    }
  }
  return buckets;
}

function segmentParagraph(text: string, placements: SpanPlacement[]): TranscriptParagraph {
  // Earliest-start-wins on overlap. With server-supplied spans this is
  // rare (two distinct flags sharing text); the Week 4 renderer cannot
  // stack so we drop the later span. Step 3's TipTap renderer will
  // additively layer overlapping decorations instead.
  const sorted = [...placements].sort((a, b) => a.start - b.start);
  const kept: SpanPlacement[] = [];
  let lastEnd = -1;
  for (const p of sorted) {
    if (p.start >= lastEnd) {
      kept.push(p);
      lastEnd = p.end;
    }
  }

  const segments: TranscriptParagraph = [];
  let cursor = 0;
  for (const p of kept) {
    if (p.start > cursor) segments.push({ kind: 'text', text: text.slice(cursor, p.start) });
    segments.push({ kind: 'flag', text: text.slice(p.start, p.end), flagId: p.flagId });
    cursor = p.end;
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}

function segmentTranscript(
  transcript: string,
  flags: FlagResponse[],
): TranscriptParagraph[] {
  const paragraphs = splitParagraphsWithRanges(transcript);
  const buckets = partitionSpansByParagraph(paragraphs, flags);
  return paragraphs.map((p, i) => segmentParagraph(p.text, buckets[i]));
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

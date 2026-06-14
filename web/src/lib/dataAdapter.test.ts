import { describe, expect, it } from 'vitest';
import { adaptMeeting, type MeetingResponse } from './dataAdapter';

// Adapter contract: shape the wire response into a MeetingVM that
// preserves the raw transcript and exposes flag occurrences as a flat
// document-level offset list. Rendering — paragraph split, decoration
// placement — is the Transcript component's job (Step 3 onward).

function makeResponse(over: Partial<MeetingResponse> = {}): MeetingResponse {
  return {
    id: 'm1',
    title: 'Panel debrief',
    transcript: '',
    date: '2026-05-01T00:00:00.000Z',
    meetingType: 'hiring',
    candidates: [
      { candidate: { id: 'c1', name: 'Test Candidate', roleAppliedFor: 'Analyst' } },
    ],
    flags: [],
    analysisRuns: [],
    decisions: [],
    ...over,
  };
}

describe('adaptMeeting — transcript + flag spans', () => {
  it('passes through the raw transcript text unchanged', () => {
    const transcript = 'We discussed her plans for starting a family.';
    const vm = adaptMeeting(makeResponse({ transcript }));
    expect(vm.transcriptText).toBe(transcript);
  });

  it('flattens a single-occurrence span into the document-level list', () => {
    const transcript = 'We discussed her plans for starting a family.';
    const excerpt = 'starting a family';
    const start = transcript.indexOf(excerpt);
    const end = start + excerpt.length;

    const vm = adaptMeeting(
      makeResponse({
        transcript,
        flags: [
          {
            id: 'f1',
            flagType: 'asymmetric_concern',
            excerpt,
            reasoning: 'r',
            confidenceScore: 0.9,
            suggestedAlt: null, dismissed: false, dismissReason: null,
            spans: [{ id: 's1', startOffset: start, endOffset: end }],
          },
        ],
      }),
    );

    expect(vm.flagSpans).toEqual([{ flagId: 'f1', start, end }]);
  });

  it('emits one entry per occurrence for multi-instance flags', () => {
    const transcript = 'cultural fit was the concern. Again on cultural fit.';
    const ex = 'cultural fit';
    const first = transcript.indexOf(ex);
    const second = transcript.indexOf(ex, first + 1);

    const vm = adaptMeeting(
      makeResponse({
        transcript,
        flags: [
          {
            id: 'f1',
            flagType: 'hedging_language',
            excerpt: ex,
            reasoning: 'r',
            confidenceScore: 0.88,
            suggestedAlt: null, dismissed: false, dismissReason: null,
            spans: [
              { id: 's1', startOffset: first, endOffset: first + ex.length },
              { id: 's2', startOffset: second, endOffset: second + ex.length },
            ],
          },
        ],
      }),
    );

    expect(vm.flagSpans).toHaveLength(2);
    expect(vm.flagSpans.every((s) => s.flagId === 'f1')).toBe(true);
  });

  it('sorts spans by start offset across multiple flags', () => {
    // Two different flags emit spans in non-sorted order on the wire;
    // the adapter normalises to ascending start so the renderer's
    // decoration set is deterministic.
    const transcript = 'aaa bbb ccc ddd';
    const vm = adaptMeeting(
      makeResponse({
        transcript,
        flags: [
          {
            id: 'f-late',
            flagType: 'biased_language',
            excerpt: 'ccc',
            reasoning: 'r',
            confidenceScore: 0.7,
            suggestedAlt: null, dismissed: false, dismissReason: null,
            spans: [{ id: 's-c', startOffset: 8, endOffset: 11 }],
          },
          {
            id: 'f-early',
            flagType: 'biased_language',
            excerpt: 'aaa',
            reasoning: 'r',
            confidenceScore: 0.7,
            suggestedAlt: null, dismissed: false, dismissReason: null,
            spans: [{ id: 's-a', startOffset: 0, endOffset: 3 }],
          },
        ],
      }),
    );

    expect(vm.flagSpans.map((s) => s.start)).toEqual([0, 8]);
  });

  it('drops inverted or zero-length spans defensively', () => {
    // The engine doesn't emit these, but a bad ingestion would crash the
    // editor at decoration time — the adapter filters them out at the
    // boundary so the renderer can trust its input.
    const vm = adaptMeeting(
      makeResponse({
        transcript: 'cultural fit.',
        flags: [
          {
            id: 'f1',
            flagType: 'hedging_language',
            excerpt: 'cultural fit',
            reasoning: 'r',
            confidenceScore: 0.88,
            suggestedAlt: null, dismissed: false, dismissReason: null,
            spans: [
              { id: 'ok', startOffset: 0, endOffset: 12 },
              { id: 'bad-zero', startOffset: 5, endOffset: 5 },
              { id: 'bad-inverted', startOffset: 10, endOffset: 3 },
            ],
          },
        ],
      }),
    );

    expect(vm.flagSpans).toEqual([{ flagId: 'f1', start: 0, end: 12 }]);
  });

  it('emits no spans for a flag with an empty spans array (LLM paraphrase fallback)', () => {
    // analyseTranscript writes a Flag with no FlagSpan rows when the
    // excerpt isn't a verbatim substring; the gutter still renders, the
    // transcript just doesn't highlight that flag.
    const vm = adaptMeeting(
      makeResponse({
        transcript: 'A clean transcript with no relevant phrases.',
        flags: [
          {
            id: 'f1',
            flagType: 'hedging_language',
            excerpt: 'paraphrased text that does not appear verbatim',
            reasoning: 'r',
            confidenceScore: 0.7,
            suggestedAlt: null, dismissed: false, dismissReason: null,
            spans: [],
          },
        ],
      }),
    );

    expect(vm.flagSpans).toEqual([]);
    expect(vm.flags).toHaveLength(1); // gutter still renders
  });

  it('surfaces persisted dismissal state so the screen can seed on mount', () => {
    const vm = adaptMeeting(
      makeResponse({
        transcript: 'cultural fit.',
        flags: [
          {
            id: 'f-live',
            flagType: 'hedging_language',
            excerpt: 'cultural fit',
            reasoning: 'r',
            confidenceScore: 0.88,
            suggestedAlt: null,
            dismissed: false,
            dismissReason: null,
            spans: [{ id: 's1', startOffset: 0, endOffset: 12 }],
          },
          {
            id: 'f-gone',
            flagType: 'age_bias',
            excerpt: 'stamina',
            reasoning: 'r',
            confidenceScore: 0.82,
            suggestedAlt: null,
            dismissed: true,
            dismissReason: 'Acknowledged',
            spans: [],
          },
        ],
      }),
    );
    const live = vm.flags.find((f) => f.id === 'f-live')!;
    const gone = vm.flags.find((f) => f.id === 'f-gone')!;
    expect(live.dismissed).toBe(false);
    expect(live.dismissReason).toBeNull();
    expect(gone.dismissed).toBe(true);
    expect(gone.dismissReason).toBe('Acknowledged');
  });

  it('uses the existing severity + label mapping (no regression from Week 4)', () => {
    const vm = adaptMeeting(
      makeResponse({
        transcript: 'cultural fit.',
        flags: [
          {
            id: 'f1',
            flagType: 'hedging_language',
            excerpt: 'cultural fit',
            reasoning: 'r',
            confidenceScore: 0.88,
            suggestedAlt: null, dismissed: false, dismissReason: null,
            spans: [{ id: 's1', startOffset: 0, endOffset: 12 }],
          },
        ],
      }),
    );

    expect(vm.flags[0].category).toBe('Hedging language');
    expect(vm.flags[0].severityKey).toBe('high');
  });
});

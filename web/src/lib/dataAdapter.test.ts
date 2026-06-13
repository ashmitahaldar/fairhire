import { describe, expect, it } from 'vitest';
import { adaptMeeting, type MeetingResponse } from './dataAdapter';

// Convenience builder so each test only specifies the fields it cares
// about. Adapter contract checks live in this module; rendering checks
// belong with Transcript.tsx (Step 3).
function makeResponse(over: Partial<MeetingResponse> = {}): MeetingResponse {
  return {
    id: 'm1',
    title: 'Panel debrief',
    transcript: '',
    date: '2026-05-01T00:00:00.000Z',
    candidates: [
      { candidate: { id: 'c1', name: 'Test Candidate', roleAppliedFor: 'Analyst' } },
    ],
    flags: [],
    analysisRuns: [],
    decisions: [],
    ...over,
  };
}

describe('adaptMeeting — span-driven segmentation', () => {
  it('places a single-occurrence span using server-supplied offsets', () => {
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
            suggestedAlt: null,
            spans: [{ id: 's1', startOffset: start, endOffset: end }],
          },
        ],
      }),
    );

    expect(vm.transcript).toHaveLength(1);
    const segs = vm.transcript[0];
    const flagSegs = segs.filter((s) => s.kind === 'flag');
    expect(flagSegs).toHaveLength(1);
    expect(flagSegs[0]).toMatchObject({ kind: 'flag', flagId: 'f1', text: excerpt });
  });

  it('emits one segment per occurrence for multi-instance flags', () => {
    // The same flag appears twice — the engine writes two FlagSpan rows;
    // the adapter must surface both so the renderer can light up both
    // instances and the gutter card can count them.
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
            suggestedAlt: null,
            spans: [
              { id: 's1', startOffset: first, endOffset: first + ex.length },
              { id: 's2', startOffset: second, endOffset: second + ex.length },
            ],
          },
        ],
      }),
    );

    const flagSegs = vm.transcript.flat().filter((s) => s.kind === 'flag');
    expect(flagSegs).toHaveLength(2);
    expect(flagSegs.every((s) => s.kind === 'flag' && s.flagId === 'f1')).toBe(true);
  });

  it('partitions spans across paragraphs correctly', () => {
    // Each paragraph picks up its own span, with paragraph-local offsets
    // translated from the server's document-level offsets.
    const para1 = 'First paragraph mentions cultural fit early.';
    const para2 = 'Second paragraph has its own cultural fit concern.';
    const transcript = `${para1}\n\n${para2}`;
    const ex = 'cultural fit';
    const off1 = transcript.indexOf(ex);
    const off2 = transcript.indexOf(ex, off1 + 1);

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
            suggestedAlt: null,
            spans: [
              { id: 's1', startOffset: off1, endOffset: off1 + ex.length },
              { id: 's2', startOffset: off2, endOffset: off2 + ex.length },
            ],
          },
        ],
      }),
    );

    expect(vm.transcript).toHaveLength(2);
    const flagSegsPara1 = vm.transcript[0].filter((s) => s.kind === 'flag');
    const flagSegsPara2 = vm.transcript[1].filter((s) => s.kind === 'flag');
    expect(flagSegsPara1).toHaveLength(1);
    expect(flagSegsPara2).toHaveLength(1);
    expect(flagSegsPara1[0].kind === 'flag' && flagSegsPara1[0].text).toBe(ex);
    expect(flagSegsPara2[0].kind === 'flag' && flagSegsPara2[0].text).toBe(ex);
  });

  it('drops overlapping spans within a paragraph, keeping the earliest', () => {
    // Two flags whose ranges overlap in the same paragraph — segment
    // renderer cannot stack, so the later one is suppressed. Step 3 will
    // layer overlapping decorations additively via TipTap.
    const transcript = 'energy needed for the pace was the concern.';
    const ex1 = 'energy needed for the pace';
    const ex2 = 'needed for the pace was';
    const off1 = transcript.indexOf(ex1);
    const off2 = transcript.indexOf(ex2);

    const vm = adaptMeeting(
      makeResponse({
        transcript,
        flags: [
          {
            id: 'f1',
            flagType: 'age_bias',
            excerpt: ex1,
            reasoning: 'r',
            confidenceScore: 0.9,
            suggestedAlt: null,
            spans: [{ id: 's1', startOffset: off1, endOffset: off1 + ex1.length }],
          },
          {
            id: 'f2',
            flagType: 'biased_language',
            excerpt: ex2,
            reasoning: 'r',
            confidenceScore: 0.8,
            suggestedAlt: null,
            spans: [{ id: 's2', startOffset: off2, endOffset: off2 + ex2.length }],
          },
        ],
      }),
    );

    const flagSegs = vm.transcript[0].filter((s) => s.kind === 'flag');
    expect(flagSegs).toHaveLength(1);
    expect(flagSegs[0].kind === 'flag' && flagSegs[0].flagId).toBe('f1');
  });

  it('emits no flag segments for a flag with zero spans (LLM paraphrase fallback)', () => {
    // The LLM occasionally emits an excerpt that is not a verbatim
    // substring of the transcript. analyseTranscript writes the flag
    // with an empty FlagSpan list; the gutter still renders, the
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
            suggestedAlt: null,
            spans: [],
          },
        ],
      }),
    );

    expect(vm.transcript.flat().some((s) => s.kind === 'flag')).toBe(false);
    expect(vm.flags).toHaveLength(1); // gutter still renders
  });

  it('uses the existing severity + label mapping (no regression from Week 4)', () => {
    const transcript = 'cultural fit.';
    const vm = adaptMeeting(
      makeResponse({
        transcript,
        flags: [
          {
            id: 'f1',
            flagType: 'hedging_language',
            excerpt: 'cultural fit',
            reasoning: 'r',
            confidenceScore: 0.88,
            suggestedAlt: null,
            spans: [{ id: 's1', startOffset: 0, endOffset: 12 }],
          },
        ],
      }),
    );

    expect(vm.flags[0].category).toBe('Hedging language');
    expect(vm.flags[0].severityKey).toBe('high');
  });
});

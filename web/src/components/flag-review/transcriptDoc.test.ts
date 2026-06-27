import { describe, expect, it } from 'vitest';
import {
  buildEditorDoc,
  rawOffsetToPmPosition,
  splitParagraphsWithRanges,
} from './transcriptDoc';

describe('splitParagraphsWithRanges', () => {
  it('splits on blank lines and tracks absolute offsets', () => {
    const t = 'First para.\n\nSecond para.';
    const ranges = splitParagraphsWithRanges(t);
    expect(ranges).toEqual([
      { text: 'First para.', start: 0, end: 11 },
      { text: 'Second para.', start: 13, end: 25 },
    ]);
  });

  it('falls back to single-newline split when no blank-line breaks exist', () => {
    const t = 'Line one.\nLine two.';
    const ranges = splitParagraphsWithRanges(t);
    expect(ranges).toEqual([
      { text: 'Line one.', start: 0, end: 9 },
      { text: 'Line two.', start: 10, end: 19 },
    ]);
  });

  it('returns a single range for a single-paragraph transcript', () => {
    const t = 'Just one paragraph here.';
    const ranges = splitParagraphsWithRanges(t);
    expect(ranges).toEqual([{ text: t, start: 0, end: t.length }]);
  });

  it('trims leading/trailing whitespace while preserving offsets', () => {
    const t = '   hello world  \n\n  hi';
    const ranges = splitParagraphsWithRanges(t);
    expect(ranges[0]).toEqual({ text: 'hello world', start: 3, end: 14 });
    expect(ranges[1]).toEqual({ text: 'hi', start: 20, end: 22 });
  });

  it('skips blank-only chunks', () => {
    const t = 'a\n\n\n\n   \n\nb';
    const ranges = splitParagraphsWithRanges(t);
    expect(ranges.map((r) => r.text)).toEqual(['a', 'b']);
  });
});

describe('buildEditorDoc', () => {
  it('emits a paragraph node per range with a single text child', () => {
    const doc = buildEditorDoc([
      { text: 'one', start: 0, end: 3 },
      { text: 'two', start: 5, end: 8 },
    ]);
    expect(doc).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
      ],
    });
  });
});

describe('rawOffsetToPmPosition', () => {
  // Paragraph 0 "abc" → PM positions 1..4 cover 'a' 'b' 'c'.
  // Paragraph 1 "def" → PM positions 6..9.
  const paragraphs = [
    { text: 'abc', start: 0, end: 3 },
    { text: 'def', start: 5, end: 8 },
  ];

  it('maps the first char of paragraph 0 to PM position 1', () => {
    expect(rawOffsetToPmPosition(0, paragraphs)).toBe(1);
  });

  it('maps an offset within paragraph 0 to the matching PM position', () => {
    expect(rawOffsetToPmPosition(2, paragraphs)).toBe(3);
  });

  it('maps the end-of-paragraph offset to the position just past the last char', () => {
    // raw offset 3 is the position right after "abc"; PM position 4 is
    // the inline position after 'c' and before the paragraph close — a
    // legal decoration end-position.
    expect(rawOffsetToPmPosition(3, paragraphs)).toBe(4);
  });

  it('maps the first char of paragraph 1 to PM position 6', () => {
    expect(rawOffsetToPmPosition(5, paragraphs)).toBe(6);
  });

  it('returns null for an offset that lands in a paragraph separator', () => {
    // Offset 4 sits in the blank-line separator between "abc" and "def"
    // — not inside either paragraph's range, so it has no PM position.
    expect(rawOffsetToPmPosition(4, paragraphs)).toBe(null);
  });
});

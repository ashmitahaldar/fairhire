// Pure helpers for the TipTap transcript renderer. The Transcript
// component itself stays thin — paragraph splitting + offset
// translation live here so the maths is testable in isolation.
//
// Two coordinate systems are in play:
//   * raw text offset: 0..N into the transcript string. This is what
//     the server's FlagSpan rows use.
//   * ProseMirror position: 0..M into the editor document. Differs
//     from raw text offset because PM allocates positions for node
//     boundaries (entering/exiting paragraphs).
//
// We split the transcript into paragraphs once, then translate each
// FlagSpan's raw offsets into PM positions for decoration placement.

export interface ParagraphRange {
  /** trimmed paragraph text */
  text: string;
  /** raw-text offset of the first character of `text` in the transcript */
  start: number;
  /** raw-text offset one past the last character of `text` */
  end: number;
}

// Split the transcript into paragraphs, tracking each paragraph's
// absolute offset range. Tries blank-line separation first; falls back
// to single-newline if the result is one big block. Whitespace at the
// edges is trimmed but the surviving range's `start` reflects the
// post-trim position so the offsets still line up with the original
// transcript.
export function splitParagraphsWithRanges(transcript: string): ParagraphRange[] {
  const rangesFromSplitOffsets = (offs: number[]): ParagraphRange[] => {
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
  };

  const trimRange = (r: ParagraphRange): ParagraphRange | null => {
    let s = 0;
    let e = r.text.length;
    while (s < e && /\s/.test(r.text[s])) s += 1;
    while (e > s && /\s/.test(r.text[e - 1])) e -= 1;
    if (s === e) return null;
    return { text: r.text.slice(s, e), start: r.start + s, end: r.start + e };
  };

  // Try blank-line split first.
  const blankRe = /\n\s*\n/g;
  const blankOffs: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = blankRe.exec(transcript)) !== null) {
    blankOffs.push(m.index);
    blankOffs.push(m.index + m[0].length);
  }
  const blankSplit = rangesFromSplitOffsets(blankOffs)
    .map(trimRange)
    .filter((r): r is ParagraphRange => r !== null);
  if (blankSplit.length > 1) return blankSplit;

  // Fallback: single-newline split. Mirrors the Week 4 splitter so the
  // visual layout matches what shipped before TipTap.
  const nlRe = /\n/g;
  const nlOffs: number[] = [];
  while ((m = nlRe.exec(transcript)) !== null) {
    nlOffs.push(m.index);
    nlOffs.push(m.index + 1);
  }
  return rangesFromSplitOffsets(nlOffs)
    .map(trimRange)
    .filter((r): r is ParagraphRange => r !== null);
}

// Build a ProseMirror JSON document from the paragraph ranges. Each
// paragraph contributes one `paragraph` node containing a single `text`
// child (no inline marks — TipTap decorations layer styling on top).
// Empty paragraphs are skipped: ProseMirror's `paragraph` schema
// requires content unless the `Paragraph` extension is configured
// otherwise, and trimRange already drops blank ones.
export function buildEditorDoc(paragraphs: ParagraphRange[]): object {
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p.text }],
    })),
  };
}

// Translate a raw-text offset into a ProseMirror position. Each
// paragraph i occupies (text_length + 2) PM positions — 1 for entering
// the paragraph node, text_length inline positions, 1 for exiting. So
// the PM position of paragraph i's first text character is:
//   1 + Σ_{k<i}(L_k + 2)
//
// Returns null if the offset doesn't land inside any paragraph (e.g.
// it sits in a blank-line separator). Callers (decoration builders)
// drop those spans rather than place invalid decorations.
export function rawOffsetToPmPosition(
  rawOffset: number,
  paragraphs: ParagraphRange[],
): number | null {
  let pmStart = 1; // 1 is inside the first paragraph (after the entering node).
  for (const p of paragraphs) {
    // Allow exactly `p.end` here so an end-of-span offset that lands on a
    // paragraph boundary still resolves cleanly (PM lets a decoration
    // close at the position right after the last text char).
    if (rawOffset >= p.start && rawOffset <= p.end) {
      return pmStart + (rawOffset - p.start);
    }
    pmStart += p.text.length + 2;
  }
  return null;
}

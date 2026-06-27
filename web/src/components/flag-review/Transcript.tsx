import { useEffect, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import type { FlagSpanRef, FlagVM } from '../../lib/flagReview';
import {
  buildEditorDoc,
  rawOffsetToPmPosition,
  splitParagraphsWithRanges,
  type ParagraphRange,
} from './transcriptDoc';

// ── Decoration extension ──────────────────────────────────────────────────
// A single plugin owns the DecorationSet for the editor. The component
// recomputes the set whenever flag spans or interaction state changes
// and dispatches a meta transaction; the plugin's apply() picks the
// new set up.
//
// Why a plugin rather than re-creating the editor on every state
// change: the editor is heavy, decorations are cheap, and ProseMirror
// is built to swap them via meta transactions.

const SPAN_DECORATIONS_KEY = new PluginKey<DecorationSet>('fh-span-decorations');
const SPAN_DECORATIONS_META = 'fh-span-decorations:set';

const SpanDecorationsExtension = Extension.create({
  name: 'fhSpanDecorations',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: SPAN_DECORATIONS_KEY,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, old) => {
            const next = tr.getMeta(SPAN_DECORATIONS_META);
            if (next instanceof DecorationSet) return next;
            // Doc edits would normally need DecorationSet.map(tr.mapping);
            // but the editor is read-only so the doc doesn't change after
            // mount, and meta updates replace the whole set anyway.
            return old;
          },
        },
        props: {
          decorations(state) {
            return SPAN_DECORATIONS_KEY.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

// ── Span class composition ─────────────────────────────────────────────────
// Mirrors the Week 4 .fh-span / .fh-span.is-active / .is-dismissed /
// hover-thickness convention from globals.css. The same class set the
// old Transcript used, just emitted via decorations.

interface SpanState {
  isActive: boolean;
  isHovered: boolean;
  isDismissed: boolean;
}

function classForSpan({ isActive, isHovered, isDismissed }: SpanState): string {
  return [
    'fh-span',
    isActive && 'is-active',
    isDismissed && 'is-dismissed',
    isHovered && !isActive && 'is-hovered',
  ]
    .filter(Boolean)
    .join(' ');
}

// ── Decoration builders ────────────────────────────────────────────────────

interface BuildDecorationsArgs {
  paragraphs: ParagraphRange[];
  flagSpans: FlagSpanRef[];
  flagsById: Record<string, FlagVM>;
  activeFlagId: string | null;
  hoveredFlagId: string | null;
  visibleFlagIds: Set<string>;
  dismissedFlagIds: Set<string>;
}

// Returns a flat list of decorations; the caller composes them into a
// DecorationSet against the editor's live doc. Splitting it this way
// keeps the builder pure (testable without a ProseMirror doc handy)
// and lets the editor's apply() validate positions against the real
// document at dispatch time.
function buildDecorations({
  paragraphs,
  flagSpans,
  flagsById,
  activeFlagId,
  hoveredFlagId,
  visibleFlagIds,
  dismissedFlagIds,
}: BuildDecorationsArgs): Decoration[] {
  const out: Decoration[] = [];

  for (const span of flagSpans) {
    const flag = flagsById[span.flagId];
    if (!flag) continue;

    const from = rawOffsetToPmPosition(span.start, paragraphs);
    const to = rawOffsetToPmPosition(span.end, paragraphs);
    if (from === null || to === null || to <= from) continue;

    const isVisible = visibleFlagIds.has(flag.id);

    // Streaming: while the flag hasn't been revealed yet, render the
    // text as plain inline with only the data-flag-span attribute so
    // the gutter can still measure its position. Skip the className +
    // decorative superscript.
    if (!isVisible) {
      out.push(
        Decoration.inline(from, to, {
          'data-flag-span': flag.id,
          'data-pending': 'true',
        }),
      );
      continue;
    }

    const isActive = activeFlagId === flag.id;
    const isHovered = hoveredFlagId === flag.id;
    const isDismissed = dismissedFlagIds.has(flag.id);

    out.push(
      Decoration.inline(from, to, {
        class: classForSpan({ isActive, isHovered, isDismissed }),
        'data-flag-span': flag.id,
      }),
    );

    // Trailing superscript with the flag's display index. Widget
    // decoration so it's rendered AFTER the span's text but inside the
    // surrounding inline decoration. Each occurrence shows the same
    // number — Step 4 adds the "Found in N" affordance to the gutter
    // card itself.
    out.push(
      Decoration.widget(
        to,
        () => {
          const sup = document.createElement('sup');
          sup.className = 'font-mono fh-span-sup';
          sup.textContent = String(flag.index);
          sup.setAttribute('data-flag-sup', flag.id);
          return sup;
        },
        { side: 1, key: `sup-${flag.id}-${from}` },
      ),
    );
  }

  return out;
}

// ── Component ──────────────────────────────────────────────────────────────

interface TranscriptProps {
  transcriptText: string;
  flagSpans: FlagSpanRef[];
  flagsById: Record<string, FlagVM>;
  activeFlagId: string | null;
  hoveredFlagId: string | null;
  visibleFlagIds: Set<string>;
  dismissedFlagIds: Set<string>;
  onActivate: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function Transcript({
  transcriptText,
  flagSpans,
  flagsById,
  activeFlagId,
  hoveredFlagId,
  visibleFlagIds,
  dismissedFlagIds,
  onActivate,
  onHover,
}: TranscriptProps) {
  const paragraphs = useMemo(() => splitParagraphsWithRanges(transcriptText), [transcriptText]);
  const doc = useMemo(() => buildEditorDoc(paragraphs), [paragraphs]);

  const editor = useEditor(
    {
      extensions: [Document, Paragraph, Text, SpanDecorationsExtension],
      content: doc,
      editable: false,
      // Drop the default contenteditable; we don't want any keyboard
      // editing affordance even visually.
      editorProps: {
        // Matches the Week 4 wrapper styling on the old <div> renderer
        // so the visual block (serif body, spacing, line-height) is
        // unchanged after the TipTap migration.
        attributes: {
          class:
            'font-serif text-body text-ink leading-[1.6] [text-wrap:pretty] space-y-6 outline-none',
        },
      },
    },
    [doc],
  );

  // Push the current decoration set into the plugin whenever the inputs
  // change. The builder returns a flat list; the set is created here
  // against the live document so positions are validated at dispatch
  // time. Fires on every state transition (active/hover/dismiss/
  // visibility).
  useEffect(() => {
    if (!editor) return;
    const decorations = buildDecorations({
      paragraphs,
      flagSpans,
      flagsById,
      activeFlagId,
      hoveredFlagId,
      visibleFlagIds,
      dismissedFlagIds,
    });
    const set = DecorationSet.create(editor.state.doc, decorations);
    editor.view.dispatch(editor.state.tr.setMeta(SPAN_DECORATIONS_META, set));
  }, [
    editor,
    paragraphs,
    flagSpans,
    flagsById,
    activeFlagId,
    hoveredFlagId,
    visibleFlagIds,
    dismissedFlagIds,
  ]);

  // Click + hover delegation: the editor renders many spans; rather
  // than attaching listeners per decoration, walk up from event.target
  // to find the nearest [data-flag-span] (set by the decoration attrs).

  const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement | null;
    const el = t?.closest('[data-flag-span]') as HTMLElement | null;
    if (!el) return;
    const id = el.getAttribute('data-flag-span');
    if (id && el.getAttribute('data-pending') !== 'true') onActivate(id);
  };

  const handleMouseOver = (e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement | null;
    const el = t?.closest('[data-flag-span]') as HTMLElement | null;
    if (!el) return;
    const id = el.getAttribute('data-flag-span');
    if (id && el.getAttribute('data-pending') !== 'true') onHover(id);
  };

  const handleMouseOut = (e: ReactMouseEvent<HTMLDivElement>) => {
    // Only clear when we're actually leaving a span — moving between
    // characters within the same span fires mouseout but the relatedTarget
    // is still inside the [data-flag-span] element.
    const related = e.relatedTarget as HTMLElement | null;
    if (related && related.closest('[data-flag-span]')) return;
    onHover(null);
  };

  return (
    <div
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

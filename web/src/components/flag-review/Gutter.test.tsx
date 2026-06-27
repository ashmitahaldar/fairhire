import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Gutter } from './Gutter';
import type { FlagVM } from '../../lib/flagReview';

// jsdom has no ResizeObserver; marginalia's layout effect constructs one to
// re-measure on card/span resize. A no-op stub lets the marginalia path run.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

afterEach(cleanup);

function makeFlag(over: Partial<FlagVM>): FlagVM {
  return {
    id: 'fX',
    index: 1,
    flagType: 'hedging_language',
    category: 'Hedging language',
    span: 'cultural fit',
    reasoning: 'r',
    suggestion: null,
    confidence: 0.6,
    severityKey: 'med',
    severityLabel: 'Med',
    instanceCount: 1,
    dismissed: false,
    dismissReason: null,
    ...over,
  };
}

const baseProps = {
  mode: 'queue' as const, // skip marginalia's DOM-measurement layer in jsdom
  activeFlagId: null,
  hoveredFlagId: null,
  expandedId: null,
  dismissReasons: {},
  activeInstanceByFlag: {},
  onActivate: vi.fn(),
  onHover: vi.fn(),
  onDismiss: vi.fn(),
  onUndo: vi.fn(),
  onCycleInstance: vi.fn(),
};

describe('Gutter — dismissed footer grouping', () => {
  it('does not render the footer when no flags are dismissed', () => {
    const flags = [makeFlag({ id: 'a' }), makeFlag({ id: 'b' })];
    render(<Gutter {...baseProps} flags={flags} dismissedFlagIds={new Set()} />);
    expect(screen.queryByRole('button', { name: /dismissed/i })).toBeNull();
  });

  it('renders a "{N} dismissed" toggle and hides the cards by default', () => {
    const flags = [
      makeFlag({ id: 'a', span: 'live span' }),
      makeFlag({ id: 'b', span: 'dismissed span 1' }),
      makeFlag({ id: 'c', span: 'dismissed span 2' }),
    ];
    render(
      <Gutter
        {...baseProps}
        flags={flags}
        dismissedFlagIds={new Set(['b', 'c'])}
        dismissReasons={{ b: 'Acknowledged', c: 'Other reason' }}
      />,
    );

    const toggle = screen.getByRole('button', { name: /2 dismissed/i });
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    // Cards are not in the DOM until the toggle is opened.
    expect(screen.queryByText(/dismissed span 1/i)).toBeNull();
  });

  it('expands inline and renders the dismissed cards on click', () => {
    const flags = [
      makeFlag({ id: 'a', span: 'live span' }),
      makeFlag({ id: 'b', span: 'dismissed span 1' }),
    ];
    render(
      <Gutter
        {...baseProps}
        flags={flags}
        dismissedFlagIds={new Set(['b'])}
        dismissReasons={{ b: 'Acknowledged' }}
      />,
    );

    const toggle = screen.getByRole('button', { name: /1 dismissed/i });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/dismissed span 1/i)).toBeTruthy();
    // The reason rendered next to the dismissed strip.
    expect(screen.getByText(/Acknowledged/i)).toBeTruthy();
  });

  it('reveals span-less flags in marginalia as a gutter-only fallback', () => {
    // A flag whose excerpt isn't a verbatim transcript match has zero spans
    // (instanceCount 0), so it can't anchor to the transcript. Pre-fix the
    // marginalia layout dropped these from measurement, leaving isMeasured
    // false and every card stuck at opacity 0 — an empty-looking gutter even
    // though the flags existed. They must now render visibly.
    const flags = [
      makeFlag({ id: 'a', span: 'paraphrased flag one', instanceCount: 0 }),
      makeFlag({ id: 'b', span: 'paraphrased flag two', instanceCount: 0 }),
    ];
    const { container } = render(
      <Gutter {...baseProps} mode="marginalia" flags={flags} dismissedFlagIds={new Set()} />,
    );

    expect(screen.getByText(/paraphrased flag one/i)).toBeTruthy();
    expect(screen.getByText(/paraphrased flag two/i)).toBeTruthy();

    // The card wrappers fade in only once isMeasured flips true; assert
    // they're at full opacity. The marginalia container is the outermost
    // div.relative (FlagCard also uses .relative, nested deeper); its direct
    // children are the per-flag wrappers carrying the opacity style.
    const marginaliaRoot = container.querySelector<HTMLElement>('div.relative');
    const wrappers = Array.from(marginaliaRoot?.children ?? []) as HTMLElement[];
    expect(wrappers.length).toBe(2);
    wrappers.forEach((w) => expect(w.style.opacity).toBe('1'));
  });

  it('does not include dismissed cards in the live queue list', () => {
    // The Queue header still tallies tier counts on the LIVE list — a
    // dismissed High flag should not show up in the High count.
    const flags = [
      makeFlag({ id: 'a', severityKey: 'high', severityLabel: 'High', confidence: 0.9 }),
      makeFlag({ id: 'b', severityKey: 'high', severityLabel: 'High', confidence: 0.9 }),
    ];
    render(
      <Gutter
        {...baseProps}
        flags={flags}
        dismissedFlagIds={new Set(['b'])}
        dismissReasons={{}}
      />,
    );
    // Tier count text is "High · 1" because b is dismissed.
    expect(screen.getByText(/· 1/)).toBeTruthy();
  });
});

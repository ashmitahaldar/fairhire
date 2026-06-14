import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Gutter } from './Gutter';
import type { FlagVM } from '../../lib/flagReview';

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

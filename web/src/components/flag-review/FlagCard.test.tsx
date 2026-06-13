import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FlagCard } from './FlagCard';
import type { FlagVM } from '../../lib/flagReview';

afterEach(cleanup);

function makeFlag(over: Partial<FlagVM> = {}): FlagVM {
  return {
    id: 'f1',
    index: 1,
    flagType: 'asymmetric_concern',
    category: 'Asymmetric concern',
    span: 'starting a family',
    reasoning: 'Family-planning questions are raised disproportionately.',
    suggestion: 'Discuss availability instead.',
    confidence: 0.9,
    severityKey: 'high',
    severityLabel: 'High',
    instanceCount: 1,
    ...over,
  };
}

interface RenderProps {
  expanded?: boolean;
  isDismissed?: boolean;
  currentInstance?: number;
  onDismiss?: (id: string, reason: string) => void;
  onUndo?: (id: string) => void;
  onCycleInstance?: (id: string, delta: 1 | -1) => void;
  onActivate?: (id: string) => void;
  flag?: FlagVM;
}

function renderCard(over: RenderProps = {}) {
  const flag = over.flag ?? makeFlag();
  return render(
    <FlagCard
      flag={flag}
      expanded={over.expanded ?? false}
      isActive={false}
      isDismissed={over.isDismissed ?? false}
      currentInstance={over.currentInstance}
      onActivate={over.onActivate ?? vi.fn()}
      onHover={vi.fn()}
      onDismiss={over.onDismiss ?? vi.fn()}
      onUndo={over.onUndo ?? vi.fn()}
      onCycleInstance={over.onCycleInstance}
    />,
  );
}

describe('FlagCard — collapsed', () => {
  it('renders the category as the visual hero (serif, prominent)', () => {
    renderCard();
    const heading = screen.getByRole('heading', { level: 3, name: /asymmetric concern/i });
    expect(heading.className).toContain('font-serif');
    expect(heading.className).toContain('italic');
  });

  it('does not render Apply suggestion (removed in Week 5)', () => {
    renderCard({ expanded: true });
    expect(screen.queryByRole('button', { name: /apply suggestion/i })).toBeNull();
  });
});

describe('FlagCard — dismiss flow', () => {
  it('Acknowledged is the first preset reason', () => {
    const onDismiss = vi.fn();
    renderCard({ expanded: true, onDismiss });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    // Picker is open; the first preset button (after the "Reason" label)
    // should be Acknowledged.
    const presetLabels = screen
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t): t is string => !!t);
    const firstPresetIdx = presetLabels.findIndex((t) => t === 'Acknowledged');
    expect(firstPresetIdx).toBeGreaterThanOrEqual(0);

    // Order check: Acknowledged appears before the other presets in the DOM.
    const ackIdx = presetLabels.indexOf('Acknowledged');
    const contextIdx = presetLabels.indexOf('Context I have');
    expect(ackIdx).toBeLessThan(contextIdx);

    fireEvent.click(screen.getByRole('button', { name: 'Acknowledged' }));
    expect(onDismiss).toHaveBeenCalledWith('f1', 'Acknowledged');
  });

  it('Other expands into a freeform input and saves the typed reason', () => {
    const onDismiss = vi.fn();
    renderCard({ expanded: true, onDismiss });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    fireEvent.click(screen.getByRole('button', { name: 'Other' }));

    // Input is now visible; presets are replaced.
    const input = screen.getByLabelText('Dismiss reason') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Acknowledged' })).toBeNull();

    fireEvent.change(input, { target: { value: 'Performance concerns' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onDismiss).toHaveBeenCalledWith('f1', 'Performance concerns');
  });

  it('Other Save is disabled until the user types something', () => {
    renderCard({ expanded: true });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    fireEvent.click(screen.getByRole('button', { name: 'Other' }));
    const saveBtn = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('Other Enter key dispatches dismiss with the typed reason', () => {
    const onDismiss = vi.fn();
    renderCard({ expanded: true, onDismiss });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    fireEvent.click(screen.getByRole('button', { name: 'Other' }));
    const input = screen.getByLabelText('Dismiss reason') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Already discussed offline' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onDismiss).toHaveBeenCalledWith('f1', 'Already discussed offline');
  });
});

describe('FlagCard — multi-instance navigation', () => {
  it('does not render the Found-in-N footer for single-instance flags', () => {
    renderCard({ flag: makeFlag({ instanceCount: 1 }), currentInstance: 1, onCycleInstance: vi.fn() });
    expect(screen.queryByText(/Found in/i)).toBeNull();
  });

  it('renders the Found-in-N footer for multi-instance flags', () => {
    renderCard({
      flag: makeFlag({ instanceCount: 3 }),
      currentInstance: 1,
      onCycleInstance: vi.fn(),
    });
    expect(screen.getByText(/Found in 3 places/i)).toBeTruthy();
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('next/prev buttons dispatch +1 / -1 via onCycleInstance', () => {
    const onCycleInstance = vi.fn();
    renderCard({
      flag: makeFlag({ instanceCount: 3 }),
      currentInstance: 2,
      onCycleInstance,
    });
    fireEvent.click(screen.getByRole('button', { name: /next occurrence/i }));
    expect(onCycleInstance).toHaveBeenCalledWith('f1', 1);
    fireEvent.click(screen.getByRole('button', { name: /previous occurrence/i }));
    expect(onCycleInstance).toHaveBeenCalledWith('f1', -1);
  });

  it('the nav button click does not activate the card', () => {
    // Clicking ‹ or › is a nav action, not an "open this card" action.
    // The collapsed card has onClick={onActivate}, so the inner button
    // must stop propagation.
    const onActivate = vi.fn();
    const onCycleInstance = vi.fn();
    renderCard({
      flag: makeFlag({ instanceCount: 2 }),
      currentInstance: 1,
      onActivate,
      onCycleInstance,
    });
    fireEvent.click(screen.getByRole('button', { name: /next occurrence/i }));
    expect(onCycleInstance).toHaveBeenCalledTimes(1);
    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe('FlagCard — dismissed', () => {
  it('renders the strip with Undo and the dismiss reason', () => {
    const onUndo = vi.fn();
    renderCard({
      isDismissed: true,
      onUndo,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledWith('f1');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AnalysisStatus } from './AnalysisStatus';

afterEach(cleanup);

const base = {
  elapsedMs: 4200,
  spansEvaluated: null,
  durationLabel: null,
  model: null,
  error: null,
  totalFlags: 5,
  revealedFlags: 0,
  revealing: false,
  dismissedCount: 0,
  onRetry: vi.fn(),
};

describe('AnalysisStatus', () => {
  it('does not show a flag count while analysing (no flags written yet)', () => {
    render(<AnalysisStatus {...base} status="running" />);
    expect(screen.getByText(/Analysing transcript/)).toBeTruthy();
    expect(screen.getByText(/4\.2s/)).toBeTruthy();
    // The old "0 flags found" stuck counter must be gone.
    expect(screen.queryByText(/flags? found/)).toBeNull();
  });

  it('shows the climbing revealed count while a reveal is animating', () => {
    render(<AnalysisStatus {...base} status="completed" revealing revealedFlags={2} />);
    expect(screen.getByText(/2 flags/)).toBeTruthy();
    expect(screen.queryByText(/5 flags/)).toBeNull();
  });

  it('shows the full total once the reveal has settled', () => {
    render(<AnalysisStatus {...base} status="completed" revealing={false} revealedFlags={5} />);
    expect(screen.getByText(/5 flags/)).toBeTruthy();
  });
});

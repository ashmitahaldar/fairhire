import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Auth + fetch are mocked at the module / global level; the test only
// asserts on the button trio's labels and the dispatched outcome.
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: async () => 'test-token' }),
}));

import { DecisionPanel } from './DecisionPanel';
import type { DecisionVM } from '../../lib/flagReview';

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: 'd1', outcome: 'hired' }),
  } as unknown as Response));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  cleanup();
});

function renderPanel(over: { meetingType: 'hiring' | 'promotion'; decision?: DecisionVM }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DecisionPanel
        meetingId="m1"
        meetingType={over.meetingType}
        candidateId="c1"
        decision={over.decision ?? { id: null, outcome: 'in_progress' }}
      />
    </QueryClientProvider>,
  );
}

describe('DecisionPanel — mode-aware button trio', () => {
  it('renders Hired / Pending / Declined in hiring mode', () => {
    renderPanel({ meetingType: 'hiring' });
    expect(screen.getByRole('radio', { name: 'Hired' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Pending' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Declined' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Promoted' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Held' })).toBeNull();
  });

  it('renders Promoted / Pending / Held in promotion mode', () => {
    renderPanel({ meetingType: 'promotion' });
    expect(screen.getByRole('radio', { name: 'Promoted' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Pending' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Held' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Hired' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Declined' })).toBeNull();
  });

  it('marks the matching button aria-checked when a decision exists', () => {
    renderPanel({
      meetingType: 'promotion',
      decision: { id: 'd1', outcome: 'promoted' },
    });
    const promoted = screen.getByRole('radio', { name: 'Promoted' });
    expect(promoted.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Pending' }).getAttribute('aria-checked')).toBe('false');
  });

  it('POSTs the promotion-only outcome when no decision exists yet', async () => {
    renderPanel({ meetingType: 'promotion' });
    fireEvent.click(screen.getByRole('radio', { name: 'Held' }));

    // Allow the mutation to flush.
    await vi.waitFor(() => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/decisions');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.outcome).toBe('held');
  });
});

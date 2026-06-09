import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateSpy }));
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => ({ getToken: async () => 'test-token' }) }));

import MeetingUpload from './MeetingUpload';

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MeetingUpload />
    </QueryClientProvider>
  );
}

const fetchMock = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
const postCall = () =>
  fetchMock().mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST');

// Capture the real fetch (jsdom-installed) so afterEach can put it back —
// without this the stub would leak into other test files and create
// order-dependent failures the first time another suite assumes a real fetch.
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  navigateSpy.mockClear();
  originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/candidates')) {
      return {
        ok: true,
        json: async () => [{ id: 'c1', name: 'Ahmad Faris', roleAppliedFor: 'Analyst' }],
      } as unknown as Response;
    }
    if (url.endsWith('/meetings') && init?.method === 'POST') {
      return { ok: true, json: async () => ({ id: 'm1' }) } as unknown as Response;
    }
    throw new Error(`unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('MeetingUpload', () => {
  it('submits the right payload and navigates to the new meeting', async () => {
    renderForm();
    await screen.findByText('Ahmad Faris'); // candidate list loaded

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Panel debrief' } });
    fireEvent.change(screen.getByLabelText('Transcript'), {
      target: { value: 'A genuine debrief transcript.' },
    });
    // The candidate list is now a listbox of role="option" rows (no
    // visible checkbox) — click the row itself to toggle selection.
    fireEvent.click(screen.getByRole('option', { name: /Ahmad Faris/ }));
    fireEvent.click(screen.getByRole('button', { name: /upload & analyse/i }));

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/meetings/m1'));

    const call = postCall();
    expect(call).toBeTruthy();
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body.title).toBe('Panel debrief');
    expect(body.transcript).toBe('A genuine debrief transcript.');
    expect(body.candidateIds).toEqual(['c1']);
  });

  it('blocks submit and shows an error when required fields are missing', async () => {
    renderForm();
    await screen.findByText('Ahmad Faris');

    fireEvent.click(screen.getByRole('button', { name: /upload & analyse/i }));

    expect(await screen.findByText('Add a title.')).toBeTruthy();
    expect(postCall()).toBeUndefined();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: async () => 'test-token' }),
}));

import Candidates from './Candidates';
import type { CandidateListItem } from '../lib/candidatesApi';

function row(
  overrides: Partial<CandidateListItem> & Pick<CandidateListItem, 'id' | 'name'>,
): CandidateListItem {
  return {
    roleAppliedFor: 'Analyst',
    createdAt: '2026-01-01T00:00:00Z',
    demographics: null,
    meetingCount: 0,
    lastDecisionOutcome: null,
    lastDecisionMeetingType: null,
    canModify: false,
    flagCount: { total: 0, own: 0 },
    ...overrides,
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Candidates />
    </QueryClientProvider>
  );
}

let originalFetch: typeof globalThis.fetch;

function mockCandidates(list: CandidateListItem[]) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/candidates')) {
      return { ok: true, status: 200, json: async () => list } as unknown as Response;
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Candidates page', () => {
  it('renders the list with the enriched fields', async () => {
    mockCandidates([
      row({
        id: 'c1',
        name: 'Ahmad Faris',
        roleAppliedFor: 'Senior Analyst',
        meetingCount: 3,
        lastDecisionOutcome: 'hired',
        demographics: {
          race: 'malay',
          gender: 'male',
          ageBand: null,
          nationalityStatus: null,
          firstLanguage: null,
          yearsInSingapore: null,
          university: null,
          major: null,
          previousEmployer: null,
          yearsExperience: null,
          currentBase: null,
        },
        canModify: true,
      }),
    ]);

    renderPage();

    expect(await screen.findByText('Ahmad Faris')).toBeTruthy();
    expect(screen.getByText('Senior Analyst')).toBeTruthy();
    // demographics chip combines race + gender abbreviations
    expect(screen.getByText('Malay · M')).toBeTruthy();
    expect(screen.getByText('Hired')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows the org-wide flag count, with the by-you split only when others contributed', async () => {
    mockCandidates([
      row({ id: 'c1', name: 'Ahmad Faris', flagCount: { total: 12, own: 3 } }),
      row({ id: 'c2', name: 'Siti Nurhaliza', flagCount: { total: 4, own: 4 } }),
    ]);

    renderPage();

    await screen.findByText('Ahmad Faris');
    // c1: 9 of 12 flags came from other managers — surface the split.
    expect(screen.getByText(/3 by you/)).toBeTruthy();
    // c2: every flag is the caller's own — show just the total, no split.
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('labels a promotion outcome as "Promoted" (not blank) using the decision meeting mode', async () => {
    // Regression: the row used the hiring-only label map, so a promotion
    // decision (promoted/held) rendered an empty outcome cell.
    mockCandidates([
      row({
        id: 'c1',
        name: 'Priya Menon',
        lastDecisionOutcome: 'promoted',
        lastDecisionMeetingType: 'promotion',
      }),
    ]);

    renderPage();

    expect(await screen.findByText('Priya Menon')).toBeTruthy();
    expect(screen.getByText('Promoted')).toBeTruthy();
  });

  it('disables edit + delete buttons when canModify is false', async () => {
    mockCandidates([
      row({ id: 'c1', name: 'Hannah Lim', canModify: false }),
    ]);

    renderPage();

    await screen.findByText('Hannah Lim');
    const edit = screen.getByRole('button', { name: /^Edit$/ });
    const del = screen.getByRole('button', { name: /^Delete$/ });
    expect((edit as HTMLButtonElement).disabled).toBe(true);
    expect((del as HTMLButtonElement).disabled).toBe(true);
  });

  it('filters the list by search input', async () => {
    mockCandidates([
      row({ id: 'c1', name: 'Ahmad Faris', roleAppliedFor: 'Analyst' }),
      row({ id: 'c2', name: 'Siti Nurhaliza', roleAppliedFor: 'Director' }),
    ]);

    renderPage();

    await screen.findByText('Ahmad Faris');
    fireEvent.change(screen.getByLabelText('Search candidates'), {
      target: { value: 'siti' },
    });

    expect(screen.queryByText('Ahmad Faris')).toBeNull();
    expect(screen.getByText('Siti Nurhaliza')).toBeTruthy();
  });

  it('opens the modal in create mode when "Add candidate" is clicked', async () => {
    mockCandidates([]);

    renderPage();

    // empty-state's Add button is the only one until we click it
    await screen.findByText(/No candidates on file yet/);
    fireEvent.click(screen.getByRole('button', { name: /Add candidate →/ }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('New candidate')).toBeTruthy();
  });
});

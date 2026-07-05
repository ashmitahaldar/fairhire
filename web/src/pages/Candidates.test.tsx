import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: async () => 'test-token' }),
}));

import Candidates from './Candidates';
import type { CandidateFlag, CandidateListItem } from '../lib/candidatesApi';
import { ManagerContext, type ManagerProfile } from '../lib/ManagerContext';
import type { Role } from '@fairhire/shared';

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

function renderPage(role: Role = 'manager') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const profile: ManagerProfile = {
    id: 'm-self',
    name: 'Test Manager',
    email: 'test@example.com',
    role,
    orgId: 'org-1',
    deptId: 'dept-1',
  };
  return render(
    <QueryClientProvider client={qc}>
      <ManagerContext.Provider value={profile}>
        <MemoryRouter>
          <Candidates />
        </MemoryRouter>
      </ManagerContext.Provider>
    </QueryClientProvider>
  );
}

let originalFetch: typeof globalThis.fetch;

// Mocks GET /candidates and GET /candidates/:id/flags (the detail dialog).
// flagsById defaults each candidate's own-flags to an empty list.
function mockCandidates(
  list: CandidateListItem[],
  flagsById: Record<string, CandidateFlag[]> = {},
) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const flagsMatch = url.match(/\/candidates\/([^/]+)\/flags/);
    if (flagsMatch) {
      const id = flagsMatch[1]!;
      return {
        ok: true,
        status: 200,
        json: async () => flagsById[id] ?? [],
      } as unknown as Response;
    }
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

  it('opens the detail dialog on name click, showing the org-wide split and your own flags', async () => {
    mockCandidates(
      [row({ id: 'c1', name: 'Ahmad Faris', flagCount: { total: 12, own: 2 } })],
      {
        c1: [
          {
            id: 'f1',
            flagType: 'asymmetric_concern',
            excerpt: 'accent may be a concern',
            reasoning: 'A concern comparable candidates did not get.',
            confidenceScore: 0.9,
            dismissed: false,
            meetingId: 'm1',
            meetingTitle: 'Debrief — Ahmad',
            meetingDate: '2026-01-15T00:00:00Z',
            meetingType: 'hiring',
          },
        ],
      },
    );

    renderPage();

    fireEvent.click(await screen.findByText('Ahmad Faris'));

    const dialog = await screen.findByRole('dialog');
    // Org-wide count keeps the cross-manager framing (12 total, 2 by you).
    expect(within(dialog).getByText(/including other managers/)).toBeTruthy();
    // The caller's OWN flag content is shown in full — type label + excerpt.
    expect(await within(dialog).findByText('Asymmetric concern')).toBeTruthy();
    expect(within(dialog).getByText(/accent may be a concern/)).toBeTruthy();
    // Link into the source debrief.
    expect(within(dialog).getByRole('link', { name: /Open debrief/ })).toBeTruthy();
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

  it('replaces the row actions with "View only" for HR admins', async () => {
    // HR never interviews, so canModify is false on every row. Rather than show
    // uniformly greyed Edit/Delete (which reads as broken), HR sees "View only".
    mockCandidates([row({ id: 'c1', name: 'Hannah Lim', canModify: false })]);

    renderPage('hr_admin');

    await screen.findByText('Hannah Lim');
    expect(screen.getByText('View only')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Edit$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete$/ })).toBeNull();
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

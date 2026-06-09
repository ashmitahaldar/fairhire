import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCandidateInput,
  DemographicsInput,
  UpdateCandidateInput,
} from '@fairhire/shared';
import { apiFetch } from './api';

// Data hooks for the /candidates page (full CRUD with demographics).
// The upload form keeps its narrower useCandidates/useCreateCandidate
// pair in uploadApi.ts; both query the same endpoint and share the
// ['candidates'] cache key, so a candidate added or edited on either
// surface shows up on the other without a refetch round-trip.

// Enriched shape returned by GET /candidates. demographics may be null
// when the candidate has no row yet (lazy create on first PATCH that
// touches a demographics field). canModify is per-row — true when the
// caller has at least one MeetingCandidate link to this candidate, which
// is what the api's hybrid-access rule gates writes on.
export interface CandidateListItem {
  id: string;
  name: string;
  roleAppliedFor: string;
  createdAt: string;
  demographics: DemographicsInput | null;
  meetingCount: number;
  lastDecisionOutcome: 'hired' | 'rejected' | 'in_progress' | null;
  canModify: boolean;
}

export function useCandidatesList() {
  const { getToken } = useAuth();
  return useQuery<CandidateListItem[]>({
    queryKey: ['candidates'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<CandidateListItem[]>('/candidates', token);
    },
  });
}

// Create with optional nested demographics. Distinct from uploadApi's
// useCreateCandidate (which only accepts name + role) so the upload-page
// inline form keeps its narrow contract and the candidates-page modal
// can carry the full demographics payload in one POST.
export function useCreateCandidateFull() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation<CandidateListItem, Error, CreateCandidateInput>({
    mutationFn: async (input) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<CandidateListItem>('/candidates', token, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['candidates'] });
      // Adding a candidate doesn't directly change any Mirror aggregate
      // (no meetings/flags/decisions yet), but candidate metadata feeds
      // pipeline composition in Phase C — invalidate so the next mirror
      // view picks them up.
      void qc.invalidateQueries({ queryKey: ['mirror'] });
    },
  });
}

interface UpdateArgs {
  id: string;
  input: UpdateCandidateInput;
}

export function useUpdateCandidate() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation<CandidateListItem, Error, UpdateArgs>({
    mutationFn: async ({ id, input }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<CandidateListItem>(`/candidates/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['candidates'] });
      // Edits to demographics/role change pipeline composition (Phase C).
      void qc.invalidateQueries({ queryKey: ['mirror'] });
    },
  });
}

// Soft delete — server sets deletedAt rather than removing the row, so
// linked meetings/flags/decisions stay intact. Server returns 204; the
// shared apiFetch helper returns undefined for that status.
export function useSoftDeleteCandidate() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await apiFetch<void>(`/candidates/${id}`, token, { method: 'DELETE' });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['candidates'] });
      // A soft-deleted candidate disappears from pipeline counts even
      // though their meetings/flags remain in the manager's history.
      void qc.invalidateQueries({ queryKey: ['mirror'] });
    },
  });
}

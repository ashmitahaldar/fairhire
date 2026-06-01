import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { CandidateOption, CreateMeetingInput } from './upload';

// Org candidate list for the upload form's picker.
export function useCandidates() {
  const { getToken } = useAuth();
  return useQuery<CandidateOption[]>({
    queryKey: ['candidates'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<CandidateOption[]>('/candidates', token);
    },
  });
}

export interface CreateCandidateInput {
  name: string;
  roleAppliedFor: string;
}

// Creates a candidate in the manager's org. On success the candidates query
// is invalidated so the upload form's picker shows the new row immediately.
// The caller receives the created candidate (with id) and can auto-select it.
export function useCreateCandidate() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation<CandidateOption, Error, CreateCandidateInput>({
    mutationFn: async (input) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<CandidateOption>('/candidates', token, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['candidates'] });
    },
  });
}

// Creates a meeting (which schedules analysis server-side); returns its id.
export function useCreateMeeting() {
  const { getToken } = useAuth();
  return useMutation<{ id: string }, Error, CreateMeetingInput>({
    mutationFn: async (input) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<{ id: string }>('/meetings', token, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
  });
}

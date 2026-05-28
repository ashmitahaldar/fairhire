import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery } from '@tanstack/react-query';
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

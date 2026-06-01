import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';
import { adaptMeeting, type MeetingResponse } from './dataAdapter';
import type { MeetingVM } from './flagReview';

// Fetches a meeting + its latest analysis run and projects it to the view-model.
// Polls every 1500ms while the run is still pending/running; stops on terminal.
export function useAnalysisRun(meetingId: string) {
  const { getToken } = useAuth();

  return useQuery<MeetingVM>({
    queryKey: ['meeting', meetingId],
    enabled: meetingId.length > 0,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await apiFetch<MeetingResponse>(`/meetings/${meetingId}`, token);
      return adaptMeeting(res);
    },
    refetchInterval: (query) => {
      const status = query.state.data?.analysis.status;
      return status === 'pending' || status === 'running' ? 1500 : false;
    },
  });
}

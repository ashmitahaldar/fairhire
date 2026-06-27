import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnalysisStatus } from '@fairhire/shared';
import { apiFetch } from './api';
import { adaptMeeting, type MeetingResponse } from './dataAdapter';
import type { MeetingVM } from './flagReview';

// Fetches a meeting + its latest analysis run and projects it to the view-model.
// Polls every 1500ms while the run is still pending/running; stops on terminal.
export function useAnalysisRun(meetingId: string) {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<MeetingVM>({
    queryKey: ['meeting', meetingId],
    enabled: meetingId.length > 0,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await apiFetch<MeetingResponse>(`/meetings/${meetingId}`, token);
      return adaptMeeting(res);
    },
    refetchInterval: (q) => {
      const status = q.state.data?.analysis.status;
      return status === 'pending' || status === 'running' ? 1500 : false;
    },
  });

  // When a run finishes (transition into 'completed'), the meeting's flag set
  // has changed, so the Mirror's cross-meeting aggregates are stale — refresh
  // them. Keyed off the completed *transition* rather than the re-run POST
  // (which resolves while the run is still pending and flags are mid-wipe, so
  // invalidating there would snapshot an empty interim state). Covers both the
  // initial analysis and re-runs; if the Mirror isn't mounted the invalidation
  // is a no-op until it's next opened.
  const status = query.data?.analysis.status;
  const prevStatus = useRef<AnalysisStatus | null>(null);
  useEffect(() => {
    const was = prevStatus.current;
    if (status) prevStatus.current = status;
    if (status === 'completed' && (was === 'pending' || was === 'running')) {
      void qc.invalidateQueries({ queryKey: ['mirror'] });
    }
  }, [status, qc]);

  return query;
}

// POSTs to /meetings/:id/analyse, which wipes existing flags server-side
// and creates a new pending AnalysisRun. The meeting query is invalidated
// on success so the polling status pickup is immediate. Used by the
// Re-run button on Flag Review and by the failed-state Retry path.
//
// Caller is responsible for surfacing the confirm-and-discard modal
// when dismissals exist — this hook just fires the request.
export function useRerunAnalysis(meetingId: string) {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation<{ runId: string }, Error, void>({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<{ runId: string }>(`/meetings/${meetingId}/analyse`, token, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['meeting', meetingId] });
    },
  });
}

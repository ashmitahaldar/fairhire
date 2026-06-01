import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

// Shape of one row in GET /meetings — matches the api include
// (candidates + demographics + _count.flags + latest analysisRun status).
// Trimmed to what the Dashboard list renders; the flag-review screen has
// its own richer adapter on GET /:id.

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface MeetingListItem {
  id: string;
  title: string;
  date: string; // ISO
  transcriptFilename?: string | null;
  candidates: Array<{
    candidate: {
      id: string;
      name: string;
      roleAppliedFor: string;
    };
  }>;
  _count: { flags: number };
  analysisRuns: Array<{ status: AnalysisStatus }>;
}

export function useMeetings() {
  const { getToken } = useAuth();
  return useQuery<MeetingListItem[]>({
    queryKey: ['meetings'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<MeetingListItem[]>('/meetings', token);
    },
  });
}

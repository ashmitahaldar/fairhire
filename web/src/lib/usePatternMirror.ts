import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import type { MeetingType, MirrorData, MirrorPeriod } from '@fairhire/shared';
import { apiFetch } from './api';

// TanStack Query hook for the Pattern Mirror composite endpoint. Query
// key includes the period AND the meetingType mode so each combination
// caches independently — switching modes is a fresh fetch but the
// previous mode stays warm. Mutation sites that change the underlying
// signals (candidate / flag / decision writes) invalidate ['mirror']
// across all combinations so the next visit refetches.

export function usePatternMirror(period: MirrorPeriod, meetingType: MeetingType = 'hiring') {
  const { getToken } = useAuth();
  return useQuery<MirrorData>({
    queryKey: ['mirror', period, meetingType],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<MirrorData>(
        `/mirror?period=${period}&meetingType=${meetingType}`,
        token,
      );
    },
  });
}

import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import type { MirrorData, MirrorPeriod } from '@fairhire/shared';
import { apiFetch } from './api';

// TanStack Query hook for the Pattern Mirror composite endpoint. Query
// key includes the period so switching periods is a fresh fetch but
// previously-fetched periods stay cached for the session. Mutation sites
// that change the underlying signals (candidate writes today, flag and
// decision writes when those hooks land) invalidate ['mirror'] so the
// next visit refetches.

export function usePatternMirror(period: MirrorPeriod) {
  const { getToken } = useAuth();
  return useQuery<MirrorData>({
    queryKey: ['mirror', period],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<MirrorData>(`/mirror?period=${period}`, token);
    },
  });
}

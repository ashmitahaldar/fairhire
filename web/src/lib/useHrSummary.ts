import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import type {
  HrDecisionsResponse,
  HrDemographicsResponse,
  HrFlagsResponse,
  MirrorPeriod,
} from '@fairhire/shared';
import { apiFetch } from './api';

// TanStack Query hooks for the HR org-level aggregate endpoints. One hook per
// surface (flags / decisions / demographics); each caches independently per
// period. Payloads are small org-level aggregates, so the HR screen fetches
// all three on mount and reads whichever the active tab needs.

export function useHrFlags(period: MirrorPeriod) {
  const { getToken } = useAuth();
  return useQuery<HrFlagsResponse>({
    queryKey: ['hr', 'flags', period],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<HrFlagsResponse>(`/hr/flags?period=${period}`, token);
    },
  });
}

export function useHrDecisions(period: MirrorPeriod) {
  const { getToken } = useAuth();
  return useQuery<HrDecisionsResponse>({
    queryKey: ['hr', 'decisions', period],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<HrDecisionsResponse>(`/hr/decisions?period=${period}`, token);
    },
  });
}

export function useHrDemographics(period: MirrorPeriod) {
  const { getToken } = useAuth();
  return useQuery<HrDemographicsResponse>({
    queryKey: ['hr', 'demographics', period],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<HrDemographicsResponse>(`/hr/demographics?period=${period}`, token);
    },
  });
}

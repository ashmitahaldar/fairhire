import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { ManagerProfile } from './ManagerContext';

// Hooks backing the account page's "Workspace" tab: the org's division list
// and the self-service division change. Identity (name/email/password) stays
// with Clerk; these cover the FairHire-specific fields.

export interface DepartmentOption {
  id: string;
  name: string;
}

export function useDepartments() {
  const { getToken } = useAuth();
  return useQuery<DepartmentOption[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<DepartmentOption[]>('/auth/departments', token);
    },
  });
}

export function useUpdateDepartment() {
  const { getToken } = useAuth();
  return useMutation<ManagerProfile, Error, string>({
    mutationFn: async (deptId: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return apiFetch<ManagerProfile>('/auth/me', token, {
        method: 'PATCH',
        body: JSON.stringify({ deptId }),
      });
    },
  });
}

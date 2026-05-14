import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { apiFetch } from './api';
import type { Role } from '@fairhire/shared';

interface ManagerProfile {
  role: Role;
}

export function useManagerRole() {
  const { getToken, isLoaded: authLoaded } = useAuth();
  const [managerRole, setManagerRole] = useState<Role | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!authLoaded) return;
    getToken()
      .then((token) => {
        if (!token) return;
        return apiFetch<ManagerProfile>('/auth/me', token);
      })
      .then((profile) => {
        if (profile) setManagerRole(profile.role);
      })
      .finally(() => setIsLoaded(true));
  }, [authLoaded, getToken]);

  return { managerRole, isLoaded };
}

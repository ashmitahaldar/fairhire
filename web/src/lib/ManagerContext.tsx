import { createContext, useContext } from 'react';
import type { Role } from '@fairhire/shared';

export interface ManagerProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string;
  deptId: string;
}

export const ManagerContext = createContext<ManagerProfile | null>(null);

// Applies an in-session patch to the cached profile (e.g. after the account
// page changes the manager's division) so the change is reflected immediately
// without a full reload. Kept as a separate context so the many existing
// useManager() consumers are untouched.
export type ManagerUpdater = (patch: Partial<ManagerProfile>) => void;
export const ManagerUpdateContext = createContext<ManagerUpdater | null>(null);

export function useManager(): ManagerProfile {
  const ctx = useContext(ManagerContext);
  if (!ctx) throw new Error('useManager must be used inside AuthGuard');
  return ctx;
}

export function useUpdateManager(): ManagerUpdater {
  const ctx = useContext(ManagerUpdateContext);
  if (!ctx) throw new Error('useUpdateManager must be used inside AuthGuard');
  return ctx;
}

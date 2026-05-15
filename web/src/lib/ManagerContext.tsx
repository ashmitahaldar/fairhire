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

export function useManager(): ManagerProfile {
  const ctx = useContext(ManagerContext);
  if (!ctx) throw new Error('useManager must be used inside AuthGuard');
  return ctx;
}

import { Outlet, Navigate } from 'react-router-dom';
import { useManager } from '../lib/ManagerContext';
import type { Role } from '@fairhire/shared';

interface RoleGuardProps {
  role: Role;
}

export function RoleGuard({ role }: RoleGuardProps) {
  const { role: managerRole } = useManager();
  if (managerRole !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}

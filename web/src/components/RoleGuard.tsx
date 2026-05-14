import { Outlet, Navigate } from 'react-router-dom';
import { useManagerRole } from '../lib/useManagerRole';
import type { Role } from '@fairhire/shared';

interface RoleGuardProps {
  role: Role;
}

export function RoleGuard({ role }: RoleGuardProps) {
  const { managerRole, isLoaded } = useManagerRole();
  if (!isLoaded) return <div>Loading...</div>;
  if (managerRole !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}

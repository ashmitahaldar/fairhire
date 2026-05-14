import { useAuth, SignIn } from '@clerk/clerk-react';
import { Outlet } from 'react-router-dom';

export function AuthGuard() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <SignIn />;
  return <Outlet />;
}

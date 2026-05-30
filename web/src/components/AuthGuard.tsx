import { useAuth, useUser, SignIn } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { ManagerContext, type ManagerProfile } from '../lib/ManagerContext';

type SyncState = 'idle' | 'syncing' | 'done' | 'error';

export function AuthGuard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [manager, setManager] = useState<ManagerProfile | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user || syncState !== 'idle') return;

    setSyncState('syncing');

    const name =
      user.fullName ??
      ([user.firstName, user.lastName].filter(Boolean).join(' ') || null) ??
      user.primaryEmailAddress?.emailAddress ??
      'Unknown';

    const email = user.primaryEmailAddress?.emailAddress ?? '';

    getToken()
      .then((token) => {
        if (!token) throw new Error('No token');
        return apiFetch<ManagerProfile>('/auth/sync', token, {
          method: 'POST',
          body: JSON.stringify({ name, email }),
        });
      })
      .then((profile) => {
        setManager(profile);
        setSyncState('done');
      })
      .catch(() => setSyncState('error'));
  }, [isSignedIn, user, syncState, getToken]);

  // Order matters: SignIn must be reachable from a fresh session. The sync
  // useEffect only fires when isSignedIn, so syncState stays 'idle' for a
  // signed-out user — gating Loading on it ahead of the !isSignedIn check
  // would trap them on Loading forever.
  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <SignIn />;
  if (syncState === 'idle' || syncState === 'syncing') return <div>Loading...</div>;
  if (syncState === 'error') return <div>Failed to set up your account. Please refresh.</div>;

  return (
    <ManagerContext.Provider value={manager!}>
      <Outlet />
    </ManagerContext.Provider>
  );
}

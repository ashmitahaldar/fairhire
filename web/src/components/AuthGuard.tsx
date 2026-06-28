import { useAuth, useUser, SignIn } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import type { Role } from '@fairhire/shared';
import { apiFetch, ApiError } from '../lib/api';
import { ManagerContext, type ManagerProfile } from '../lib/ManagerContext';
import { RolePicker } from './RolePicker';

// 'checking'  — looking up an existing Manager row (GET /auth/me)
// 'needsRole' — no row yet: show the first-run role picker
// 'syncing'   — POST /auth/sync with the chosen role
type SyncState = 'idle' | 'checking' | 'needsRole' | 'syncing' | 'done' | 'error';

export function AuthGuard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [manager, setManager] = useState<ManagerProfile | null>(null);

  // Existing users have a Manager row already, so /auth/me returns it and we
  // skip the picker. A brand-new Clerk user has no row → /auth/me 404s → we
  // show the role picker, which provisions the row via /auth/sync.
  useEffect(() => {
    if (!isSignedIn || !user || syncState !== 'idle') return;

    setSyncState('checking');

    getToken()
      .then((token) => {
        if (!token) throw new Error('No token');
        return apiFetch<ManagerProfile>('/auth/me', token);
      })
      .then((profile) => {
        setManager(profile);
        setSyncState('done');
      })
      .catch((err) => {
        // 404 = valid token, no Manager row yet → first-run provisioning.
        if (err instanceof ApiError && err.status === 404) {
          setSyncState('needsRole');
        } else {
          setSyncState('error');
        }
      });
  }, [isSignedIn, user, syncState, getToken]);

  const handleChooseRole = useCallback(
    (role: Role) => {
      if (!user) return;
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
            body: JSON.stringify({ name, email, role }),
          });
        })
        .then((profile) => {
          setManager(profile);
          setSyncState('done');
        })
        .catch(() => setSyncState('error'));
    },
    [user, getToken]
  );

  // Resetting to 'idle' re-arms the check effect (its guard is syncState ===
  // 'idle'), so a transient failure is recoverable without a full reload.
  const retry = () => {
    setManager(null);
    setSyncState('idle');
  };

  // Order matters: SignIn must be reachable from a fresh session. The check
  // useEffect only fires when isSignedIn, so syncState stays 'idle' for a
  // signed-out user — gating Loading on it ahead of the !isSignedIn check
  // would trap them on Loading forever.
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn)
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <SignIn />
      </div>
    );
  if (syncState === 'needsRole' || syncState === 'syncing') {
    return <RolePicker onChoose={handleChooseRole} submitting={syncState === 'syncing'} />;
  }
  if (syncState === 'idle' || syncState === 'checking') return <LoadingScreen />;
  if (syncState === 'error') return <ErrorScreen onRetry={retry} />;

  return (
    <ManagerContext.Provider value={manager!}>
      <Outlet />
    </ManagerContext.Provider>
  );
}

// First-touch states share the centered-shell language of the RolePicker so the
// very first thing a user sees already belongs to the design system.
function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-bg px-4"
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <p className="fh-label mb-2">FairHire</p>
        <p className="font-mono text-sm text-ink-tertiary">Loading your workspace…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="fh-card w-full max-w-md p-8 text-center shadow-float">
        <p className="fh-label mb-1">Something went wrong</p>
        <h1 className="font-serif text-section text-ink mb-2">We couldn’t set up your account</h1>
        <p className="text-sm text-ink-secondary mb-6 [text-wrap:pretty]">
          This is usually temporary. Try again, or refresh the page if it keeps happening.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="w-full text-sm font-medium text-ink-inverse bg-ink px-4 py-2.5 rounded-input hover:bg-accent transition-colors duration-120"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

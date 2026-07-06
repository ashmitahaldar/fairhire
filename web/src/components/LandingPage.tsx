import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn, useSignIn } from '@clerk/clerk-react';

// Demo credentials are read from Vite env (VITE_DEMO_*). They point at
// dedicated, pre-seeded demo accounts — never the presenter's own accounts —
// so a first-time visitor can explore anonymised sample data with one click.
// Passwords live in the client bundle by design: these accounts hold only
// fictional seed data. If the env vars are absent (e.g. not yet provisioned),
// the demo section is hidden and the page degrades to Sign in only.
const DEMO = {
  manager: {
    email: import.meta.env.VITE_DEMO_MANAGER_EMAIL as string | undefined,
    password: import.meta.env.VITE_DEMO_MANAGER_PASSWORD as string | undefined,
  },
  hr: {
    email: import.meta.env.VITE_DEMO_HR_EMAIL as string | undefined,
    password: import.meta.env.VITE_DEMO_HR_PASSWORD as string | undefined,
  },
} as const;

type DemoRole = 'manager' | 'hr';
const demoReady = (r: DemoRole) => Boolean(DEMO[r].email && DEMO[r].password);

export function LandingPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const navigate = useNavigate();
  const [view, setView] = useState<'home' | 'signin'>('home');
  const [pending, setPending] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enterDemo = async (role: DemoRole) => {
    const creds = DEMO[role];
    if (!isLoaded || !creds.email || !creds.password) return;
    setPending(role);
    setError(null);
    // Land HR on the org overview directly — its dashboard has no own meetings.
    const dest = role === 'hr' ? '/hr' : '/';
    try {
      const res = await signIn.create({ identifier: creds.email, password: creds.password });
      if (res.status === 'complete') {
        // setActive flips isSignedIn → AuthGuard advances past the landing page.
        await setActive({ session: res.createdSessionId });
        navigate(dest);
        return;
      }
      if (res.status === 'needs_second_factor') {
        // The Clerk instance requires an email-code second factor. The demo
        // accounts use Clerk test emails (…+clerk_test@…) whose MFA code is
        // always 424242 — so the factor is satisfied with no real inbox and no
        // instance/dashboard change.
        await signIn.prepareSecondFactor({ strategy: 'email_code' });
        const res2 = await signIn.attemptSecondFactor({ strategy: 'email_code', code: '424242' });
        if (res2.status === 'complete') {
          await setActive({ session: res2.createdSessionId });
          navigate(dest);
          return;
        }
      }
      setError('Could not start the demo session. Please try Sign in instead.');
      setPending(null);
    } catch {
      setError('The demo is unavailable right now. Please try Sign in instead.');
      setPending(null);
    }
  };

  if (view === 'signin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg px-4">
        <button
          type="button"
          onClick={() => setView('home')}
          className="group mb-6 flex items-baseline gap-2 text-sm text-ink-secondary hover:text-ink transition-colors duration-120"
        >
          <span aria-hidden="true" className="transition-transform duration-160 group-hover:-translate-x-0.5">
            ←
          </span>
          <span className="underline decoration-hairline underline-offset-4 group-hover:decoration-ink">
            Back
          </span>
        </button>
        <SignIn />
      </div>
    );
  }

  const anyDemo = demoReady('manager') || demoReady('hr');

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-16">
      <main className="w-full max-w-xl text-center">
        <p className="fh-label mb-4">UBS Tomorrow’s Talent Program: Technology 2026</p>

        <h1 className="font-serif italic text-ink leading-none mb-6 text-[clamp(3rem,12vw,5.5rem)]">
          FairHire
        </h1>

        <p className="font-serif italic text-section text-ink-secondary mb-4 [text-wrap:balance]">
          A mirror, not a cop.
        </p>
        <p className="mx-auto max-w-md text-base text-ink-secondary leading-relaxed [text-wrap:pretty]">
          Bias-awareness for hiring and promotion decisions. A private review tool that
          reflects your own patterns back to you — so bias you can see becomes bias you
          can change.
        </p>

        {anyDemo && (
          <section className="mt-12" aria-labelledby="demo-heading">
            <h2 id="demo-heading" className="fh-label mb-1">
              Explore the demo
            </h2>
            <p className="text-sm text-ink-tertiary mb-5">
              No sign-up — a guided look at anonymised sample data.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3">
              {demoReady('manager') && (
                <button
                  type="button"
                  onClick={() => enterDemo('manager')}
                  disabled={pending !== null}
                  className="flex-1 max-w-xs mx-auto text-sm font-medium text-ink-inverse bg-ink px-5 py-3 rounded-input hover:bg-accent transition-colors duration-120 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pending === 'manager' ? 'Opening…' : 'Enter as a hiring manager'}
                </button>
              )}
              {demoReady('hr') && (
                <button
                  type="button"
                  onClick={() => enterDemo('hr')}
                  disabled={pending !== null}
                  className="flex-1 max-w-xs mx-auto text-sm font-medium text-ink border border-hairline-strong px-5 py-3 rounded-input hover:border-ink transition-colors duration-120 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pending === 'hr' ? 'Opening…' : 'Enter as HR'}
                </button>
              )}
            </div>
            {error && (
              <p className="mt-4 text-sm text-accent" role="alert">
                {error}
              </p>
            )}
          </section>
        )}

        <div className="mt-12 flex items-center justify-center gap-2 text-sm text-ink-secondary">
          <span>{anyDemo ? 'Have an account?' : 'Sign in to continue.'}</span>
          <button
            type="button"
            onClick={() => setView('signin')}
            className="font-medium text-ink underline decoration-hairline underline-offset-4 hover:decoration-ink transition-colors duration-120"
          >
            Sign in
          </button>
        </div>

        <p className="fh-meta mt-16">
          Demo data is fictional. A manager sees only their own interviews; HR sees only
          anonymised org aggregates.
        </p>
      </main>
    </div>
  );
}

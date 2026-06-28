import { NavLink, Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useManager } from '../lib/ManagerContext';

// App chrome. The nav is part of the editorial design system like every screen
// it wraps — serif wordmark, hairline rules, ink tokens, and an oxblood
// underline on the active route (the same active-tab idiom as the Mirror tabs).
function NavItem({ to, end, children }: { to: string; end?: boolean; children: string }) {
  return (
    <NavLink to={to} end={end}>
      {({ isActive }) => (
        <span
          className={`relative inline-block whitespace-nowrap text-sm py-1 transition-colors duration-120 ${
            isActive ? 'text-ink' : 'text-ink-secondary hover:text-ink'
          }`}
        >
          {children}
          <span
            aria-hidden="true"
            className={`absolute left-0 right-0 -bottom-1.5 h-px bg-accent transition-opacity duration-160 ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </span>
      )}
    </NavLink>
  );
}

export function Layout() {
  const { role: managerRole } = useManager();

  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-hairline bg-surface">
        <div className="flex items-center gap-4 sm:gap-7 px-4 sm:px-6 h-14">
          <NavLink
            to="/"
            end
            className="font-serif text-body text-ink leading-none shrink-0 mr-auto"
          >
            FairHire
          </NavLink>
          {/* The link cluster scrolls horizontally when it can't fit (narrow
              tablets / phones) so it never overflows the bar; the wordmark and
              account button stay pinned. py-2 keeps the active underline inside
              the scroll box (overflow-x:auto forces overflow-y:auto). */}
          <div className="flex items-center gap-4 sm:gap-7 min-w-0 overflow-x-auto py-2">
            <NavItem to="/" end>
              Dashboard
            </NavItem>
            <NavItem to="/meetings/upload">Upload</NavItem>
            <NavItem to="/candidates">Candidates</NavItem>
            <NavItem to="/pattern-mirror">Pattern Mirror</NavItem>
            {managerRole === 'hr_admin' && <NavItem to="/hr">HR Overview</NavItem>}
          </div>
          <span className="shrink-0 flex items-center">
            <UserButton afterSignOutUrl="/" />
          </span>
        </div>
      </nav>
      <main className="px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

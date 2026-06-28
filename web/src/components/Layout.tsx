import { NavLink, Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  Settings2,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useManager } from '../lib/ManagerContext';
import { WorkspaceSettings } from './account/WorkspaceSettings';

// App chrome. The nav is part of the editorial design system like every screen
// it wraps — serif wordmark, hairline rules, ink tokens, and an oxblood
// underline on the active route (the same active-tab idiom as the Mirror tabs).
// A small line icon sits to the left of each label as a quiet wayfinding aid.
function NavItem({
  to,
  end,
  icon: Icon,
  children,
}: {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  children: string;
}) {
  return (
    <NavLink to={to} end={end}>
      {({ isActive }) => (
        <span
          className={`relative inline-flex items-center gap-1.5 whitespace-nowrap text-sm py-1 transition-colors duration-120 ${
            isActive ? 'text-ink' : 'text-ink-secondary hover:text-ink'
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
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
            // Serif italic wordmark — the same treatment as the loading,
            // role-picker, and error screens (fh-label), so the FairHire mark
            // reads identically everywhere it appears.
            className="font-serif italic text-body text-ink leading-none shrink-0 mr-auto"
          >
            FairHire
          </NavLink>
          {/* The link cluster scrolls horizontally when it can't fit (narrow
              tablets / phones) so it never overflows the bar; the wordmark and
              account button stay pinned. py-2 keeps the active underline inside
              the scroll box (overflow-x:auto forces overflow-y:auto). */}
          <div className="flex items-center gap-4 sm:gap-7 min-w-0 overflow-x-auto py-2">
            <NavItem to="/" end icon={LayoutDashboard}>
              Dashboard
            </NavItem>
            <NavItem to="/meetings/upload" icon={Upload}>
              Upload
            </NavItem>
            <NavItem to="/candidates" icon={Users}>
              Candidates
            </NavItem>
            <NavItem to="/pattern-mirror" icon={Activity}>
              Pattern Mirror
            </NavItem>
            {managerRole === 'hr_admin' && (
              <NavItem to="/hr" icon={BarChart3}>
                HR Overview
              </NavItem>
            )}
          </div>
          <span className="shrink-0 flex items-center">
            <UserButton afterSignOutUrl="/">
              {/* Custom account-settings page: account type + division, the
                  FairHire-specific fields Clerk doesn't know about. */}
              <UserButton.UserProfilePage
                label="Workspace"
                labelIcon={<Settings2 className="h-4 w-4" aria-hidden="true" />}
                url="workspace"
              >
                <WorkspaceSettings />
              </UserButton.UserProfilePage>
            </UserButton>
          </span>
        </div>
      </nav>
      <main className="px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

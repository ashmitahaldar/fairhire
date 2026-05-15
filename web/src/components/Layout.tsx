import { NavLink, Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useManager } from '../lib/ManagerContext';

export function Layout() {
  const { role: managerRole } = useManager();

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh' }}>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#fff',
        }}
      >
        <span style={{ fontWeight: 700, marginRight: 'auto' }}>FairHire</span>
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/meetings/upload">Upload Transcript</NavLink>
        <NavLink to="/pattern-mirror">Pattern Mirror</NavLink>
        {managerRole === 'hr_admin' && <NavLink to="/hr">HR Overview</NavLink>}
        <UserButton afterSignOutUrl="/" />
      </nav>
      <main style={{ padding: '2rem 1.5rem' }}>
        <Outlet />
      </main>
    </div>
  );
}

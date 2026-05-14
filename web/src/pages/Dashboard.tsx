import { useUser } from '@clerk/clerk-react';

export default function Dashboard() {
  const { user } = useUser();
  return (
    <div>
      <h1>Welcome, {user?.firstName ?? 'Manager'}</h1>
      <p>Decision Companion — stub. Upload a transcript to get started.</p>
    </div>
  );
}

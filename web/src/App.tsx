import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import { RoleGuard } from './components/RoleGuard';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import MeetingUpload from './pages/MeetingUpload';
import PatternMirror from './pages/PatternMirror';
import HRDashboard from './pages/HRDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/meetings/upload" element={<MeetingUpload />} />
            <Route path="/pattern-mirror" element={<PatternMirror />} />
            <Route element={<RoleGuard role="hr_admin" />}>
              <Route path="/hr" element={<HRDashboard />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

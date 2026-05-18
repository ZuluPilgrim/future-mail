/**
 * App — Root Router
 *
 * Defines all client-side routes and their access rules:
 *
 *   SetupRoute      — /setup: only reachable when zero users exist.
 *                     After first admin is created, redirects to /login.
 *
 *   PublicOnlyRoute — Login, Register, Forgot/Reset password, Verify.
 *                     Redirects logged-in users to /dashboard.
 *                     Redirects to /setup if no users exist.
 *
 *   PrivateRoute    — Dashboard, Compose, LetterDetail, Security/2FA.
 *                     Redirects to /login if not authenticated.
 *                     Redirects to /setup if no users exist.
 *
 *   /login/2fa      — Second login step when 2FA is enabled. Public but
 *                     requires a short-lived tempToken passed via router state.
 *
 *   AdminRoute      — /admin only.
 *                     Redirects non-admins to /dashboard.
 *
 *   Unknown routes  — redirect to /login.
 *
 * useSetupStatus() fetches /api/auth/setup-status on each route render
 * to determine whether first-run setup is needed.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Setup from './pages/Setup';
import Verify from './pages/Verify';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Compose from './pages/Compose';
import LetterDetail from './pages/LetterDetail';
import TwoFactorLogin from './pages/TwoFactorLogin';
import TwoFactorSettings from './pages/TwoFactorSettings';
import SetupMFAPrompt from './pages/SetupMFAPrompt';
import Admin from './pages/Admin';
import Layout from './components/Layout';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-ink-400 font-serif italic text-lg animate-pulse">Opening the vault…</div>
  </div>
);

// Shared hook — checks first-run status once and caches it
function useSetupStatus() {
  const [needsSetup, setNeedsSetup] = useState(null); // null = loading
  useEffect(() => {
    fetch('/api/auth/setup-status')
      .then(r => r.json())
      .then(d => setNeedsSetup(d.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);
  return needsSetup;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  const needsSetup = useSetupStatus();
  if (loading || needsSetup === null) return <Spinner />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

// Setup route — only accessible when no users exist, otherwise redirect to login
function SetupRoute() {
  const needsSetup = useSetupStatus();
  if (needsSetup === null) return <Spinner />;
  if (!needsSetup) return <Navigate to="/login" replace />;
  return <Setup />;
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const needsSetup = useSetupStatus();
  if (loading || needsSetup === null) return <Spinner />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();
  const needsSetup = useSetupStatus();
  if (loading || needsSetup === null) return <Spinner />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function VerifyRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Verify />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#2C1810',
              color: '#F9F3E3',
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '14px',
              borderRadius: '2px',
            },
          }}
        />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Unauthenticated-only routes */}
          <Route path="/login"          element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register"       element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route path="/setup"          element={<SetupRoute />} />
          <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
          <Route path="/reset-password"  element={<PublicOnlyRoute><ResetPassword /></PublicOnlyRoute>} />
          <Route path="/verify"         element={<VerifyRoute />} />

          {/* Protected routes */}
          <Route path="/dashboard"    element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
          <Route path="/compose"      element={<PrivateRoute><Layout><Compose /></Layout></PrivateRoute>} />
          <Route path="/letters/:id"  element={<PrivateRoute><Layout><LetterDetail /></Layout></PrivateRoute>} />
          <Route path="/security/2fa" element={<PrivateRoute><Layout><TwoFactorSettings /></Layout></PrivateRoute>} />
          <Route path="/setup-mfa"    element={<PrivateRoute><SetupMFAPrompt /></PrivateRoute>} />

          {/* 2FA login step — public but requires tempToken in location state */}
          <Route path="/login/2fa" element={<TwoFactorLogin />} />

          {/* Admin-only routes */}
          <Route path="/admin" element={<AdminRoute><Layout><Admin /></Layout></AdminRoute>} />

          {/* Any unknown route → login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

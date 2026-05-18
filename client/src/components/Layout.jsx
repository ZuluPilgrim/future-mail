/**
 * Layout — Main App Shell
 *
 * Wraps all authenticated pages with:
 *   - Sticky header with logo, navigation links, and sign-out button
 *   - Navigation: My Letters · Compose · Security · Admin (admin only)
 *   - Active link highlighting based on current route
 *   - Admin badge and Admin nav link (visible to admin users only)
 *   - Security link → /security/2fa (visible to all authenticated users)
 *   - Page content area
 *   - Footer
 *
 * Used in App.jsx to wrap Dashboard, Compose, LetterDetail, and Admin pages.
 */
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const handleLogout = () => {
    logout();
    toast.success('Until next time.');
    navigate('/login');
  };

  // Returns Tailwind classes for nav links, highlighting the active route
  const navLink = (to, label) => (
    <Link to={to}
      className={`px-4 py-2 text-sm font-sans transition-colors rounded-sm ${
        location.pathname === to
          ? 'text-ink-800 bg-parchment-100'
          : 'text-ink-500 hover:text-ink-800 hover:bg-parchment-50'
      }`}>
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen paper-texture">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-parchment-200 bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-full bg-seal-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
            </div>
            <span className="font-serif text-xl text-ink-800 tracking-tight">FutureMail</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navLink('/dashboard', 'My Letters')}
            {navLink('/compose',   'Compose')}
            {navLink('/security/2fa', 'Security')}
            {/* Admin link only shown to admin users */}
            {isAdmin && navLink('/admin', 'Admin')}
            <div className="w-px h-5 bg-parchment-300 mx-2" />
            <span className="text-sm text-ink-400 font-sans hidden sm:block">{user?.name}</span>
            {/* Admin badge */}
            {isAdmin && (
              <span className="text-xs bg-seal-500/10 text-seal-600 border border-seal-300 px-2 py-0.5 rounded-full font-sans ml-1">
                admin
              </span>
            )}
            <button onClick={handleLogout} className="text-sm text-ink-400 hover:text-seal-500 transition-colors ml-2 font-sans">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-parchment-200 mt-20 py-8">
        <p className="text-center text-ink-400/60 text-xs font-sans tracking-widest uppercase">
          FutureMail v4.7 · Self-Hosted · Your words, your time
        </p>
      </footer>
    </div>
  );
}

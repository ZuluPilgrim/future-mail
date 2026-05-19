/**
 * SetupMFAPrompt Page
 *
 * Shown immediately after a new user verifies their account.
 * Gives them the option to set up 2FA right away, with a note
 * that it is recommended for security.
 *
 * If they choose to set up 2FA, they are taken to /security/2fa.
 * If they skip, they go straight to /dashboard.
 * This page is only reachable via router state (newAccount: true)
 * so it cannot be accessed directly by navigating to the URL.
 */
import { useNavigate, useLocation } from 'react-router-dom';

export default function SetupMFAPrompt() {
  const navigate = useNavigate();
  const location = useLocation();

  // Only reachable right after account verification or first-run setup
  if (!location.state?.newAccount) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const isAdmin    = location.state?.isAdmin;
  const skipTarget = isAdmin ? '/admin' : '/dashboard';
  const setupTarget = '/security/2fa';

  return (
    <div className="min-h-screen flex items-center justify-center paper-texture px-4">
      <div className="w-full max-w-md animate-fade-in">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-full bg-seal-500 flex items-center justify-center shadow-md mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-ink-800">Welcome to FutureMail</h1>
          <p className="font-serif italic text-ink-400 mt-1">Your account is active</p>
        </div>

        <div className="card p-8">
          <h2 className="font-serif text-xl text-ink-800 mb-3">
            Set up two-factor authentication?
          </h2>

          {/* Recommendation note */}
          <div className="bg-parchment-100 border border-parchment-300 rounded-sm px-4 py-3 mb-5">
            <p className="text-sm font-sans text-ink-700">
              <strong>Recommended for security.</strong> 2FA adds a second layer of
              protection to your account. Even if someone obtains your password,
              they cannot log in without your authenticator app.
            </p>
          </div>

          <p className="text-sm font-sans text-ink-500 mb-6">
            Works with <strong>Proton Authenticator</strong>, Google Authenticator,
            Authy, Bitwarden, 1Password, and any TOTP-compatible app. Takes
            about 60 seconds to set up.
          </p>

          {/* Primary action */}
          <button
            onClick={() => navigate(setupTarget, { state: { fromSetup: true, isAdmin } })}
            className="btn-primary w-full mb-3"
          >
            Set up 2FA now (recommended)
          </button>

          {/* Skip */}
          <button
            onClick={() => navigate(skipTarget)}
            className="w-full text-center text-sm font-sans text-ink-400 hover:text-ink-700 transition-colors py-2"
          >
            Skip for now — I'll do this later
          </button>

          <p className="text-xs font-sans text-ink-300 text-center mt-3">
            You can enable 2FA at any time from the <strong>Security</strong> page.
          </p>
        </div>
      </div>
    </div>
  );
}

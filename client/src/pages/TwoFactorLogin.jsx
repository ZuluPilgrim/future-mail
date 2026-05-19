/**
 * TwoFactorLogin Page
 *
 * The second step of login when a user has 2FA enabled.
 * Receives a short-lived tempToken from the Login page and
 * asks the user to enter either their 6-digit TOTP code or
 * a recovery code.
 *
 * On success, calls /api/2fa/validate which returns the full JWT.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function TwoFactorLogin() {
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();
  const tempToken   = location.state?.tempToken;

  // If someone lands here without a tempToken, send them back to login
  if (!tempToken) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) { toast.error('Enter your code'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/2fa/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), tempToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}.`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || '2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center paper-texture px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-full bg-seal-500 flex items-center justify-center shadow-md mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-ink-800">Two-Factor Auth</h1>
          <p className="font-serif italic text-ink-400 mt-1">
            {useRecovery ? 'Enter a recovery code' : 'Enter your authenticator code'}
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
                {useRecovery ? 'Recovery Code' : '6-Digit Code'}
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={e => setCode(useRecovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))}
                placeholder={useRecovery ? 'XXXXX-XXXXX' : '000000'}
                maxLength={useRecovery ? 11 : 6}
                className={`input-field font-mono text-center tracking-widest ${useRecovery ? 'text-lg' : 'text-3xl'}`}
                autoFocus
                autoComplete="one-time-code"
              />
              {!useRecovery && (
                <p className="text-xs text-ink-400 font-sans mt-2 text-center">
                  Open your authenticator app and enter the current 6-digit code.
                </p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <button
              onClick={() => { setUseRecovery(!useRecovery); setCode(''); }}
              className="text-sm font-sans text-ink-500 hover:text-ink-800 underline underline-offset-2"
            >
              {useRecovery ? '← Use authenticator code instead' : 'Use a recovery code instead'}
            </button>
            <div>
              <button
                onClick={() => navigate('/login')}
                className="text-sm font-sans text-ink-400 hover:text-ink-700"
              >
                ← Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

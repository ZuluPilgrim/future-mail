/**
 * TwoFactorSettings Page
 *
 * Lets a logged-in user enable or disable TOTP-based 2FA on their account.
 *
 * Enable flow:
 *   1. Calls /api/2fa/setup → receives QR code + text secret
 *   2. User scans QR with their authenticator app
 *   3. User enters a live code to confirm → calls /api/2fa/verify-setup
 *   4. Recovery codes are displayed — user must save them before continuing
 *
 * Disable flow:
 *   1. User enters their account password
 *   2. Calls /api/2fa/disable
 *
 * Compatible with any TOTP app: Proton Authenticator, Google Authenticator,
 * Authy, Bitwarden, 1Password, etc.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authHeaders } from '../context/AuthContext';

export default function TwoFactorSettings() {
  const [status, setStatus]         = useState(null); // null = loading
  const [step, setStep]             = useState('idle'); // idle | scan | confirm | recovery | disable
  const [qrCode, setQrCode]         = useState('');
  const [secret, setSecret]         = useState('');
  const [code, setCode]             = useState('');
  const [password, setPassword]     = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [savedCodes, setSavedCodes] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const fromSetup = location.state?.fromSetup;
  const isAdmin   = location.state?.isAdmin;
  const doneTarget = isAdmin ? '/admin' : '/dashboard';

  useEffect(() => {
    fetch('/api/2fa/status', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setStatus(d.enabled))
      .catch(() => setStatus(false));
  }, []);

  // ── Enable: Step 1 — fetch QR code ─────────────────────────────────────────
  const handleStartSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/2fa/setup', { method: 'POST', headers: authHeaders() });
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error);
      setQrCode(d.qrCode);
      setSecret(d.secret);
      setCode('');
      setStep('scan');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Enable: Step 2 — verify code and activate ──────────────────────────────
  const handleVerifySetup = async (e) => {
    e.preventDefault();
    if (code.length !== 6) { toast.error('Enter the 6-digit code from your app'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/2fa/verify-setup', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setRecoveryCodes(d.recoveryCodes);
      setStep('recovery');
      setSavedCodes(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Enable: Step 3 — acknowledge recovery codes ────────────────────────────
  const handleRecoveryDone = () => {
    setStatus(true);
    setStep('idle');
    toast.success('2FA is now active on your account.');
    // If arrived from the post-registration prompt, go to the appropriate destination
    if (fromSetup) navigate(doneTarget);
  };

  // ── Disable ─────────────────────────────────────────────────────────────────
  const handleDisable = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/2fa/disable', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success('2FA has been disabled.');
      setStatus(false);
      setStep('idle');
      setPassword('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    toast.success('Secret copied');
  };

  const copyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    toast.success('Recovery codes copied');
  };

  if (status === null) return (
    <div className="flex items-center justify-center py-32">
      <p className="font-serif italic text-ink-400 animate-pulse">Loading…</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <button onClick={() => navigate(fromSetup ? '/dashboard' : '/dashboard')} className="text-sm font-sans text-ink-400 hover:text-ink-800 transition-colors inline-block mb-8">
        ← Back to dashboard
      </button>

      <div className="mb-8">
        <p className="text-xs font-sans tracking-widest uppercase text-ink-400 mb-1">Security</p>
        <h1 className="font-serif text-4xl text-ink-800">Two-Factor Authentication</h1>
        <p className="text-ink-400 font-sans mt-2">
          Add an extra layer of security to your account using an authenticator app.
        </p>
      </div>

      {/* ── Current status ── */}
      {step === 'idle' && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className={`w-3 h-3 rounded-full ${status ? 'bg-green-500' : 'bg-ink-300'}`} />
            <span className="font-sans font-medium text-ink-800">
              2FA is currently <strong>{status ? 'enabled' : 'disabled'}</strong>
            </span>
          </div>

          {status ? (
            <>
              <p className="text-sm font-sans text-ink-500 mb-5">
                Your account is protected. You will be asked for a code from your authenticator app each time you log in.
              </p>
              <button onClick={() => setStep('disable')} className="btn-danger w-full">
                Disable 2FA
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-sans text-ink-500 mb-5">
                Works with <strong>Proton Authenticator</strong>, Google Authenticator, Authy, Bitwarden, 1Password, and any TOTP-compatible app.
              </p>
              <button onClick={handleStartSetup} disabled={loading} className="btn-primary w-full">
                {loading ? 'Setting up…' : 'Enable 2FA'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Step: Scan QR code ── */}
      {step === 'scan' && (
        <div className="card p-6 space-y-5">
          <h2 className="font-serif text-xl text-ink-800">Scan this QR code</h2>
          <p className="text-sm font-sans text-ink-500">
            Open your authenticator app, tap <strong>+</strong> or <strong>Add account</strong>, then scan the code below.
          </p>

          {/* QR code */}
          <div className="flex justify-center py-4 bg-white rounded-sm border border-parchment-200">
            <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
          </div>

          {/* Manual entry fallback — clearly visible, not hidden */}
          <div className="bg-parchment-50 border border-parchment-200 rounded-sm p-4 space-y-2">
            <p className="text-xs font-sans font-medium tracking-widest uppercase text-ink-500">
              Can't scan? Enter manually in your app
            </p>
            <p className="text-xs text-ink-400 font-sans">
              In your authenticator app choose <strong>Manual entry</strong> or <strong>Enter setup key</strong>.
              Set the type to <strong>Time-based (TOTP)</strong> and use these details:
            </p>
            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-ink-500 font-sans w-20 shrink-0">Account</span>
                <code className="font-mono text-xs text-ink-700 flex-1">FutureMail</code>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-ink-500 font-sans w-20 shrink-0">Key</span>
                <code className="font-mono text-xs text-ink-700 flex-1 break-all">{secret}</code>
                <button onClick={copySecret} className="text-xs btn-ghost px-2 py-1 shrink-0">Copy</button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-ink-500 font-sans w-20 shrink-0">Type</span>
                <code className="font-mono text-xs text-ink-700 flex-1">Time-based (TOTP)</code>
              </div>
            </div>
          </div>

          {/* Confirm code */}
          <form onSubmit={handleVerifySetup} className="space-y-4 border-t border-parchment-200 pt-5">
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
                Enter the 6-digit code from your app
              </label>
              <input
                type="text" required maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="input-field font-mono text-3xl text-center tracking-widest"
                autoFocus autoComplete="one-time-code"
              />
            </div>
            <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full">
              {loading ? 'Verifying…' : 'Confirm & Enable 2FA'}
            </button>
          </form>

          <button onClick={() => setStep('idle')} className="w-full text-center text-sm text-ink-400 hover:text-ink-700 font-sans">
            Cancel
          </button>
        </div>
      )}

      {/* ── Step: Recovery codes ── */}
      {step === 'recovery' && (
        <div className="card p-6 space-y-5">
          <div className="bg-seal-500/10 border border-seal-300 rounded-sm px-4 py-3">
            <p className="text-sm font-sans text-seal-700">
              <strong>⚠ Save these recovery codes now.</strong> They are shown only once. If you lose access to your authenticator app, use one of these codes to log in.
            </p>
          </div>

          <h2 className="font-serif text-xl text-ink-800">Recovery Codes</h2>
          <p className="text-sm font-sans text-ink-500">Each code can only be used once.</p>

          <div className="bg-ink-900 rounded-sm p-4 grid grid-cols-2 gap-2">
            {recoveryCodes.map((c, i) => (
              <code key={i} className="font-mono text-sm text-parchment-100 tracking-widest">{c}</code>
            ))}
          </div>

          <button onClick={copyRecoveryCodes} className="btn-ghost w-full text-sm">
            Copy all codes
          </button>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={savedCodes} onChange={e => setSavedCodes(e.target.checked)} className="w-4 h-4 accent-ink-800" />
            <span className="text-sm font-sans text-ink-700">I have saved my recovery codes in a safe place</span>
          </label>

          <button onClick={handleRecoveryDone} disabled={!savedCodes} className="btn-primary w-full">
            Done — Activate 2FA
          </button>
        </div>
      )}

      {/* ── Step: Disable ── */}
      {step === 'disable' && (
        <div className="card p-6 space-y-5">
          <h2 className="font-serif text-xl text-ink-800">Disable 2FA</h2>
          <p className="text-sm font-sans text-ink-500">
            Enter your account password to confirm. This will remove 2FA protection from your account.
          </p>
          <form onSubmit={handleDisable} className="space-y-4">
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
                Your Password
              </label>
              <input
                type="password" required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input-field"
                autoFocus
              />
            </div>
            <button type="submit" disabled={loading} className="btn-danger w-full">
              {loading ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </form>
          <button onClick={() => setStep('idle')} className="w-full text-center text-sm text-ink-400 hover:text-ink-700 font-sans">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const RESEND_COOLDOWN = 120; // 2 minutes in seconds

export default function Verify() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const formatCooldown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 8) {
      toast.error('Code must be 8 digits');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      login(data.token, data.user);
      toast.success('Account verified! Welcome to FutureMail.');
      // Offer 2FA setup immediately after verification
      navigate('/setup-mfa', { state: { newAccount: true } });
    } catch (err) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) { toast.error('Enter your email first'); return; }
    if (cooldown > 0) return;
    setResending(true);
    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('New code sent — check your email.');
      startCooldown();
    } catch (err) {
      toast.error(err.message || 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center paper-texture px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="font-serif text-3xl text-ink-800">Verify your account</h1>
          <p className="text-ink-400 font-sans mt-2">Enter the 8-digit code sent to your email</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
                Email Address
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
                Verification Code
              </label>
              <input
                type="text" required maxLength={8}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="12345678"
                className="input-field font-mono text-2xl text-center tracking-widest"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Verifying…' : 'Verify & Activate'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm font-sans text-ink-400 mb-2">Didn't receive a code?</p>
            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="text-sm font-sans underline underline-offset-2 disabled:no-underline disabled:cursor-not-allowed text-ink-700 hover:text-ink-900 disabled:text-ink-400"
            >
              {resending ? 'Sending…' : cooldown > 0 ? `Resend in ${formatCooldown(cooldown)}` : 'Resend verification code'}
            </button>
          </div>

          <div className="mt-4 text-center">
            <button onClick={() => navigate('/login')} className="text-sm text-ink-400 hover:text-ink-700 font-sans">
              ← Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

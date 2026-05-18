/**
 * Login Page
 *
 * Handles user sign-in. On first load, checks setup-status:
 *   - If no users exist, shows a "Begin Setup" prompt instead of the form
 *   - If the user's account is unverified, redirects to /verify
 *   - On success, stores the JWT and redirects to /dashboard
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/auth/setup-status')
      .then(r => r.json())
      .then(d => { if (d.needsSetup) setNeedsSetup(true); })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsVerification) {
          toast.error('Account not verified. Redirecting…');
          navigate(`/verify?email=${encodeURIComponent(data.email)}`);
          return;
        }
        throw new Error(data.error);
      }
      // 2FA required — pass the temp token to the 2FA page via router state
      if (data.requires2FA) {
        navigate('/login/2fa', { state: { tempToken: data.tempToken } });
        return;
      }
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}.`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center paper-texture px-4">
        <div className="w-full max-w-md animate-fade-in text-center">
          <div className="w-14 h-14 rounded-full bg-seal-500 flex items-center justify-center shadow-md mx-auto mb-6">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-ink-800 mb-2">FutureMail</h1>
          <p className="text-ink-400 font-sans mb-8">No accounts yet. Set up your admin account to get started.</p>
          <Link to="/setup" className="btn-primary inline-block">Begin Setup →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center paper-texture px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-full bg-seal-500 flex items-center justify-center shadow-md mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-ink-800">FutureMail</h1>
          <p className="font-serif italic text-ink-400 mt-1">Letters across time</p>
        </div>

        <div className="card p-8">
          <h2 className="font-serif text-xl text-ink-800 mb-6">Sign in to your vault</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">Email</label>
              <input type="email" required value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">Password</label>
              <input type="password" required value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••" className="input-field" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Opening…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            <p className="text-sm font-sans text-ink-400">
              No account yet?{' '}
              <Link to="/register" className="text-ink-700 underline underline-offset-2 hover:text-ink-900">Create one</Link>
            </p>
            <p className="text-sm font-sans text-ink-400">
              Have a code?{' '}
              <Link to="/verify" className="text-ink-700 underline underline-offset-2 hover:text-ink-900">Verify account</Link>
            </p>
            <p className="text-sm font-sans text-ink-400">
              <Link to="/forgot-password" className="text-ink-700 underline underline-offset-2 hover:text-ink-900">Forgot password?</Link>
            </p>
          </div>
        </div>

        {/* Description block */}
        <div className="mt-6 card p-6 text-center">
          <p className="font-serif text-ink-700 text-base mb-2">Write letters to the future</p>
          <p className="text-sm font-sans text-ink-400 leading-relaxed">
            FutureMail is a self-hosted time capsule service. Compose a message today and
            schedule it to be delivered to anyone — days, months, or years from now.
            Your letters are sealed until the moment they are sent, and stored securely on your own server.
          </p>
        </div>
      </div>
    </div>
  );
}

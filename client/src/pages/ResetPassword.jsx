/**
 * Reset Password Page
 *
 * Step 2 of the password reset flow. User enters their email, the
 * 8-digit code from their email, and a new password. On success,
 * redirects to /login.
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    email: searchParams.get('email') || '',
    code: '',
    password: '',
    confirm: '',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.code.length !== 8) {
      toast.error('Code must be 8 digits');
      return;
    }
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.toLowerCase(),
          code: form.code.trim(),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Password reset successfully.');
      navigate('/login');
    } catch (err) {
      toast.error(err.message || 'Reset failed');
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
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-ink-800">FutureMail</h1>
          <p className="font-serif italic text-ink-400 mt-1">Set a new password</p>
        </div>

        <div className="card p-8">
          <h2 className="font-serif text-xl text-ink-800 mb-6">Reset Password</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
                Email Address
              </label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
                Reset Code
              </label>
              <input
                type="text" required maxLength={8}
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
                placeholder="12345678"
                className="input-field font-mono text-2xl text-center tracking-widest"
              />
            </div>

            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
                New Password
              </label>
              <input
                type="password" required value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Min. 8 characters"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password" required value={form.confirm}
                onChange={e => setForm({ ...form, confirm: e.target.value })}
                placeholder="Repeat password"
                className="input-field"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <div>
              <Link to="/forgot-password" className="text-sm text-ink-400 hover:text-ink-700 font-sans">
                Resend reset code
              </Link>
            </div>
            <div>
              <Link to="/login" className="text-sm text-ink-400 hover:text-ink-700 font-sans">
                ← Back to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

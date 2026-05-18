/**
 * Forgot Password Page
 *
 * Step 1 of the password reset flow. User enters their email address
 * and receives an 8-digit reset code. Always shows the same success
 * message regardless of whether the email exists (prevents enumeration).
 * On success, redirects to /reset-password with the email pre-filled.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center paper-texture px-4">
        <div className="w-full max-w-md animate-fade-in text-center">
          <div className="text-5xl mb-6">📬</div>
          <h1 className="font-serif text-3xl text-ink-800 mb-3">Check your email</h1>
          <p className="text-ink-500 font-sans mb-2">If that address is registered, a reset code has been sent to:</p>
          <p className="font-mono text-ink-800 font-medium mb-6">{email}</p>
          <p className="text-ink-400 font-sans text-sm mb-8">The code expires in 30 minutes.</p>
          <button
            className="btn-primary w-full"
            onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)}
          >
            Enter Reset Code →
          </button>
          <div className="mt-4">
            <Link to="/login" className="text-sm text-ink-400 hover:text-ink-700 font-sans">
              ← Back to login
            </Link>
          </div>
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
          <p className="font-serif italic text-ink-400 mt-1">Reset your password</p>
        </div>

        <div className="card p-8">
          <h2 className="font-serif text-xl text-ink-800 mb-2">Forgot password?</h2>
          <p className="text-sm font-sans text-ink-400 mb-6">
            Enter your email address and we'll send you a reset code.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending…' : 'Send Reset Code'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-ink-400 hover:text-ink-700 font-sans">
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

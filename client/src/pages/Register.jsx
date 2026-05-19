/**
 * Register Page
 *
 * New user registration form. On success, redirects to /verify
 * with the email pre-filled so the user can enter their code.
 * The server sends an 8-digit verification code to the provided email.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Account created! Check your email for the verification code.');
      navigate(`/verify?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      toast.error(err.message || 'Registration failed');
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
          <p className="font-serif italic text-ink-400 mt-1">Letters across time</p>
        </div>

        <div className="card p-8">
          <h2 className="font-serif text-xl text-ink-800 mb-6">Open your vault</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ada Lovelace"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Min. 8 characters"
                className="input-field"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? 'Creating vault…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm font-sans text-ink-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-ink-700 underline underline-offset-2 hover:text-ink-900">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

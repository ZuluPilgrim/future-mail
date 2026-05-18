/**
 * Compose Page
 *
 * The letter writing interface. Allows users to:
 *   - Write a subject and body
 *   - Add up to 20 recipients (Enter or comma to add, click x to remove)
 *   - Pick a delivery date via quick presets (1 week to 10 years) or date picker
 *
 * On submit, POSTs to /api/letters. The body is stored encrypted in the
 * database and only returned to the letter owner after the letter is sent.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authHeaders } from '../context/AuthContext';

const QUICK_DATES = [
  { label: '1 Week', days: 7 },
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 183 },
  { label: '1 Year', days: 365 },
  { label: '5 Years', days: 1825 },
  { label: '10 Years', days: 3650 },
];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function minDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function Compose() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    body: '',
    send_at: '',
    recipientInput: '',
    recipients: [],
  });

  const addRecipient = () => {
    const email = form.recipientInput.trim().toLowerCase();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Invalid email address');
      return;
    }
    if (form.recipients.includes(email)) {
      toast.error('Already added');
      return;
    }
    if (form.recipients.length >= 20) {
      toast.error('Maximum 20 recipients');
      return;
    }
    setForm(prev => ({ ...prev, recipients: [...prev.recipients, email], recipientInput: '' }));
  };

  const removeRecipient = (email) => {
    setForm(prev => ({ ...prev, recipients: prev.recipients.filter(r => r !== email) }));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addRecipient();
    }
  };

  const wordCount = form.body.trim().split(/\s+/).filter(Boolean).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.recipients.length === 0) {
      toast.error('Add at least one recipient');
      return;
    }
    if (!form.send_at) {
      toast.error('Choose a delivery date');
      return;
    }
    if (form.body.trim().length < 10) {
      toast.error('Letter is too short');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          subject: form.subject,
          body: form.body,
          recipients: form.recipients,
          send_at: new Date(form.send_at).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Letter sealed and scheduled.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Could not schedule letter');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-sans tracking-widest uppercase text-ink-400 mb-1">New letter</p>
        <h1 className="font-serif text-4xl text-ink-800">Compose</h1>
        <p className="text-ink-400 font-sans mt-2">Write something today. Let the future receive it.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Subject */}
        <div className="card p-6">
          <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-2">
            Subject
          </label>
          <input
            type="text"
            required
            maxLength={200}
            value={form.subject}
            onChange={e => setForm({ ...form, subject: e.target.value })}
            placeholder="A note to my future self…"
            className="input-field text-lg font-serif"
          />
        </div>

        {/* Recipients */}
        <div className="card p-6">
          <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-2">
            Recipients
          </label>
          <p className="text-xs text-ink-400 font-sans mb-3">
            Press Enter or comma to add. You can add up to 20.
          </p>

          {/* Added recipients */}
          {form.recipients.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {form.recipients.map(email => (
                <span key={email} className="inline-flex items-center gap-1.5 bg-parchment-100 border border-parchment-300 text-ink-700 text-sm font-sans px-3 py-1 rounded-full">
                  {email}
                  <button type="button" onClick={() => removeRecipient(email)} className="text-ink-400 hover:text-seal-500 transition-colors text-base leading-none">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="email"
              value={form.recipientInput}
              onChange={e => setForm({ ...form, recipientInput: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="name@example.com"
              className="input-field flex-1"
            />
            <button
              type="button"
              onClick={addRecipient}
              className="btn-ghost px-4 shrink-0"
            >
              Add
            </button>
          </div>
        </div>

        {/* Delivery Date */}
        <div className="card p-6">
          <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-2">
            Delivery Date
          </label>
          <p className="text-xs text-ink-400 font-sans mb-3">
            Choose a date, or pick a preset.
          </p>

          {/* Quick picks */}
          <div className="flex flex-wrap gap-2 mb-4">
            {QUICK_DATES.map(({ label, days }) => {
              const val = addDays(days);
              const active = form.send_at === val;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setForm({ ...form, send_at: val })}
                  className={`text-sm font-sans px-3 py-1.5 rounded-sm border transition-all ${
                    active
                      ? 'bg-ink-800 text-parchment-50 border-ink-800'
                      : 'border-parchment-300 text-ink-600 hover:border-ink-600'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <input
            type="date"
            min={minDate()}
            value={form.send_at}
            onChange={e => setForm({ ...form, send_at: e.target.value })}
            className="input-field font-mono"
          />
        </div>

        {/* Letter body */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500">
              Your Letter
            </label>
            <span className="text-xs text-ink-400 font-mono">{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
          </div>
          <textarea
            required
            rows={16}
            value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
            placeholder={`Dear future self,\n\nToday I'm thinking about…`}
            className="input-field letter-body"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="text-ink-400 hover:text-ink-700 font-sans text-sm transition-colors"
          >
            ← Discard
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-10"
          >
            {loading ? 'Sealing…' : '✉ Seal & Schedule'}
          </button>
        </div>

      </form>
    </div>
  );
}

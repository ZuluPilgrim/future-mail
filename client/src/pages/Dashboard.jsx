/**
 * Dashboard Page
 *
 * The main letter list. Shows all of the logged-in user's letters:
 *
 *   Pending (sealed) — shows only the scheduled date, no subject or body.
 *     The user can cancel/delete but cannot read the content.
 *
 *   Delivered — shows subject, recipients, and sent date.
 *     The user can view the full content or delete the record.
 *
 * Filter tabs: All / Pending / Delivered
 * Stats cards: Total / Pending / Delivered counts
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authHeaders } from '../context/AuthContext';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-NZ', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function timeUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  if (diff <= 0) return 'Sending soon…';
  const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs  = Math.floor((diff % (1000 * 60)) / 1000);
  if (days > 0)  return `${days} day${days !== 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  if (mins > 0)  return `${mins} minute${mins !== 1 ? 's' : ''}`;
  return `${secs} second${secs !== 1 ? 's' : ''}`;
}

function PendingCard({ letter, onDelete }) {
  return (
    <div className="card p-6 animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-sans font-medium px-2.5 py-1 rounded-full bg-parchment-100 text-ink-600 border border-parchment-300">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-400" />
              Sealed
            </span>
          </div>
          <p className="font-serif text-ink-500 italic text-lg">Contents sealed until delivery</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-400 font-sans">
            <span>
              <strong className="text-ink-600">{timeUntil(letter.send_at)}</strong>
              {' · '}{formatDate(letter.send_at)}
            </span>
          </div>
        </div>
        <button
          onClick={() => onDelete(letter.id)}
          className="text-ink-300 hover:text-seal-500 transition-colors text-sm font-sans shrink-0"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SentCard({ letter, onDelete }) {
  return (
    <div className="card p-6 animate-slide-up group hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-sans font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Delivered
            </span>
          </div>
          <Link to={`/letters/${letter.id}`} className="block group-hover:text-ink-600 transition-colors">
            <h3 className="font-serif text-xl text-ink-800 truncate">{letter.subject}</h3>
          </Link>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-400 font-sans">
            <span>To: {letter.recipients.slice(0, 2).join(', ')}{letter.recipients.length > 2 && ` +${letter.recipients.length - 2} more`}</span>
            <span>·</span>
            <span>Sent {formatDate(letter.sent_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link to={`/letters/${letter.id}`} className="text-ink-400 hover:text-ink-800 transition-colors text-sm font-sans">
            View →
          </Link>
          <button onClick={() => onDelete(letter.id, letter.subject)} className="text-ink-300 hover:text-seal-500 transition-colors text-sm font-sans">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [letters, setLetters] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchLetters(); }, []);

  const fetchLetters = async () => {
    try {
      const res = await fetch('/api/letters', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLetters(data.letters);
      setStats(data.stats);
    } catch (err) {
      toast.error('Could not load letters');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, subject) => {
    const label = subject ? `"${subject}"` : 'this letter';
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/letters/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error();
      toast.success('Letter deleted.');
      fetchLetters();
    } catch {
      toast.error('Could not delete letter');
    }
  };

  const filtered = letters.filter(l => {
    if (filter === 'pending') return !l.sent;
    if (filter === 'delivered') return l.sent;
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <p className="font-serif italic text-ink-400 animate-pulse">Unsealing the vault…</p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-sans tracking-widest uppercase text-ink-400 mb-1">Your collection</p>
          <h1 className="font-serif text-4xl text-ink-800">Letters</h1>
        </div>
        <Link to="/compose" className="btn-primary">+ Compose</Link>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Pending', value: stats.pending },
            { label: 'Delivered', value: stats.delivered },
          ].map(({ label, value }) => (
            <div key={label} className="card p-5 text-center">
              <div className="font-serif text-3xl text-ink-800">{value}</div>
              <div className="text-xs font-sans tracking-widest uppercase text-ink-400 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {letters.length > 0 && (
        <div className="flex gap-1 mb-6 border-b border-parchment-200">
          {['all', 'pending', 'delivered'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-sans capitalize transition-colors border-b-2 -mb-px ${
                filter === f ? 'border-ink-800 text-ink-800 font-medium' : 'border-transparent text-ink-400 hover:text-ink-700'
              }`}>
              {f}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-parchment-300 rounded-sm">
          {letters.length === 0 ? (
            <>
              <div className="text-5xl mb-4">✉️</div>
              <h3 className="font-serif text-2xl text-ink-600 mb-2">Your vault is empty</h3>
              <p className="text-ink-400 font-sans mb-6">Write your first letter to the future.</p>
              <Link to="/compose" className="btn-primary">Write a Letter</Link>
            </>
          ) : (
            <p className="text-ink-400 font-sans">No {filter} letters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(letter => (
            letter.sent
              ? <SentCard key={letter.id} letter={letter} onDelete={handleDelete} />
              : <PendingCard key={letter.id} letter={letter} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

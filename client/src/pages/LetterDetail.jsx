/**
 * Letter Detail Page
 *
 * Displays the full content of a SENT letter (owner only).
 * Pending letters return 404 from the API — attempting to view one
 * redirects back to the dashboard with an error toast.
 *
 * Provides a Delete button to permanently remove the letter.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authHeaders } from '../context/AuthContext';

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-NZ', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function LetterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/letters/${id}`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Letter not available');
          navigate('/dashboard');
          return;
        }
        setLetter(data.letter);
      } catch (err) {
        toast.error('Could not load letter');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Delete this letter? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/letters/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error();
      toast.success('Letter deleted.');
      navigate('/dashboard');
    } catch {
      toast.error('Could not delete letter');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <p className="font-serif italic text-ink-400 animate-pulse">Breaking the seal…</p>
    </div>
  );

  if (!letter) return null;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <Link to="/dashboard" className="text-sm font-sans text-ink-400 hover:text-ink-800 transition-colors inline-block mb-8">
        ← Back to letters
      </Link>

      {/* Delivered banner */}
      <div className="flex items-center gap-3 p-4 rounded-sm mb-6 bg-green-50 border border-green-200">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
        <p className="font-sans text-sm text-green-700 flex-1">
          Delivered on <strong>{formatDateTime(letter.sent_at)}</strong>
        </p>
        <button onClick={handleDelete} className="btn-danger text-xs px-3 py-1.5">Delete</button>
      </div>

      {/* Letter card */}
      <div className="card">
        <div className="border-b border-parchment-200 px-8 py-6">
          <h1 className="font-serif text-3xl text-ink-800 mb-3">{letter.subject}</h1>
          <div className="text-sm font-sans text-ink-400 space-y-1">
            <p><span className="font-medium text-ink-600">To:</span> {letter.recipients.join(', ')}</p>
            <p><span className="font-medium text-ink-600">Composed:</span> {formatDateTime(letter.created_at)}</p>
          </div>
        </div>
        <div className="px-8 py-8">
          <div className="font-serif text-ink-800 text-lg leading-relaxed whitespace-pre-wrap">
            {letter.body}
          </div>
        </div>
        <div className="border-t border-parchment-200 px-8 py-6 flex items-center justify-center">
          <div className="flex items-center gap-3 text-ink-400">
            <div className="w-8 h-8 rounded-full bg-seal-500/20 border border-seal-500/30 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-seal-500"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            </div>
            <span className="text-sm font-sans italic">
              Delivered to {letter.recipients.length} recipient{letter.recipients.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

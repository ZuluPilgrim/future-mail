/**
 * Setup Page — First-run configuration
 *
 * Shown when no users exist in the database. Presents two paths:
 *
 *   1. Restore from backup — upload or select an existing .fmbak file,
 *      enter the backup key, and the server restores everything then
 *      restarts automatically. No further configuration needed.
 *
 *   2. Fresh setup — 3-step flow:
 *        a. Create admin account (name, email, password)
 *        b. Generate and display backup encryption key
 *        c. Confirm backup key by re-entering it
 *      Then redirected to /setup-mfa to optionally enable 2FA,
 *      then to /admin to configure email settings.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

function Logo() {
  return (
    <div className="text-center mb-10">
      <div className="w-14 h-14 rounded-full bg-seal-500 flex items-center justify-center shadow-md mx-auto mb-4">
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
      </div>
      <h1 className="font-serif text-3xl text-ink-800">FutureMail</h1>
      <p className="font-serif italic text-ink-400 mt-1">First-time setup</p>
    </div>
  );
}

// ── Restore Panel ─────────────────────────────────────────────────────────────
function RestorePanel({ onCancel }) {
  const [backups, setBackups]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [restoring, setRestoring]   = useState(false);
  const [backupKey, setBackupKey]   = useState('');
  const [selected, setSelected]     = useState(null); // filename or 'upload'
  const [uploadBuffer, setUploadBuffer] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/restore/list')
      .then(r => r.json())
      .then(d => { setBackups(d.backups || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.fmbak')) {
      toast.error('Please select a FutureMail backup (.fmbak) file');
      return;
    }
    const buf = await file.arrayBuffer();
    setUploadBuffer(buf);
    setUploadName(file.name);
    setSelected('upload');
    e.target.value = '';
  };

  const handleRestore = async () => {
    if (!selected) { toast.error('Select a backup first'); return; }
    if (!backupKey.trim()) { toast.error('Enter your backup key'); return; }

    setRestoring(true);
    try {
      let res;
      if (selected === 'upload') {
        res = await fetch('/api/auth/restore/from-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-backup-key': backupKey.trim().toUpperCase(),
          },
          body: uploadBuffer,
        });
      } else {
        res = await fetch('/api/auth/restore/from-disk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: selected, backupKey: backupKey.trim().toUpperCase() }),
        });
      }

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      // Server is restarting — show message and poll until it's back
      setRestarting(true);
      toast.success('Restore successful! Server is restarting…');
      pollUntilReady();
    } catch (err) {
      toast.error(err.message);
      setRestoring(false);
    }
  };

  const pollUntilReady = () => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          clearInterval(interval);
          // Reload the page — the restored database means users now exist,
          // so the app will redirect to /login
          window.location.href = '/';
        }
      } catch {
        // Server still restarting — keep polling
      }
    }, 2000);
  };

  if (restarting) return (
    <div className="card p-8 text-center">
      <div className="text-5xl mb-4">🔄</div>
      <h2 className="font-serif text-2xl text-ink-800 mb-3">Restoring…</h2>
      <p className="text-sm font-sans text-ink-500 mb-2">
        The server is restarting with your restored data.
      </p>
      <p className="text-sm font-sans text-ink-400 animate-pulse">
        You will be redirected automatically when ready…
      </p>
    </div>
  );

  return (
    <div className="card p-8 space-y-5">
      <h2 className="font-serif text-xl text-ink-800">Restore from Backup</h2>
      <p className="text-sm font-sans text-ink-500">
        Select a backup file and enter your backup key. All data — users, letters,
        and settings — will be restored. The server will restart automatically.
      </p>

      {/* Existing backups on disk */}
      {loading ? (
        <p className="text-ink-400 font-sans text-sm animate-pulse">Checking for backups…</p>
      ) : backups.length > 0 && (
        <div>
          <p className="text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-2">
            Backups found on server
          </p>
          <div className="space-y-2">
            {backups.map(b => (
              <label key={b.filename} className={`flex items-center gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${
                selected === b.filename ? 'border-ink-600 bg-parchment-50' : 'border-parchment-200 hover:border-ink-400'
              }`}>
                <input type="radio" name="backup" value={b.filename}
                  checked={selected === b.filename}
                  onChange={() => setSelected(b.filename)}
                  className="accent-ink-800" />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-ink-800 truncate">{b.filename}</p>
                  <p className="text-xs text-ink-400 font-sans">
                    {new Date(b.created_at).toLocaleString()} · {(b.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Upload a backup */}
      <div>
        <p className="text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-2">
          Upload a backup file
        </p>
        <div className={`flex items-center gap-3 p-3 rounded-sm border transition-colors ${
          selected === 'upload' ? 'border-ink-600 bg-parchment-50' : 'border-parchment-200'
        }`}>
          <input type="radio" name="backup" value="upload"
            checked={selected === 'upload'}
            onChange={() => {}}
            className="accent-ink-800 shrink-0" />
          <div className="flex-1 min-w-0">
            {uploadName
              ? <p className="font-mono text-xs text-ink-800 truncate">{uploadName}</p>
              : <p className="text-sm font-sans text-ink-400">No file selected</p>
            }
          </div>
          {/* Separate button to open file picker — avoids browser blocking */}
          <label className="btn-ghost text-xs px-3 py-1.5 cursor-pointer shrink-0">
            Browse
            <input type="file" accept=".fmbak" className="hidden" onChange={handleFileSelect} />
          </label>
        </div>
      </div>

      {/* Backup key */}
      <div>
        <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
          Backup Key
        </label>
        <input
          type="text"
          value={backupKey}
          onChange={e => setBackupKey(e.target.value.toUpperCase())}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
          className="input-field font-mono tracking-widest text-center"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      <button
        onClick={handleRestore}
        disabled={restoring || !selected || !backupKey.trim()}
        className="btn-primary w-full"
      >
        {restoring ? 'Restoring…' : 'Restore & Restart'}
      </button>

      <button onClick={onCancel} className="w-full text-center text-sm font-sans text-ink-400 hover:text-ink-700">
        ← Back to setup options
      </button>
    </div>
  );
}

// ── Main Setup Component ──────────────────────────────────────────────────────
export default function Setup() {
  const [step, setStep]             = useState('choose'); // choose | account | backup-key | confirm-key | save-reminder | restore
  const [form, setForm]             = useState({ name: '', email: '', password: '', confirm: '' });
  const [backupKey, setBackupKey]   = useState('');
  const [confirmKey, setConfirmKey] = useState('');
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied]         = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Fetch a generated backup key when we reach that step
  useEffect(() => {
    if (step === 'backup-key' && !backupKey) {
      setLoading(true);
      fetch('/api/auth/backup-key')
        .then(r => r.json())
        .then(d => { setBackupKey(d.key); setLoading(false); })
        .catch(() => { toast.error('Could not generate key'); setLoading(false); });
    }
  }, [step]);

  const handleAccountNext = (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setStep('backup-key');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(backupKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleConfirmNext = (e) => {
    e.preventDefault();
    if (confirmKey.trim().toUpperCase() !== backupKey.trim().toUpperCase()) {
      toast.error('Key does not match — please check and try again');
      return;
    }
    setStep('save-reminder');
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          backupKey: backupKey.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      login(data.token, data.user);
      toast.success('Setup complete. Welcome to FutureMail!');
      navigate('/setup-mfa', { state: { newAccount: true, isAdmin: true } });
    } catch (err) {
      toast.error(err.message || 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step: Choose path ────────────────────────────────────────────────────────
  if (step === 'choose') return (
    <div className="min-h-screen flex items-center justify-center paper-texture px-4">
      <div className="w-full max-w-md animate-fade-in">
        <Logo />
        <div className="card p-8">
          <h2 className="font-serif text-xl text-ink-800 mb-2">Welcome to FutureMail</h2>
          <p className="text-sm font-sans text-ink-500 mb-6">
            No accounts exist yet. Would you like to start fresh or restore a previous installation?
          </p>
          <div className="space-y-3">
            <button onClick={() => setStep('account')} className="btn-primary w-full">
              Start Fresh
            </button>
            <button onClick={() => setStep('restore')} className="btn-ghost w-full">
              Restore from Backup
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Step: Restore ────────────────────────────────────────────────────────────
  if (step === 'restore') return (
    <div className="min-h-screen flex items-center justify-center paper-texture px-4">
      <div className="w-full max-w-md animate-fade-in">
        <Logo />
        <RestorePanel onCancel={() => setStep('choose')} />
      </div>
    </div>
  );

  // ── Step: Account details ────────────────────────────────────────────────────
  if (step === 'account') return (
    <div className="min-h-screen flex items-center justify-center paper-texture px-4">
      <div className="w-full max-w-md animate-fade-in">
        <Logo />
        <div className="card p-8">
          <div className="bg-parchment-100 border border-parchment-300 rounded-sm px-4 py-3 mb-6">
            <p className="text-sm font-sans text-ink-600">
              <strong>Step 1 of 3</strong> — Create your admin account.
            </p>
          </div>
          <h2 className="font-serif text-xl text-ink-800 mb-6">Admin Account</h2>
          <form onSubmit={handleAccountNext} className="space-y-4">
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">Your Name</label>
              <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Admin Name" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">Email</label>
              <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@example.com" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">Password</label>
              <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min. 8 characters" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">Confirm Password</label>
              <input type="password" required value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} placeholder="Repeat password" className="input-field" />
            </div>
            <button type="submit" className="btn-primary w-full mt-2">Continue →</button>
          </form>
          <button onClick={() => setStep('choose')} className="mt-4 w-full text-center text-sm text-ink-400 hover:text-ink-700 font-sans">
            ← Back
          </button>
        </div>
      </div>
    </div>
  );

  // ── Step: Show generated backup key ─────────────────────────────────────────
  if (step === 'backup-key') return (
    <div className="min-h-screen flex items-center justify-center paper-texture px-4">
      <div className="w-full max-w-md animate-fade-in">
        <Logo />
        <div className="card p-8">
          <div className="bg-parchment-100 border border-parchment-300 rounded-sm px-4 py-3 mb-6">
            <p className="text-sm font-sans text-ink-600">
              <strong>Step 2 of 3</strong> — Save your backup encryption key.
            </p>
          </div>
          <h2 className="font-serif text-xl text-ink-800 mb-2">Your Backup Key</h2>
          <p className="text-sm font-sans text-ink-500 mb-6">
            This key encrypts all backups. Without it, backups cannot be restored. It is shown only once — save it to your password manager now.
          </p>
          {loading ? (
            <p className="text-ink-400 font-sans text-sm animate-pulse text-center py-8">Generating key…</p>
          ) : (
            <>
              <div className="bg-ink-900 rounded-sm p-5 mb-4 text-center">
                <p className="font-mono text-xl text-parchment-100 tracking-widest select-all">{backupKey}</p>
              </div>
              <button onClick={handleCopy} className="btn-ghost w-full mb-6 text-sm">
                {copied ? '✓ Copied!' : 'Copy to clipboard'}
              </button>
              <div className="bg-seal-500/10 border border-seal-300 rounded-sm px-4 py-3 mb-6">
                <p className="text-sm font-sans text-seal-700">
                  <strong>⚠ Important:</strong> Store this key in a password manager. If you lose it, encrypted backups cannot be restored.
                </p>
              </div>
              <button onClick={() => setStep('confirm-key')} className="btn-primary w-full">
                I've saved it — Continue →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ── Step: Confirm key by re-entering ────────────────────────────────────────
  if (step === 'confirm-key') return (
    <div className="min-h-screen flex items-center justify-center paper-texture px-4">
      <div className="w-full max-w-md animate-fade-in">
        <Logo />
        <div className="card p-8">
          <div className="bg-parchment-100 border border-parchment-300 rounded-sm px-4 py-3 mb-6">
            <p className="text-sm font-sans text-ink-600">
              <strong>Step 3 of 3</strong> — Confirm your backup key.
            </p>
          </div>
          <h2 className="font-serif text-xl text-ink-800 mb-2">Confirm Backup Key</h2>
          <p className="text-sm font-sans text-ink-500 mb-6">
            Enter your backup key exactly as shown to confirm you have it saved.
          </p>
          <form onSubmit={handleConfirmNext} className="space-y-4">
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">Backup Key</label>
              <input type="text" required value={confirmKey}
                onChange={e => setConfirmKey(e.target.value.toUpperCase())}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                className="input-field font-mono tracking-widest text-center"
                spellCheck={false} autoComplete="off" />
            </div>
            <button type="submit" className="btn-primary w-full">Confirm & Finish Setup</button>
          </form>
          <button onClick={() => setStep('backup-key')} className="mt-4 w-full text-center text-sm text-ink-400 hover:text-ink-700 font-sans">
            ← Back to key
          </button>
        </div>
      </div>
    </div>
  );

  // ── Step: Final confirmation ─────────────────────────────────────────────────
  if (step === 'save-reminder') return (
    <div className="min-h-screen flex items-center justify-center paper-texture px-4">
      <div className="w-full max-w-md animate-fade-in">
        <Logo />
        <div className="card p-8 text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="font-serif text-2xl text-ink-800 mb-3">Ready to go</h2>
          <p className="text-sm font-sans text-ink-500 mb-6">
            Your backup key is confirmed and saved. Click below to create your admin account.
          </p>
          <div className="bg-parchment-100 border border-parchment-200 rounded-sm p-4 mb-6 text-left">
            <p className="text-xs font-sans text-ink-500">
              Your backup key is stored in <code className="bg-white px-1 rounded">backup.key</code> on the server. You will need it when restoring any backup.
            </p>
          </div>
          <button onClick={handleFinalSubmit} disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Creating account…' : 'Complete Setup'}
          </button>
        </div>
      </div>
    </div>
  );

  return null;
}

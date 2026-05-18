import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authHeaders, useAuth } from '../context/AuthContext';

// ─── App Config Panel ─────────────────────────────────────────────────────────
function AppConfigPanel() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    fetch('/api/admin/app-config', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setDomain(d.config.domain || 'localhost'); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/app-config', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ domain }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDomain(d.domain); // reflect any normalisation (stripped protocol etc.)
      toast.success('App settings saved.');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-ink-400 font-sans text-sm animate-pulse">Loading...</p>;

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h3 className="font-serif text-xl text-ink-800 mb-2">Application Settings</h3>
        <p className="text-sm font-sans text-ink-400">
          General settings for this FutureMail instance.
        </p>
      </div>

      {/* Domain */}
      <div>
        <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">
          Domain Name
        </label>
        <input
          type="text"
          value={domain}
          onChange={e => setDomain(e.target.value)}
          placeholder="futuremail.co.nz"
          className="input-field"
        />
        <p className="text-xs text-ink-400 font-sans mt-2">
          Your public domain name without <code className="bg-parchment-100 px-1 rounded">https://</code>.
          Leave blank to use <code className="bg-parchment-100 px-1 rounded">localhost</code>.
          Used in email footers and any links sent to users.
        </p>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}

// ─── SMTP Config Panel ────────────────────────────────────────────────────────
function SmtpPanel() {
  const [config, setConfig] = useState({ host: '', port: 587, user: '', pass: '', from_name: 'FutureMail', from_address: '' });
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch('/api/admin/smtp', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setConfig(d.config); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/smtp', { method: 'POST', headers: authHeaders(), body: JSON.stringify(config) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success('SMTP settings saved.');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/admin/smtp/test', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...config, send_to: testEmail || undefined }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(d.message);
    } catch (err) { toast.error(err.message); }
    finally { setTesting(false); }
  };

  if (loading) return <p className="text-ink-400 font-sans text-sm animate-pulse">Loading SMTP settings...</p>;

  const field = (label, key, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">{label}</label>
      <input type={type} value={config[key] || ''} placeholder={placeholder}
        onChange={e => setConfig({ ...config, [key]: e.target.value })} className="input-field" />
    </div>
  );

  return (
    <div className="card p-6 space-y-4">
      <h3 className="font-serif text-xl text-ink-800 mb-2">Email / SMTP Settings</h3>
      <p className="text-sm font-sans text-ink-400 mb-4">Settings saved here override your .env file.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('SMTP Host', 'host', 'text', 'smtp.server.com')}
        {field('SMTP Port', 'port', 'number', '587')}
        {field('SMTP Username', 'user', 'text', 'you@gmail.com')}
        {field('SMTP Password / App Password', 'pass', 'password', 'App password here')}
        {field('From Name', 'from_name', 'text', 'FutureMail')}
        {field('From Address', 'from_address', 'text', 'noreply@futuremail.co.nz')}
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Settings'}</button>
      </div>
      <div className="border-t border-parchment-200 pt-4 mt-2">
        <p className="text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-3">Test Connection</p>
        <div className="flex gap-3">
          <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
            placeholder="Send test email to... (optional)" className="input-field flex-1" />
          <button onClick={handleTest} disabled={testing} className="btn-ghost shrink-0">
            {testing ? 'Testing...' : 'Test'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Backup Panel ─────────────────────────────────────────────────────────────
function BackupPanel() {
  const [config, setConfig] = useState({ enabled: true, frequency_hours: 24, keep_count: 7 });
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [restoreKey, setRestoreKey] = useState('');
  const [pendingRestore, setPendingRestore] = useState(null); // { type: 'disk'|'upload', filename?, buffer? }
  const [hasKey, setHasKey] = useState(true);

  const FREQ_OPTIONS = [
    { label: 'Every 6 hours', value: 6 },
    { label: 'Every 12 hours', value: 12 },
    { label: 'Every 24 hours (daily)', value: 24 },
    { label: 'Every 48 hours', value: 48 },
    { label: 'Every 7 days', value: 168 },
  ];

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/backup/config', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/admin/backup/list',   { headers: authHeaders() }).then(r => r.json()),
    ]).then(([cfg, lst]) => {
      setConfig({ ...cfg.config, enabled: !!cfg.config.enabled });
      setHasKey(cfg.hasKey !== false);
      setBackups(lst.backups);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const refreshList = () =>
    fetch('/api/admin/backup/list', { headers: authHeaders() })
      .then(r => r.json()).then(d => setBackups(d.backups));

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/backup/config', { method: 'POST', headers: authHeaders(), body: JSON.stringify(config) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success('Backup settings saved.');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    try {
      const res = await fetch('/api/admin/backup/now', { method: 'POST', headers: authHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(d.message);
      await refreshList();
    } catch (err) { toast.error(err.message); }
    finally { setBackingUp(false); }
  };

  const handleDelete = async (filename) => {
    if (!confirm('Delete this backup?')) return;
    try {
      const res = await fetch('/api/admin/backup/' + encodeURIComponent(filename), { method: 'DELETE', headers: authHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success('Backup deleted.');
      await refreshList();
    } catch (err) { toast.error(err.message); }
  };

  const handleDownload = (filename) => {
    const token = localStorage.getItem('fm_token');
    fetch('/api/admin/backup/download/' + encodeURIComponent(filename), {
      headers: { Authorization: 'Bearer ' + token },
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    }).catch(() => toast.error('Download failed'));
  };

  // Start a restore — show key prompt first
  const initiateRestore = (type, filename) => {
    setRestoreKey('');
    setPendingRestore({ type, filename });
  };

  const handleUploadSelect = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.fmbak')) { toast.error('Please select a FutureMail backup (.fmbak) file'); return; }
    const arrayBuffer = await file.arrayBuffer();
    setRestoreKey('');
    setPendingRestore({ type: 'upload', filename: file.name, buffer: arrayBuffer });
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!restoreKey.trim()) { toast.error('Enter your backup key'); return; }
    if (!pendingRestore) return;
    const key = restoreKey.trim().toUpperCase();

    if (!confirm('This will OVERWRITE the current database. The server must be restarted after. Continue?')) return;

    if (pendingRestore.type === 'disk') {
      setRestoring(pendingRestore.filename);
      try {
        const res = await fetch('/api/admin/backup/restore/' + encodeURIComponent(pendingRestore.filename), {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({ backupKey: key }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        toast.success(d.message, { duration: 8000 });
        setPendingRestore(null);
      } catch (err) { toast.error(err.message); }
      finally { setRestoring(null); }
    } else {
      setUploading(true);
      try {
        const res = await fetch('/api/admin/backup/restore-upload', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('fm_token'),
            'Content-Type': 'application/octet-stream',
            'x-backup-key': key,
          },
          body: pendingRestore.buffer,
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        toast.success(d.message, { duration: 8000 });
        setPendingRestore(null);
      } catch (err) { toast.error(err.message); }
      finally { setUploading(false); }
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  if (loading) return <p className="text-ink-400 font-sans text-sm animate-pulse">Loading backup settings...</p>;

  return (
    <div className="space-y-6">

      {/* Restore key prompt modal */}
      {pendingRestore && (
        <div className="fixed inset-0 bg-ink-900/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6">
            <h3 className="font-serif text-xl text-ink-800 mb-2">Enter Backup Key</h3>
            <p className="text-sm font-sans text-ink-500 mb-4">
              Enter the backup key you saved during setup to decrypt{' '}
              <span className="font-mono text-xs">{pendingRestore.filename}</span>.
            </p>
            <input
              type="text"
              value={restoreKey}
              onChange={e => setRestoreKey(e.target.value.toUpperCase())}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
              className="input-field font-mono tracking-widest text-center mb-4"
              autoFocus
              spellCheck={false}
            />
            <div className="flex gap-3">
              <button onClick={handleConfirmRestore} disabled={restoring || uploading} className="btn-primary flex-1">
                {restoring || uploading ? 'Restoring…' : 'Restore'}
              </button>
              <button onClick={() => setPendingRestore(null)} className="btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule config */}
      <div className="card p-6">
        <h3 className="font-serif text-xl text-ink-800 mb-4">Backup Schedule</h3>
        {!hasKey && (
          <div className="bg-seal-500/10 border border-seal-300 rounded-sm px-4 py-3 mb-4">
            <p className="text-sm font-sans text-seal-700">
              ⚠ No backup key found. Backups cannot be created until the backup key is set (stored in <code>backup.key</code>).
            </p>
          </div>
        )}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="backup-enabled" checked={config.enabled}
              onChange={e => setConfig({ ...config, enabled: e.target.checked })} className="w-4 h-4 accent-ink-800" />
            <label htmlFor="backup-enabled" className="text-sm font-sans text-ink-700">Enable automatic backups</label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">Backup Frequency</label>
              <select value={config.frequency_hours}
                onChange={e => setConfig({ ...config, frequency_hours: Number(e.target.value) })} className="input-field">
                {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-sans font-medium tracking-widest uppercase text-ink-500 mb-1.5">Backups to Keep</label>
              <input type="number" min={1} max={30} value={config.keep_count}
                onChange={e => setConfig({ ...config, keep_count: Number(e.target.value) })} className="input-field" />
              <p className="text-xs text-ink-400 font-sans mt-1">Oldest deleted automatically when limit is reached.</p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSaveConfig} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
            <button onClick={handleBackupNow} disabled={backingUp || !hasKey} className="btn-ghost">
              {backingUp ? 'Backing up...' : 'Backup Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Upload restore */}
      <div className="card p-6">
        <h3 className="font-serif text-xl text-ink-800 mb-2">Restore from File</h3>
        <p className="text-sm font-sans text-ink-400 mb-4">
          Upload a previously downloaded backup file (.fmbak). You will be prompted for your backup key. The server must be restarted after restoring.
        </p>
        <label className={'inline-flex items-center gap-2 cursor-pointer btn-ghost ' + (uploading ? 'opacity-50 pointer-events-none' : '')}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
          {uploading ? 'Restoring...' : 'Upload & Restore Backup'}
          <input type="file" accept=".fmbak" className="hidden" onChange={handleUploadSelect} />
        </label>
      </div>

      {/* Backup list */}
      <div className="card p-6">
        <h3 className="font-serif text-xl text-ink-800 mb-4">
          Saved Backups <span className="text-sm font-sans font-normal text-ink-400">({backups.length})</span>
        </h3>
        {backups.length === 0 ? (
          <p className="text-ink-400 font-sans text-sm">No backups yet. Click "Backup Now" to create one.</p>
        ) : (
          <div className="space-y-2">
            {backups.map(b => (
              <div key={b.filename} className="border border-parchment-200 rounded-sm p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-ink-800 truncate">{b.filename}</p>
                  <p className="text-xs text-ink-400 font-sans mt-0.5">
                    {new Date(b.created_at).toLocaleString()} · {formatSize(b.size)} · encrypted
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleDownload(b.filename)}
                    className="text-xs font-sans px-3 py-1.5 border border-parchment-300 text-ink-600 hover:border-ink-600 rounded-sm transition-colors">
                    Download
                  </button>
                  <button onClick={() => initiateRestore('disk', b.filename)} disabled={restoring === b.filename}
                    className="text-xs font-sans px-3 py-1.5 border border-parchment-300 text-ink-600 hover:border-ink-600 rounded-sm transition-colors">
                    {restoring === b.filename ? 'Restoring...' : 'Restore'}
                  </button>
                  <button onClick={() => handleDelete(b.filename)}
                    className="text-xs font-sans px-3 py-1.5 border border-seal-300 text-seal-500 hover:bg-seal-500 hover:text-white rounded-sm transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({ user, currentUserId, onRoleChange, onDelete, onViewLetters, onDisable2FA }) {
  const isSelf = user.id === currentUserId;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-sans font-medium text-ink-800">{user.name}</span>
            <span className={'text-xs px-2 py-0.5 rounded-full font-sans border ' + (user.role === 'admin' ? 'bg-seal-500/10 text-seal-600 border-seal-300' : 'bg-parchment-100 text-ink-500 border-parchment-300')}>
              {user.role}
            </span>
            <span className={'text-xs px-2 py-0.5 rounded-full font-sans border ' + (user.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200')}>
              {user.status}
            </span>
            {user.totp_enabled && (
              <span className="text-xs px-2 py-0.5 rounded-full font-sans border bg-blue-50 text-blue-700 border-blue-200">
                2FA on
              </span>
            )}
            {isSelf && <span className="text-xs text-ink-400 font-sans italic">(you)</span>}
          </div>
          <p className="text-sm text-ink-400 font-sans mt-0.5">{user.email}</p>
          <p className="text-xs text-ink-300 font-sans mt-1">
            {user.stats && user.stats.total || 0} letters · {user.stats && user.stats.pending || 0} pending · Joined {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>
        {!isSelf && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <button onClick={() => onViewLetters(user)} className="text-xs font-sans px-3 py-1.5 border border-parchment-300 text-ink-600 hover:border-ink-600 rounded-sm transition-colors">Letters</button>
            <button onClick={() => onRoleChange(user)} className="text-xs font-sans px-3 py-1.5 border border-parchment-300 text-ink-600 hover:border-ink-600 rounded-sm transition-colors">
              {user.role === 'admin' ? 'Make User' : 'Make Admin'}
            </button>
            {user.totp_enabled && (
              <button onClick={() => onDisable2FA(user)} className="text-xs font-sans px-3 py-1.5 border border-blue-300 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors">
                Disable 2FA
              </button>
            )}
            <button onClick={() => onDelete(user)} className="text-xs font-sans px-3 py-1.5 border border-seal-300 text-seal-500 hover:bg-seal-500 hover:text-white rounded-sm transition-colors">Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Letters Modal ────────────────────────────────────────────────────────────
function LettersModal({ user, onClose }) {
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/users/' + user.id + '/letters', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setLetters(d.letters); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user.id]);

  const cancelLetter = async (id) => {
    if (!confirm('Delete this letter?')) return;
    try {
      const res = await fetch('/api/admin/letters/' + id, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error();
      setLetters(prev => prev.filter(l => l.id !== id));
      toast.success('Letter deleted.');
    } catch { toast.error('Could not delete letter'); }
  };

  const cancelAll = async () => {
    if (!confirm('Delete ALL letters for ' + user.name + '? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/admin/users/' + user.id + '/letters', { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error();
      toast.success('All letters deleted.');
      setLetters([]);
    } catch { toast.error('Could not delete letters'); }
  };

  return (
    <div className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-parchment-200 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-xl text-ink-800">Letters</h3>
            <p className="text-sm text-ink-400 font-sans">{user.name} · {user.email}</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 text-2xl leading-none">x</button>
        </div>
        <div className="p-6 space-y-2">
          {loading ? (
            <p className="text-ink-400 font-sans text-sm animate-pulse">Loading...</p>
          ) : letters.length === 0 ? (
            <p className="text-ink-400 font-sans text-sm">No letters.</p>
          ) : (
            <div>
              {letters.length > 1 && (
                <button onClick={cancelAll} className="btn-danger w-full mb-4">
                  Delete All {letters.length} Letters
                </button>
              )}
              <p className="text-xs font-sans text-ink-400 mb-3 tracking-widest uppercase">
                Letter contents are private and not visible to admins.
              </p>
              {letters.map(l => (
                <div key={l.id} className="border border-parchment-200 rounded-sm p-3 flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${l.sent ? 'bg-green-500' : 'bg-ink-300'}`} />
                    <div>
                      <p className="text-sm font-sans text-ink-700">
                        {l.sent ? 'Sent' : 'Scheduled'}
                      </p>
                      <p className="text-xs text-ink-400 font-sans">
                        {l.sent
                          ? new Date(l.sent_at).toLocaleString()
                          : new Date(l.send_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => cancelLetter(l.id)} className="btn-danger shrink-0 text-xs px-2 py-1">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function Admin() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('users');
  const [viewingLettersFor, setViewingLettersFor] = useState(null);

  useEffect(() => {
    if (tab === 'users') fetchUsers();
  }, [tab]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders() });
      const d = await res.json();
      setUsers(d.users);
    } catch { toast.error('Could not load users'); }
    finally { setLoading(false); }
  };

  const handleRoleChange = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!confirm('Change ' + user.name + "'s role to " + newRole + '?')) return;
    try {
      const res = await fetch('/api/admin/users/' + user.id + '/role', {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ role: newRole }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(d.message);
      fetchUsers();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (user) => {
    if (!confirm('Delete ' + user.name + ' and all their letters? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/admin/users/' + user.id, { method: 'DELETE', headers: authHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(d.message);
      fetchUsers();
    } catch (err) { toast.error(err.message); }
  };

  const handleDisable2FA = async (user) => {
    if (!confirm(`Disable 2FA for ${user.name}? Only do this if they are locked out.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}/2fa`, { method: 'DELETE', headers: authHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(d.message);
      fetchUsers();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <p className="text-xs font-sans tracking-widest uppercase text-ink-400 mb-1">Administration</p>
        <h1 className="font-serif text-4xl text-ink-800">Admin Panel</h1>
      </div>

      <div className="flex gap-1 mb-8 border-b border-parchment-200">
        {[['users', 'User Management'], ['smtp', 'Email Settings'], ['backup', 'Backups'], ['app', 'App Settings']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={'px-5 py-2.5 text-sm font-sans transition-colors border-b-2 -mb-px ' + (tab === key ? 'border-ink-800 text-ink-800 font-medium' : 'border-transparent text-ink-400 hover:text-ink-700')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'smtp'   && <SmtpPanel />}
      {tab === 'backup' && <BackupPanel />}
      {tab === 'app'    && <AppConfigPanel />}
      {tab === 'users' && (
        <div>
          {loading ? (
            <p className="text-ink-400 font-sans animate-pulse">Loading users...</p>
          ) : (
            <div className="space-y-3">
              {users.map(u => (
                <UserRow key={u.id} user={u} currentUserId={currentUser.id}
                  onRoleChange={handleRoleChange} onDelete={handleDelete}
                  onViewLetters={setViewingLettersFor} onDisable2FA={handleDisable2FA} />
              ))}
            </div>
          )}
        </div>
      )}

      {viewingLettersFor && (
        <LettersModal user={viewingLettersFor} onClose={() => setViewingLettersFor(null)} />
      )}
    </div>
  );
}

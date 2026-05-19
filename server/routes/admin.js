const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const auth     = require('../middleware/auth');
const admin    = require('../middleware/admin');
const { userQueries, letterQueries, smtpQueries, backupQueries, appConfigQueries } = require('../db/database');
const { testSmtpConnection, sendTestEmail } = require('../jobs/mailer');
const { createBackup, listBackups, getBackupPath, deleteBackup, restoreFromBuffer, generateBackupKey, saveBackupKey, hasBackupKey } = require('../jobs/backup');

const router = express.Router();
router.use(auth, admin);

// ─── User management ──────────────────────────────────────────────────────────

// GET /api/admin/users
router.get('/users', (req, res) => {
  const users = userQueries.findAll.all();
  const withStats = users.map(u => {
    const stats  = letterQueries.statsForUser.get(u.id);
    const twoFa  = userQueries.getTotpStatus.get(u.id);
    return { ...u, stats, totp_enabled: !!(twoFa && twoFa.totp_enabled) };
  });
  res.json({ users: withStats });
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', (req, res) => {
  const targetId = Number(req.params.id);
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or user' });
  }
  if (role === 'user') {
    const adminCount = userQueries.countAdmins.get().n;
    const target = userQueries.findById.get(targetId);
    if (target?.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last admin account' });
    }
  }
  userQueries.setRole.run(role, targetId);
  res.json({ message: `User role updated to ${role}` });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  const adminCount = userQueries.countAdmins.get().n;
  const target = userQueries.findById.get(targetId);
  if (target?.role === 'admin' && adminCount <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last admin account' });
  }
  userQueries.delete.run(targetId);
  res.json({ message: 'User and all their letters deleted.' });
});

// GET /api/admin/users/:id/letters — dates only, no subject, no body, no recipients
router.get('/users/:id/letters', (req, res) => {
  const letters = letterQueries.adminDatesForUser.all(Number(req.params.id));
  res.json({ letters });
});

// DELETE /api/admin/letters/:id
router.delete('/letters/:id', (req, res) => {
  const result = letterQueries.deleteAdmin.run(Number(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'Letter not found or already sent' });
  res.json({ message: 'Letter cancelled.' });
});

// DELETE /api/admin/users/:id/letters
router.delete('/users/:id/letters', (req, res) => {
  const result = letterQueries.deleteAllForUser.run(Number(req.params.id));
  res.json({ message: `${result.changes} pending letter(s) cancelled.` });
});

// ─── SMTP ─────────────────────────────────────────────────────────────────────

// GET /api/admin/smtp
router.get('/smtp', (req, res) => {
  const config = smtpQueries.get.get();
  if (!config) {
    return res.json({
      config: {
        host: process.env.SMTP_HOST || '',
        port: process.env.SMTP_PORT || 587,
        user: process.env.SMTP_USER || '',
        pass: '',
        from_name: process.env.MAIL_FROM_NAME || 'FutureMail',
        from_address: process.env.MAIL_FROM_ADDRESS || '',
      },
      source: 'env',
    });
  }
  res.json({ config: { ...config, pass: config.pass ? '••••••••' : '' }, source: 'database' });
});

// POST /api/admin/smtp
router.post('/smtp', (req, res) => {
  const { host, port, user, pass, from_name, from_address } = req.body;
  if (!host || !port || !user || !from_address) {
    return res.status(400).json({ error: 'Host, port, user, and from_address are required' });
  }
  let finalPass = pass;
  if (pass === '••••••••') {
    const existing = smtpQueries.get.get();
    finalPass = existing?.pass || '';
  }
  smtpQueries.upsert.run(host, Number(port), user, finalPass, from_name || 'FutureMail', from_address);
  res.json({ message: 'SMTP settings saved.' });
});

// POST /api/admin/smtp/test
router.post('/smtp/test', async (req, res) => {
  const { host, port, user, pass, from_name, from_address, send_to } = req.body;
  let finalPass = pass;
  if (pass === '••••••••') {
    const existing = smtpQueries.get.get();
    finalPass = existing?.pass || '';
  }
  try {
    await testSmtpConnection({ host, port, user, pass: finalPass });
    if (send_to) {
      await sendTestEmail({ host, port, user, pass: finalPass, from_name, from_address }, send_to);
      res.json({ message: `SMTP connected. Test email sent to ${send_to}.` });
    } else {
      res.json({ message: 'SMTP connection successful.' });
    }
  } catch (err) {
    res.status(400).json({ error: `SMTP test failed: ${err.message}` });
  }
});

// ─── Backup ───────────────────────────────────────────────────────────────────

// GET /api/admin/backup/key-status — has a backup key been set?
router.get('/backup/key-status', (req, res) => {
  res.json({ hasKey: hasBackupKey() });
});

// GET /api/admin/backup/config
router.get('/backup/config', (req, res) => {
  const config = backupQueries.get.get() || { enabled: 1, frequency_hours: 24, keep_count: 7 };
  res.json({ config, hasKey: hasBackupKey() });
});

// POST /api/admin/backup/config
router.post('/backup/config', (req, res) => {
  const { enabled, frequency_hours, keep_count } = req.body;
  backupQueries.upsert.run(enabled ? 1 : 0, Number(frequency_hours) || 24, Number(keep_count) || 7);
  res.json({ message: 'Backup settings saved.' });
});

// GET /api/admin/backup/list
router.get('/backup/list', (req, res) => {
  res.json({ backups: listBackups() });
});

// POST /api/admin/backup/now
router.post('/backup/now', async (req, res) => {
  try {
    const config = backupQueries.get.get() || { keep_count: 7 };
    const filename = await createBackup(config.keep_count);
    res.json({ message: 'Backup created.', filename });
  } catch (err) {
    res.status(500).json({ error: `Backup failed: ${err.message}` });
  }
});

// GET /api/admin/backup/download/:filename
router.get('/backup/download/:filename', (req, res) => {
  try {
    const filePath = getBackupPath(req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
    res.download(filePath, req.params.filename);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/admin/backup/:filename
router.delete('/backup/:filename', (req, res) => {
  try {
    deleteBackup(req.params.filename);
    res.json({ message: 'Backup deleted.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/backup/restore/:filename — restore from disk, requires backup key
router.post('/backup/restore/:filename', (req, res) => {
  const { backupKey } = req.body;
  if (!backupKey) return res.status(400).json({ error: 'Backup key is required' });
  try {
    const filePath = getBackupPath(req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
    const encryptedBuffer = fs.readFileSync(filePath);
    const result = restoreFromBuffer(encryptedBuffer, backupKey.trim().toUpperCase());
    res.json({
      message: `Restore complete. Restart the server to apply changes.${result.restoredSecret ? ' Secret key restored.' : ''}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/backup/restore-upload — restore from uploaded file, requires backup key
router.post('/backup/restore-upload',
  express.raw({ type: 'application/octet-stream', limit: '100mb' }),
  (req, res) => {
    const backupKey = req.headers['x-backup-key'];
    if (!backupKey) return res.status(400).json({ error: 'Backup key is required' });
    try {
      if (!req.body || req.body.length === 0) return res.status(400).json({ error: 'No file received' });
      const result = restoreFromBuffer(req.body, backupKey.trim().toUpperCase());
      res.json({
        message: `Restore complete. Restart the server to apply changes.${result.restoredSecret ? ' Secret key restored.' : ''}`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /api/admin/users/:id/2fa — disable 2FA for a user (lockout recovery)
router.delete('/users/:id/2fa', (req, res) => {
  const targetId = Number(req.params.id);
  userQueries.adminDisableTotp.run(targetId);
  res.json({ message: '2FA disabled for user.' });
});

// ─── App config ───────────────────────────────────────────────────────────────

// GET /api/admin/app-config — get current app settings (domain etc.)
router.get('/app-config', (req, res) => {
  const config = appConfigQueries.get.get() || { domain: 'localhost' };
  res.json({ config });
});

// POST /api/admin/app-config — save app settings
router.post('/app-config', (req, res) => {
  let { domain } = req.body;
  // Strip protocol and trailing slash if the user pastes a full URL
  domain = (domain || '').trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  // Default to localhost if left blank
  if (!domain) domain = 'localhost';
  appConfigQueries.upsert.run(domain);
  res.json({ message: 'App settings saved.', domain });
});

module.exports = router;

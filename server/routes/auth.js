const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { userQueries } = require('../db/database');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../jobs/mailer');
const { generateBackupKey, saveBackupKey, listBackups, getBackupPath, restoreFromBuffer, BACKUP_DIR } = require('../jobs/backup');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function generateCode() {
  return String(Math.floor(10000000 + Math.random() * 90000000)); // 8-digit
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// GET /api/auth/setup-status
router.get('/setup-status', (req, res) => {
  const total = userQueries.countTotal.get().n;
  res.json({ needsSetup: total === 0 });
});

// GET /api/auth/restore/list — list available backups (only during first-run)
router.get('/restore/list', (req, res) => {
  const total = userQueries.countTotal.get().n;
  if (total > 0) return res.status(403).json({ error: 'Setup already completed' });
  res.json({ backups: listBackups() });
});

// POST /api/auth/restore/from-disk — restore from an existing backup file (first-run only)
router.post('/restore/from-disk', (req, res) => {
  const total = userQueries.countTotal.get().n;
  if (total > 0) return res.status(403).json({ error: 'Setup already completed' });

  const { filename, backupKey } = req.body;
  if (!filename || !backupKey) {
    return res.status(400).json({ error: 'Filename and backup key are required' });
  }

  try {
    const filePath = getBackupPath(filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup file not found' });
    const encryptedBuffer = fs.readFileSync(filePath);
    restoreFromBuffer(encryptedBuffer, backupKey.trim().toUpperCase());
    res.json({ message: 'Restore successful. Restarting server…' });
    // Restart after a short delay so the response can be sent first
    setTimeout(() => process.exit(0), 1000);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/restore/from-upload — restore from an uploaded backup file (first-run only)
router.post('/restore/from-upload',
  express.raw({ type: 'application/octet-stream', limit: '100mb' }),
  (req, res) => {
    const total = userQueries.countTotal.get().n;
    if (total > 0) return res.status(403).json({ error: 'Setup already completed' });

    const backupKey = req.headers['x-backup-key'];
    if (!backupKey) return res.status(400).json({ error: 'Backup key is required' });
    if (!req.body || req.body.length === 0) return res.status(400).json({ error: 'No file received' });

    try {
      restoreFromBuffer(req.body, backupKey.trim().toUpperCase());
      res.json({ message: 'Restore successful. Restarting server…' });
      setTimeout(() => process.exit(0), 1000);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/auth/backup-key — generate a candidate backup key (only during first-run)
router.get('/backup-key', (req, res) => {
  const total = userQueries.countTotal.get().n;
  if (total > 0) return res.status(403).json({ error: 'Setup already completed' });
  res.json({ key: generateBackupKey() });
});

// POST /api/auth/setup — first admin, no email verification needed
router.post('/setup', async (req, res) => {
  const total = userQueries.countTotal.get().n;
  if (total > 0) {
    return res.status(403).json({ error: 'Setup already completed' });
  }

  const { name, email, password, backupKey } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (!backupKey) {
    return res.status(400).json({ error: 'Backup key confirmation is required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    saveBackupKey(backupKey.trim().toUpperCase());

    const hash = await bcrypt.hash(password, 12);
    const result = userQueries.create.run(name.trim(), email.toLowerCase(), hash, 'admin', 'SETUP');
    userQueries.activate.run(result.lastInsertRowid);

    const adminUser = { id: result.lastInsertRowid, email: email.toLowerCase(), name: name.trim(), role: 'admin' };
    const token = signToken(adminUser);

    console.log(`[FutureMail] First admin created: ${email}`);
    res.status(201).json({ message: 'Admin account created.', token, user: adminUser });
  } catch (err) {
    console.error('Setup error:', err);
    res.status(500).json({ error: 'Server error during setup' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  // Clean up expired pending accounts before registering
  userQueries.deleteExpiredPending.run();

  const total = userQueries.countTotal.get().n;
  if (total === 0) {
    return res.status(403).json({ error: 'Please complete admin setup first' });
  }

  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = userQueries.findByEmail.get(email.toLowerCase());
    if (existing) {
      if (existing.status === 'active') {
        return res.status(409).json({ error: 'An active account with that email already exists. Please log in or reset your password.' });
      }
      // Pending but not yet expired — tell them to check their email
      return res.status(409).json({
        error: 'A verification email was already sent to this address. Please check your inbox or request a new code.',
        needsVerification: true,
        email: existing.email,
      });
    }

    const hash = await bcrypt.hash(password, 12);
    const code = generateCode();
    userQueries.create.run(name.trim(), email.toLowerCase(), hash, 'user', code);

    try {
      await sendVerificationEmail(email.toLowerCase(), name.trim(), code);
    } catch (mailErr) {
      console.warn('[FutureMail] Could not send verification email:', mailErr.message);
    }

    res.status(201).json({ message: 'Account created. Check your email for the verification code. It expires in 30 minutes.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  const user = userQueries.checkCode.get(email.toLowerCase(), code.trim());
  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired code. Codes expire after 30 minutes.' });
  }

  userQueries.activate.run(user.id);

  const token = signToken(user);
  res.json({
    message: 'Account verified and activated.',
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// POST /api/auth/resend-code
router.post('/resend-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = userQueries.findByEmail.get(email.toLowerCase());
  if (!user || user.status !== 'pending') {
    return res.status(400).json({ error: 'No pending account found for that email' });
  }

  const code = generateCode();
  userQueries.refreshCode.run(code, user.id);

  try {
    await sendVerificationEmail(user.email, user.name, code);
    res.json({ message: 'Verification code resent. It expires in 30 minutes.' });
  } catch (err) {
    console.error('Resend code error:', err);
    res.status(500).json({ error: 'Could not send email. Check SMTP settings.' });
  }
});

// POST /api/auth/forgot-password — request a reset code
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Always return success to avoid leaking which emails are registered
  const user = userQueries.findByEmail.get(email.toLowerCase());
  if (!user || user.status !== 'active') {
    return res.json({ message: 'If that email is registered, a reset code has been sent.' });
  }

  const code = generateCode();
  userQueries.setResetCode.run(code, user.id);

  try {
    await sendPasswordResetEmail(user.email, user.name, code);
  } catch (err) {
    console.error('Password reset email error:', err);
    return res.status(500).json({ error: 'Could not send reset email. Check SMTP settings.' });
  }

  res.json({ message: 'If that email is registered, a reset code has been sent.' });
});

// POST /api/auth/reset-password — submit code and new password
router.post('/reset-password', async (req, res) => {
  const { email, code, password } = req.body;
  if (!email || !code || !password) {
    return res.status(400).json({ error: 'Email, code and new password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const user = userQueries.checkResetCode.get(email.toLowerCase(), code.trim());
  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired reset code. Codes expire after 30 minutes.' });
  }

  const hash = await bcrypt.hash(password, 12);
  userQueries.updatePassword.run(hash, user.id);

  res.json({ message: 'Password reset successfully. You can now log in.' });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = userQueries.findByEmail.get(email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    if (user.status === 'pending') {
      return res.status(403).json({
        error: 'Account not verified. Please check your email for the verification code.',
        needsVerification: true,
        email: user.email,
      });
    }

    // Check if 2FA is enabled — if so, issue a short-lived partial token
    // instead of the full token. The client must complete /api/2fa/validate.
    if (user.totp_enabled) {
      const jwt = require('jsonwebtoken');
      const tempToken = jwt.sign(
        { id: user.id, email: user.email, requires2FA: true },
        process.env.JWT_SECRET,
        { expiresIn: '5m' } // short-lived — just for the 2FA step
      );
      return res.json({ requires2FA: true, tempToken });
    }

    const token = signToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = userQueries.findById.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

module.exports = router;


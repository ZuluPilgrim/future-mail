/**
 * Two-Factor Authentication Routes (TOTP)
 *
 * Implements RFC 6238 TOTP-based 2FA compatible with any authenticator app
 * that supports the standard — Proton Authenticator, Google Authenticator,
 * Authy, Bitwarden, 1Password, etc.
 *
 * Flow:
 *   1. POST /setup      — generates a TOTP secret + QR code (not yet active)
 *   2. POST /verify-setup — user confirms with a live code; activates 2FA +
 *                          returns one-time recovery codes
 *   3. POST /disable    — deactivates 2FA (requires password confirmation)
 *   4. POST /validate   — called during login when 2FA is active; accepts
 *                          either a TOTP code or a recovery code
 *
 * Admin:
 *   Admin can disable 2FA for any user via the admin panel (for lockout recovery).
 *
 * Recovery codes:
 *   8 codes, each 10 characters, shown once at setup. Stored as a
 *   JSON array of bcrypt hashes — each can only be used once.
 */
const express    = require('express');
const speakeasy  = require('speakeasy');
const qrcode     = require('qrcode');
const bcrypt     = require('bcryptjs');
const { userQueries, db } = require('../db/database');
const auth       = require('../middleware/auth');

const router = express.Router();

// NOTE: auth middleware is applied per-route below.
// /validate is intentionally public — it uses its own tempToken verification.

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate 8 random recovery codes */
function generateRecoveryCodes() {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    // 10 uppercase alphanumeric chars grouped as XXXXX-XXXXX
    const raw = Array.from({ length: 10 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('');
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

/** Hash all recovery codes for storage */
async function hashRecoveryCodes(codes) {
  return Promise.all(codes.map(c => bcrypt.hash(c, 10)));
}

/** Check a submitted recovery code against stored hashes; returns index if valid */
async function findValidRecoveryCode(submitted, hashes) {
  for (let i = 0; i < hashes.length; i++) {
    if (hashes[i] && await bcrypt.compare(submitted.toUpperCase(), hashes[i])) {
      return i;
    }
  }
  return -1;
}

// ── GET /api/2fa/status ───────────────────────────────────────────────────────
// Returns whether 2FA is currently enabled for the logged-in user.
router.get('/status', auth, (req, res) => {
  const row = userQueries.getTotpStatus.get(req.user.id);
  res.json({ enabled: !!(row && row.totp_enabled) });
});

// ── POST /api/2fa/setup ───────────────────────────────────────────────────────
// Generates a new TOTP secret and returns a QR code data URL.
// 2FA is NOT yet active — the user must confirm with /verify-setup.
router.post('/setup', auth, async (req, res) => {
  const row = userQueries.getTotpStatus.get(req.user.id);
  if (row && row.totp_enabled) {
    return res.status(400).json({ error: '2FA is already enabled' });
  }

  // Generate a new secret
  const secret = speakeasy.generateSecret({
    name:   `FutureMail (${req.user.email})`,
    issuer: 'FutureMail',
    length: 20,
  });

  // Save the pending secret (not yet enabled)
  userQueries.setTotpSecret.run(secret.base32, req.user.id);

  // Generate QR code as a data URL the frontend can display in an <img>
  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);

  res.json({
    secret:   secret.base32,   // shown as text fallback for manual entry
    qrCode:   qrDataUrl,       // data:image/png;base64,...
  });
});

// ── POST /api/2fa/verify-setup ────────────────────────────────────────────────
// Confirms the user has scanned the QR code and the app is generating
// valid codes. Activates 2FA and returns one-time recovery codes.
router.post('/verify-setup', auth, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Verification code is required' });

  const row = userQueries.getTotpStatus.get(req.user.id);
  if (!row || !row.totp_secret) {
    return res.status(400).json({ error: 'No pending 2FA setup found. Start setup again.' });
  }
  if (row.totp_enabled) {
    return res.status(400).json({ error: '2FA is already enabled' });
  }

  // Verify the code against the pending secret
  const valid = speakeasy.totp.verify({
    secret:   row.totp_secret,
    encoding: 'base32',
    token:    code.replace(/\s/g, ''),
    window:   1, // allow 1 step drift (±30 seconds)
  });

  if (!valid) {
    return res.status(400).json({ error: 'Invalid code — check your authenticator app and try again' });
  }

  // Generate and hash recovery codes
  const recoveryCodes  = generateRecoveryCodes();
  const hashedCodes    = await hashRecoveryCodes(recoveryCodes);

  // Enable 2FA
  userQueries.enableTotp.run(row.totp_secret, JSON.stringify(hashedCodes), req.user.id);

  res.json({
    message:       '2FA enabled successfully.',
    recoveryCodes, // shown once — user must save these
  });
});

// ── POST /api/2fa/disable ─────────────────────────────────────────────────────
// Disables 2FA. Requires the user's password as confirmation.
router.post('/disable', auth, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required to disable 2FA' });

  const user = userQueries.findByEmail.get(req.user.email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) return res.status(401).json({ error: 'Incorrect password' });

  const row = userQueries.getTotpStatus.get(req.user.id);
  if (!row || !row.totp_enabled) {
    return res.status(400).json({ error: '2FA is not enabled' });
  }

  userQueries.disableTotp.run(req.user.id);
  res.json({ message: '2FA disabled.' });
});

// ── POST /api/2fa/validate ────────────────────────────────────────────────────
// Called during the login second step. Accepts either:
//   - A 6-digit TOTP code from the authenticator app
//   - A recovery code (XXXXX-XXXXX format)
// On success returns a full JWT (the initial login only returned a partial token).
router.post('/validate', async (req, res) => {
  const { code, tempToken } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });

  // Validate the temp token passed from the first login step
  const jwt = require('jsonwebtoken');
  let payload;
  try {
    payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (!payload.requires2FA) throw new Error('Invalid token type');
  } catch {
    return res.status(403).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  const user = userQueries.findByEmail.get(payload.email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const row = userQueries.getTotpStatus.get(user.id);
  if (!row || !row.totp_enabled) {
    return res.status(400).json({ error: '2FA is not enabled for this account' });
  }

  const cleanCode = code.replace(/\s|-/g, '').toUpperCase();

  // Try TOTP first (6 digits)
  if (/^\d{6}$/.test(cleanCode)) {
    const valid = speakeasy.totp.verify({
      secret:   row.totp_secret,
      encoding: 'base32',
      token:    cleanCode,
      window:   1,
    });
    if (!valid) return res.status(401).json({ error: 'Invalid code' });
  } else {
    // Try recovery code
    const storedHashes = JSON.parse(row.totp_recovery || '[]');
    // Re-add dashes for comparison
    const formattedCode = cleanCode.length === 10
      ? `${cleanCode.slice(0, 5)}-${cleanCode.slice(5)}`
      : code.trim().toUpperCase();

    const idx = await findValidRecoveryCode(formattedCode, storedHashes);
    if (idx === -1) return res.status(401).json({ error: 'Invalid recovery code' });

    // Invalidate the used recovery code
    storedHashes[idx] = null;
    db.prepare(`UPDATE users SET totp_recovery = ? WHERE id = ?`)
      .run(JSON.stringify(storedHashes), user.id);
  }

  // Issue the full JWT
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

module.exports = router;

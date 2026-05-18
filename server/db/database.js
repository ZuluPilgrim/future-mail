/**
 * Database — SQLite Setup and Query Definitions
 *
 * Uses better-sqlite3-multiple-ciphers for AES-256 encryption at rest.
 * The encryption key is derived from secret.key using SHA-256 so the
 * database key is distinct from the JWT signing key even though both
 * come from the same source file.
 *
 * All queries are defined as prepared statements for performance and
 * to prevent SQL injection. Organised into four groups:
 *   userQueries   — account management, verification, password reset, 2FA
 *   letterQueries — scheduling, listing, and sending letters
 *   smtpQueries   — SMTP configuration (read by mailer on every send)
 *   backupQueries — backup schedule configuration
 *
 * 2FA columns on users table (added via safe migration):
 *   totp_secret   — base32 TOTP secret (null when 2FA disabled)
 *   totp_enabled  — 0 or 1
 *   totp_recovery — JSON array of bcrypt-hashed one-time recovery codes
 *
 * Privacy note:
 *   Admin-facing letter queries return dates only — no subject or body.
 *   The body is only fetched by the email scheduler (findDue) and by
 *   the owner viewing a sent letter (findByIdOwner).
 */
const Database = require('better-sqlite3-multiple-ciphers');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

const DB_PATH  = path.join(process.env.DATA_DIR || path.join(__dirname, '../../'), 'futuremail.db');
const KEY_PATH = path.join(process.env.DATA_DIR || path.join(__dirname, '../../'), 'secret.key');

/**
 * Derives the database encryption key from secret.key.
 * The 'db:' prefix ensures the derived key is different from
 * the JWT secret even if the same source material is used.
 * Creates secret.key if it doesn't exist yet.
 */
function getDbKey() {
  if (!fs.existsSync(KEY_PATH)) {
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(KEY_PATH, secret, { mode: 0o600 });
  }
  const secret = fs.readFileSync(KEY_PATH, 'utf8').trim();
  return crypto.createHash('sha256').update('db:' + secret).digest('hex');
}

const dbKey = getDbKey();
const db = new Database(DB_PATH);
db.pragma(`key='${dbKey}'`);        // Must be set before any other operations
db.pragma('journal_mode = WAL');    // Write-Ahead Logging for better concurrency
db.pragma('foreign_keys = ON');     // Enforce referential integrity

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'user',
    status          TEXT NOT NULL DEFAULT 'pending',
    verify_code     TEXT,
    verify_expires  DATETIME,
    reset_code      TEXT,
    reset_expires   DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS letters (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    subject     TEXT NOT NULL,
    body        TEXT NOT NULL,
    recipients  TEXT NOT NULL,
    send_at     DATETIME NOT NULL,
    sent        INTEGER DEFAULT 0,
    sent_at     DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS smtp_config (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    host         TEXT,
    port         INTEGER,
    user         TEXT,
    pass         TEXT,
    from_name    TEXT,
    from_address TEXT,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS backup_config (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    enabled         INTEGER DEFAULT 1,
    frequency_hours INTEGER DEFAULT 24,
    keep_count      INTEGER DEFAULT 7,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_config (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    domain      TEXT DEFAULT 'localhost',
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Seed default app config if not present
  INSERT OR IGNORE INTO app_config (id, domain) VALUES (1, 'localhost');

  CREATE INDEX IF NOT EXISTS idx_letters_send_at ON letters(send_at);
  CREATE INDEX IF NOT EXISTS idx_letters_user    ON letters(user_id);
`);

// Safe migrations for existing installs
try { db.exec(`ALTER TABLE users ADD COLUMN reset_code TEXT`); }          catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN reset_expires DATETIME`); }   catch {}
try { db.exec(`ALTER TABLE letters ADD COLUMN sent INTEGER DEFAULT 0`); }  catch {}
try { db.exec(`ALTER TABLE letters ADD COLUMN sent_at DATETIME`); }       catch {}
// 2FA columns
try { db.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT`); }              catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN totp_recovery TEXT`); }            catch {}

// ─── User queries ─────────────────────────────────────────────────────────────
const userQueries = {
  create: db.prepare(`
    INSERT INTO users (name, email, password_hash, role, status, verify_code, verify_expires)
    VALUES (?, ?, ?, ?, 'pending', ?, datetime('now', '+30 minutes'))
  `),
  findByEmail:  db.prepare(`SELECT * FROM users WHERE email = ?`),
  findById:     db.prepare(`SELECT id, name, email, role, status, created_at FROM users WHERE id = ?`),
  findAll:      db.prepare(`SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC`),
  activate:     db.prepare(`UPDATE users SET status = 'active', verify_code = NULL, verify_expires = NULL WHERE id = ?`),
  setRole:      db.prepare(`UPDATE users SET role = ? WHERE id = ?`),
  delete:       db.prepare(`DELETE FROM users WHERE id = ?`),
  countAdmins:  db.prepare(`SELECT COUNT(*) as n FROM users WHERE role = 'admin'`),
  countTotal:   db.prepare(`SELECT COUNT(*) as n FROM users`),
  checkCode:    db.prepare(`
    SELECT * FROM users
    WHERE email = ? AND verify_code = ? AND verify_expires > datetime('now') AND status = 'pending'
  `),
  refreshCode:  db.prepare(`
    UPDATE users SET verify_code = ?, verify_expires = datetime('now', '+30 minutes') WHERE id = ?
  `),
  setResetCode: db.prepare(`
    UPDATE users SET reset_code = ?, reset_expires = datetime('now', '+30 minutes') WHERE id = ?
  `),
  checkResetCode: db.prepare(`
    SELECT * FROM users
    WHERE email = ? AND reset_code = ? AND reset_expires > datetime('now') AND status = 'active'
  `),
  updatePassword: db.prepare(`
    UPDATE users SET password_hash = ?, reset_code = NULL, reset_expires = NULL WHERE id = ?
  `),
  deleteExpiredPending: db.prepare(`
    DELETE FROM users WHERE status = 'pending' AND verify_expires < datetime('now') AND role != 'admin'
  `),
  // 2FA queries
  setTotpSecret:   db.prepare(`UPDATE users SET totp_secret = ? WHERE id = ?`),
  enableTotp:      db.prepare(`UPDATE users SET totp_enabled = 1, totp_secret = ?, totp_recovery = ? WHERE id = ?`),
  disableTotp:     db.prepare(`UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_recovery = NULL WHERE id = ?`),
  getTotpStatus:   db.prepare(`SELECT totp_enabled, totp_secret, totp_recovery FROM users WHERE id = ?`),
  adminDisableTotp: db.prepare(`UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_recovery = NULL WHERE id = ?`),
};

// ─── Letter queries ───────────────────────────────────────────────────────────
const letterQueries = {
  create: db.prepare(`
    INSERT INTO letters (user_id, subject, body, recipients, send_at)
    VALUES (?, ?, ?, ?, ?)
  `),
  // User list — pending shows subject+date only (no body), sent shows subject+date (body fetched separately)
  findByUser: db.prepare(`
    SELECT id, subject, recipients, send_at, sent, sent_at, created_at
    FROM letters WHERE user_id = ? ORDER BY send_at ASC
  `),
  // Full letter including body — only for sent letters viewed by owner
  findByIdOwner: db.prepare(`SELECT * FROM letters WHERE id = ? AND user_id = ? AND sent = 1`),
  // Metadata only — used for cancel confirmation (no body ever for pending)
  findByIdPending: db.prepare(`
    SELECT id, subject, recipients, send_at, created_at
    FROM letters WHERE id = ? AND user_id = ? AND sent = 0
  `),
  delete:           db.prepare(`DELETE FROM letters WHERE id = ? AND user_id = ?`),
  // Admin queries — dates only, no subject, no body, no recipients
  adminDatesForUser: db.prepare(`
    SELECT id, send_at, sent, sent_at FROM letters WHERE user_id = ? ORDER BY send_at ASC
  `),
  deleteAdmin:      db.prepare(`DELETE FROM letters WHERE id = ?`),
  deleteAllForUser: db.prepare(`DELETE FROM letters WHERE user_id = ?`),
  deletePendingForUser: db.prepare(`DELETE FROM letters WHERE user_id = ? AND sent = 0`),
  findDue: db.prepare(`
    SELECT l.id, l.subject, l.body, l.recipients FROM letters l
    JOIN users u ON l.user_id = u.id
    WHERE l.sent = 0
      AND replace(replace(l.send_at, 'T', ' '), 'Z', '') <= datetime('now')
      AND u.status = 'active'
  `),
  markSent: db.prepare(`UPDATE letters SET sent = 1, sent_at = datetime('now') WHERE id = ?`),
  stats: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN sent = 0 THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN sent = 1 THEN 1 ELSE 0 END) as delivered
    FROM letters WHERE user_id = ?
  `),
  statsForUser: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN sent = 0 THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN sent = 1 THEN 1 ELSE 0 END) as delivered
    FROM letters WHERE user_id = ?
  `),
};

// ─── SMTP config queries ──────────────────────────────────────────────────────
const smtpQueries = {
  get: db.prepare(`SELECT * FROM smtp_config WHERE id = 1`),
  upsert: db.prepare(`
    INSERT INTO smtp_config (id, host, port, user, pass, from_name, from_address, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      host = excluded.host, port = excluded.port,
      user = excluded.user, pass = excluded.pass,
      from_name = excluded.from_name, from_address = excluded.from_address,
      updated_at = excluded.updated_at
  `),
};

// ─── Backup config queries ────────────────────────────────────────────────────
const backupQueries = {
  get: db.prepare(`SELECT * FROM backup_config WHERE id = 1`),
  upsert: db.prepare(`
    INSERT INTO backup_config (id, enabled, frequency_hours, keep_count, updated_at)
    VALUES (1, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      enabled = excluded.enabled,
      frequency_hours = excluded.frequency_hours,
      keep_count = excluded.keep_count,
      updated_at = excluded.updated_at
  `),
};

// ─── App config queries ───────────────────────────────────────────────────────
// Stores global application settings such as the public domain name.
// The domain is used in email footers and any links sent to users.
const appConfigQueries = {
  get: db.prepare(`SELECT * FROM app_config WHERE id = 1`),
  upsert: db.prepare(`
    INSERT INTO app_config (id, domain, updated_at)
    VALUES (1, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      domain = excluded.domain,
      updated_at = excluded.updated_at
  `),
};

module.exports = { db, userQueries, letterQueries, smtpQueries, backupQueries, appConfigQueries };

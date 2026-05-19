/**
 * FutureMail — Server Entry Point
 *
 * Responsibilities:
 *  - Resolves the data directory (DATA_DIR env var in Docker, project root locally)
 *  - Auto-generates JWT secret (secret.key) on first run
 *  - Loads optional .env for port override
 *  - Mounts API routes under /api
 *      /api/auth    — registration, login, verification, password reset
 *      /api/letters — letter CRUD for authenticated users
 *      /api/admin   — admin-only: users, SMTP, backups, app config
 *      /api/2fa     — TOTP two-factor authentication setup and validation
 *  - Serves the React build in production
 *  - Starts the email delivery and backup schedulers
 *
 * Data directory:
 *  In Docker: DATA_DIR=/data (mounted volume)
 *  Locally:   project root (futuremail.db, secret.key etc. next to package.json)
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ── Data directory ────────────────────────────────────────────────────────────
// All persistent files (db, keys, backups) live here.
// Docker sets DATA_DIR=/data via the volume mount.
// Local dev defaults to the project root.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
// Make it available to other modules via environment
process.env.DATA_DIR = DATA_DIR;

// Ensure the backups subdirectory exists
fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });

// ── Auto-generate JWT secret ──────────────────────────────────────────────────
// secret.key is created on first run and reused on subsequent starts.
// Deleting it logs everyone out (all tokens become invalid).
const secretPath = path.join(DATA_DIR, 'secret.key');
if (!process.env.JWT_SECRET) {
  if (fs.existsSync(secretPath)) {
    process.env.JWT_SECRET = fs.readFileSync(secretPath, 'utf8').trim();
  } else {
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretPath, secret, { mode: 0o600 });
    process.env.JWT_SECRET = secret;
    console.log('[FutureMail] Generated new JWT secret → secret.key');
  }
}

// ── Optional .env (only needed to override PORT) ──────────────────────────────
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const express = require('express');
const cors    = require('cors');

const authRoutes     = require('./routes/auth');
const letterRoutes   = require('./routes/letters');
const adminRoutes    = require('./routes/admin');
const twoFactorRoutes = require('./routes/twoFactor');
const { startEmailScheduler }  = require('./jobs/emailSender');
const { startBackupScheduler } = require('./jobs/backup');
const { backupQueries }        = require('./db/database');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  // In development the Vite dev server runs on :5173; in production we serve
  // the built React app directly from Express so CORS is not needed.
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/2fa',     twoFactorRoutes);

// Public app config — domain name for frontend display
app.get('/api/app-config', (req, res) => {
  const { appConfigQueries } = require('./db/database');
  const config = appConfigQueries.get.get() || { domain: 'localhost' };
  res.json({ domain: config.domain });
});

// Health check — used by monitoring tools and the frontend setup-status check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Serve React build in production ──────────────────────────────────────────
// Run `npm run build` first to generate client/dist
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  // All non-API routes fall through to the React SPA
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── TLS / HTTPS ───────────────────────────────────────────────────────────────
// When HTTPS_ENABLED=true (set in docker-compose or .env), FutureMail will:
//   1. Auto-generate a self-signed certificate on first run (stored in DATA_DIR)
//   2. Serve over HTTPS instead of HTTP
//   3. Redirect all HTTP traffic to HTTPS
//
// The certificate is valid for 10 years and is regenerated if missing.
// Browsers will show a security warning for self-signed certs — you can
// suppress this by importing the cert into your OS/browser trust store,
// or by replacing the generated cert with one from a real CA (e.g. Let's Encrypt).

const HTTPS_ENABLED = (process.env.HTTPS_ENABLED || 'true').toLowerCase() === 'true';
const CERT_DIR  = path.join(DATA_DIR, 'certs');
const CERT_PATH = path.join(CERT_DIR, 'cert.pem');
const KEY_PATH  = path.join(CERT_DIR, 'key.pem');

function ensureSelfSignedCert() {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
    console.log('[FutureMail] Generating self-signed TLS certificate...');
    try {
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_PATH}" -out "${CERT_PATH}" ` +
        `-days 3650 -nodes -subj "/CN=futuremail/O=FutureMail/C=NZ" ` +
        `-addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
        { stdio: 'pipe' }
      );
      fs.chmodSync(KEY_PATH, 0o600);
      console.log('[FutureMail] Self-signed certificate generated → data/certs/');
      console.log('[FutureMail] To trust it, import data/certs/cert.pem into your OS/browser.');
    } catch (err) {
      console.error('[FutureMail] Failed to generate certificate:', err.message);
      console.error('[FutureMail] Falling back to HTTP.');
      return false;
    }
  }
  return true;
}

// ── Start server ──────────────────────────────────────────────────────────────
if (HTTPS_ENABLED && ensureSelfSignedCert()) {
  const https = require('https');
  const http  = require('http');

  const tlsOptions = {
    key:  fs.readFileSync(KEY_PATH),
    cert: fs.readFileSync(CERT_PATH),
  };

  // HTTPS server on PORT (default 3001)
  https.createServer(tlsOptions, app).listen(PORT, () => {
    console.log(`\n🔒 FutureMail running on https://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Certificate: ${CERT_PATH}\n`);
  });

  // HTTP redirect on PORT+1 (e.g. 3002 → redirects to HTTPS on 3001)
  const HTTP_REDIRECT_PORT = parseInt(PORT, 10) + 1;
  http.createServer((req, res) => {
    const host = (req.headers.host || 'localhost').replace(`:${HTTP_REDIRECT_PORT}`, `:${PORT}`);
    res.writeHead(301, { Location: `https://${host}${req.url}` });
    res.end();
  }).listen(HTTP_REDIRECT_PORT, () => {
    console.log(`   HTTP redirect: port ${HTTP_REDIRECT_PORT} → HTTPS port ${PORT}`);
  });

} else {
  // Plain HTTP fallback
  const http = require('http');
  http.createServer(app).listen(PORT, () => {
    console.log(`\n🚀 FutureMail running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
}

// ── Start background schedulers ───────────────────────────────────────────────
startEmailScheduler();
// Pass a getter so the scheduler always reads the latest DB config
startBackupScheduler(() => backupQueries.get.get());

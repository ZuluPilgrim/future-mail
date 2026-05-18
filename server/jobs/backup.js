/**
 * Backup Manager
 *
 * Handles creation, encryption, listing, download, and restoration
 * of FutureMail backups. Each backup is an AES-256-GCM encrypted
 * archive (.fmbak) containing the database and secret.key.
 *
 * Encryption key:
 *   Set during first-run setup and stored in backup.key on the server.
 *   The key is also shown to the admin during setup and must be saved
 *   to a password manager — it is required to restore any backup.
 *   The key is derived into a 32-byte AES key via SHA-256.
 *
 * Backup format:
 *   magic(8 bytes) + iv(12) + auth tag(16) + AES-256-GCM ciphertext
 *   The ciphertext is a ZIP archive containing futuremail.db and secret.key.
 *
 * Scheduler:
 *   startBackupScheduler() runs a cron job based on the frequency stored
 *   in the database (set via Admin → Backups). Re-checks config every hour
 *   so changes take effect without a restart.
 *
 * Exports:
 *   createBackup()         — create a new encrypted backup now
 *   listBackups()          — list all .fmbak files in the backups folder
 *   getBackupPath()        — safely resolve a backup filename (no traversal)
 *   deleteBackup()         — delete a backup file by name
 *   restoreFromBuffer()    — decrypt and restore from a buffer (requires key)
 *   startBackupScheduler() — start the cron-based auto-backup
 *   generateBackupKey()    — generate a new human-readable key (setup only)
 *   saveBackupKey()        — write the confirmed key to backup.key
 *   hasBackupKey()         — check if backup.key exists
 */
const fs     = require('fs');
const path   = require('path');
const cron   = require('node-cron');
const crypto = require('crypto');

const ROOT_DIR        = process.env.DATA_DIR || path.join(__dirname, '../../');
const DB_PATH         = path.join(ROOT_DIR, 'futuremail.db');
const SECRET_PATH     = path.join(ROOT_DIR, 'secret.key');
const BACKUP_KEY_PATH = path.join(ROOT_DIR, 'backup.key');
const BACKUP_DIR      = path.join(ROOT_DIR, 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { mode: 0o700 });
}

// ─── Backup key management ────────────────────────────────────────────────────

function generateBackupKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const groups = [];
  for (let g = 0; g < 5; g++) {
    let group = '';
    for (let i = 0; i < 5; i++) group += chars[crypto.randomInt(chars.length)];
    groups.push(group);
  }
  return groups.join('-');
}

function saveBackupKey(key) {
  fs.writeFileSync(BACKUP_KEY_PATH, key, { mode: 0o600 });
}

function getBackupKey() {
  if (!fs.existsSync(BACKUP_KEY_PATH)) return null;
  return fs.readFileSync(BACKUP_KEY_PATH, 'utf8').trim();
}

function hasBackupKey() {
  return fs.existsSync(BACKUP_KEY_PATH);
}

// ─── AES-256-GCM encryption ───────────────────────────────────────────────────

function deriveAesKey(backupKey) {
  return crypto.createHash('sha256').update('backup:' + backupKey).digest();
}

function encryptData(data, backupKey) {
  const key    = deriveAesKey(backupKey);
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag    = cipher.getAuthTag();
  // Layout: magic(8) + iv(12) + tag(16) + ciphertext
  return Buffer.concat([Buffer.from('FMBACKUP'), iv, tag, encrypted]);
}

function decryptData(data, backupKey) {
  if (data.slice(0, 8).toString('utf8') !== 'FMBACKUP') {
    throw new Error('Not a FutureMail encrypted backup');
  }
  const iv        = data.slice(8, 20);
  const tag       = data.slice(20, 36);
  const encrypted = data.slice(36);
  const key       = deriveAesKey(backupKey);
  const decipher  = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    throw new Error('Invalid backup key — cannot decrypt backup');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('futuremail-backup-') && f.endsWith('.fmbak'))
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, size: stat.size, created_at: stat.mtime.toISOString() };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function pruneBackups(keepCount) {
  const backups = listBackups();
  if (backups.length <= keepCount) return;
  for (const b of backups.slice(keepCount)) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, b.filename));
      console.log(`[Backup] 🗑  Pruned: ${b.filename}`);
    } catch (e) {
      console.warn(`[Backup] Could not delete ${b.filename}:`, e.message);
    }
  }
}

// ─── Minimal ZIP builder (stored, no compression) ────────────────────────────

function buildZip(files) {
  const entries = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBytes   = Buffer.from(name, 'utf8');
    const crc         = crc32(data);
    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc >>> 0, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBytes.copy(localHeader, 30);
    entries.push({ name, nameBytes, data, crc, offset, localHeader });
    offset += localHeader.length + data.length;
  }

  const cdParts = [];
  let cdSize = 0;
  const cdOffset = offset;

  for (const e of entries) {
    const cd = Buffer.alloc(46 + e.nameBytes.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(e.crc >>> 0, 16);
    cd.writeUInt32LE(e.data.length, 20);
    cd.writeUInt32LE(e.data.length, 24);
    cd.writeUInt16LE(e.nameBytes.length, 28);
    cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38); cd.writeUInt32LE(e.offset, 42);
    e.nameBytes.copy(cd, 46);
    cdParts.push(cd);
    cdSize += cd.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([
    ...entries.flatMap(e => [e.localHeader, e.data]),
    ...cdParts,
    eocd,
  ]);
}

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ -1);
}

function parseZip(buf) {
  const entries = [];
  let i = 0;
  while (i < buf.length - 4) {
    if (buf.readUInt32LE(i) !== 0x04034b50) { i++; continue; }
    const nameLen   = buf.readUInt16LE(i + 26);
    const extraLen  = buf.readUInt16LE(i + 28);
    const dataSize  = buf.readUInt32LE(i + 22);
    const nameStart = i + 30;
    const dataStart = nameStart + nameLen + extraLen;
    entries.push({
      name: buf.slice(nameStart, nameStart + nameLen).toString('utf8'),
      data: buf.slice(dataStart, dataStart + dataSize),
    });
    i = dataStart + dataSize;
  }
  return entries;
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function createBackup(keepCount = 7) {
  const backupKey = getBackupKey();
  if (!backupKey) throw new Error('No backup key set. Complete setup first.');

  const name    = `futuremail-backup-${timestamp()}.fmbak`;
  const outPath = path.join(BACKUP_DIR, name);
  const TEMP_DB = path.join(BACKUP_DIR, '_backup_temp.db');

  // Use SQLite's online backup API via VACUUM INTO to get a clean,
  // fully-checkpointed copy of the database including all WAL data.
  // This avoids the issue of WAL files holding unflushed writes.
  try {
    const Database = require('better-sqlite3-multiple-ciphers');
    const dbKey = (() => {
      const crypto = require('crypto');
      const secret = fs.readFileSync(SECRET_PATH, 'utf8').trim();
      return crypto.createHash('sha256').update('db:' + secret).digest('hex');
    })();

    // Open the live database and vacuum into a temp file
    const liveDb = new Database(DB_PATH);
    liveDb.pragma(`key='${dbKey}'`);
    liveDb.pragma('wal_checkpoint(TRUNCATE)'); // flush WAL first
    liveDb.exec(`VACUUM INTO '${TEMP_DB}'`);   // clean copy with all data
    liveDb.close();

    const files = [];
    files.push({ name: 'futuremail.db', data: fs.readFileSync(TEMP_DB) });
    if (fs.existsSync(SECRET_PATH)) {
      files.push({ name: 'secret.key', data: fs.readFileSync(SECRET_PATH) });
    }

    const zipData       = buildZip(files);
    const encryptedData = encryptData(zipData, backupKey);
    fs.writeFileSync(outPath, encryptedData);
    console.log(`[Backup] ✅ Created: ${name} (${(encryptedData.length / 1024).toFixed(1)} KB, encrypted)`);

    pruneBackups(keepCount);
    return name;
  } finally {
    // Always clean up the temp file
    if (fs.existsSync(TEMP_DB)) fs.unlinkSync(TEMP_DB);
  }
}

function getBackupPath(filename) {
  const safe = path.basename(filename);
  if (!safe.startsWith('futuremail-backup-') || !safe.endsWith('.fmbak')) {
    throw new Error('Invalid backup filename');
  }
  return path.join(BACKUP_DIR, safe);
}

function deleteBackup(filename) {
  const filePath = getBackupPath(filename);
  if (!fs.existsSync(filePath)) throw new Error('Backup not found');
  fs.unlinkSync(filePath);
}

function restoreFromBuffer(encryptedBuffer, backupKey) {
  if (!backupKey) throw new Error('Backup key is required to restore');

  let zipBuffer;
  try {
    zipBuffer = decryptData(encryptedBuffer, backupKey);
  } catch (err) {
    throw new Error(err.message || 'Could not decrypt — check your backup key');
  }

  const entries = parseZip(zipBuffer);
  const db = entries.find(e => e.name === 'futuremail.db');
  if (!db) throw new Error('Invalid backup: database not found in archive');

  fs.writeFileSync(DB_PATH, db.data);

  // Remove any leftover WAL journal files from the previously running database.
  // If these are left behind they will be inconsistent with the restored DB
  // and cause SQLite to throw SQLITE_NOTADB on next startup.
  for (const ext of ['-shm', '-wal']) {
    const walFile = DB_PATH + ext;
    if (fs.existsSync(walFile)) {
      fs.unlinkSync(walFile);
      console.log(`[Restore] 🗑  Removed stale journal file: ${walFile}`);
    }
  }

  const secret = entries.find(e => e.name === 'secret.key');
  if (secret) fs.writeFileSync(SECRET_PATH, secret.data, { mode: 0o600 });

  return { restoredSecret: !!secret };
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

let scheduledTask = null;

function startBackupScheduler(getConfig) {
  let lastFreq = null;

  function schedule() {
    const config = getConfig();
    if (!config || !config.enabled) {
      if (scheduledTask) { scheduledTask.stop(); scheduledTask = null; }
      return;
    }
    const freqHours = config.frequency_hours || 24;
    if (freqHours === lastFreq && scheduledTask) return;
    if (scheduledTask) scheduledTask.stop();
    lastFreq = freqHours;

    let cronExpr;
    if (freqHours < 1)         cronExpr = '*/30 * * * *';
    else if (freqHours === 1)  cronExpr = '0 * * * *';
    else if (freqHours <= 6)   cronExpr = `0 */${freqHours} * * *`;
    else if (freqHours === 12) cronExpr = '0 0,12 * * *';
    else                       cronExpr = '0 2 * * *';

    scheduledTask = cron.schedule(cronExpr, async () => {
      const cfg = getConfig();
      if (!cfg || !cfg.enabled) return;
      try { await createBackup(cfg.keep_count || 7); }
      catch (err) { console.error('[Backup] Scheduled backup failed:', err.message); }
    });

    console.log(`[Backup] ✅ Scheduler active — every ${freqHours}h (${cronExpr})`);
  }

  schedule();
  cron.schedule('0 * * * *', schedule);
}

module.exports = {
  createBackup, listBackups, getBackupPath, deleteBackup,
  restoreFromBuffer, startBackupScheduler, BACKUP_DIR,
  generateBackupKey, saveBackupKey, hasBackupKey,
};

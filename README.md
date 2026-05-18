# ✉ FutureMail v4.7

A self-hosted, cross-platform email time capsule app. Write letters today, deliver them to anyone in the future.

---

## Disclaimer

Please don't roast me for AI slop, this was just a proof of concept. For context, the last time I wrote production code was in 1993, in Pascal. Since then, my work has been more about leadership, architecture, security principles, and understanding how systems fit together. I also haven't had time to test it thoroughly, but at first glance it works as intended and I am very happy with, and may I say, impressed by the result.

All I was trying to gain was an understanding of how this crazy new world of AI works, and whether I could deliver a half‑decent, albeit simple product with very little practical experience in this field.

This code is used at your own risk and has not been audited in any way.

---

## Features

- **Two-factor authentication** — optional TOTP 2FA (Proton Authenticator, Google Authenticator, Authy, etc.)
- **Schedule emails** to any date in the future (days, months, or years ahead)
- **Multiple recipients** per letter (up to 20)
- **User accounts** with email verification (8-digit code, 30-minute window)
- **Privacy by design** — pending letter contents are sealed; only the sender can read delivered letters; admins see dates only
- **Admin panel** — manage users, roles, SMTP, backups, and app settings
- **Multiple admins** — promote any user to admin role
- **Auto-delivery** — cron job checks every 5 minutes; retries on failure
- **Encrypted database** — AES-256 at rest via SQLite3MultipleCiphers
- **Encrypted backups** — `.fmbak` files protected by a backup key set during setup
- **Restore at setup** — restore a previous installation before creating any accounts
- **Zero config** — no `.env` file required; everything configured in-app
- **100% self-hosted** — no third-party services required

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express |
| Database | SQLite encrypted via `better-sqlite3-multiple-ciphers` |
| Scheduler | `node-cron` (email delivery + account cleanup) |
| Email | Nodemailer (any SMTP provider) |
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Auth | JWT (auto-generated secret) + bcryptjs |

---

## Docker Deployment

Docker is the recommended way to run FutureMail on a server.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed (included with Docker Desktop)

See `README-Docker.md` for the full Docker deployment guide.

### Quick start

```bash
# Unzip the project, then from the project root:
docker compose up -d --build
```

Open `http://yourserver:3008` in your browser. The first-run setup wizard appears automatically.

### Persistent data

All data lives in a `./data` folder next to `docker-compose.yml`:

| File | Purpose |
|---|---|
| `./data/futuremail.db` | AES-256 encrypted SQLite database |
| `./data/secret.key` | JWT + DB encryption source — never delete |
| `./data/backup.key` | Backup encryption key — set during setup |
| `./data/backups/` | Encrypted `.fmbak` backup files |

Data survives container restarts and image rebuilds.

### Changing the port

Open `docker-compose.yml` and change the left number on the ports line:

```yaml
ports:
  - "3008:3001"   # change 3008 to your preferred port
```

### Useful commands

```bash
docker compose up -d           # Start in background
docker compose down            # Stop
docker compose logs -f         # View live logs
docker compose up -d --build   # Rebuild after code changes
docker compose exec futuremail sh  # Shell inside container
docker compose ps              # Check container health
```

### Running behind a reverse proxy (Nginx / Caddy)

For HTTPS and a custom domain, put a reverse proxy in front. Example with Caddy:

```yaml
services:
  futuremail:
    build: .
    restart: unless-stopped
    volumes:
      - ./data:/data
    expose:
      - "3001"

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
    depends_on:
      - futuremail

volumes:
  caddy-data:
```

`Caddyfile`:
```
futuremail.co.nz {
    reverse_proxy futuremail:3001
}
```

Caddy handles HTTPS certificates automatically via Let's Encrypt.

---

## Running Locally (without Docker)

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org). Node 22 LTS recommended.
- An **SMTP account** for sending mail — configured in-app after setup.

### 1. Install

**Using the install script (recommended):**

> **Note:** `install.sh` is included inside `future-mail-v4.7.zip`. Extract it along with the zip file to your `~/Downloads` folder before running the steps below. If you saved them elsewhere, move them there first or update the paths accordingly.

```bash
# Make it executable (only needed once)
chmod +x ~/Downloads/install.sh

# Run it
~/Downloads/install.sh
```

**Or manually:**

```bash
mkdir ~/future-mail && cd ~/future-mail
unzip ~/Downloads/future-mail-v4.7.zip
mv future-mail/* . && mv future-mail/.* . 2>/dev/null
rm -rf ~/Downloads/future-mail
npm install
cd client && npm install && cd ..
npm run dev
```

### 2. Run

```bash
npm run dev
```

No `.env` file needed. Open `http://localhost:5173` in your browser.

- Frontend (dev): `http://localhost:5173`
- Backend API: `http://localhost:3001`

### 3. First-time setup (in the browser)

On a fresh install the app presents two options:

**Restore from backup** — upload or select an existing `.fmbak` file, enter your backup key, and the server restores everything and restarts automatically. No further configuration needed.

**Start fresh** — a three-step wizard:
1. Create admin account (name, email, password)
2. Save your backup encryption key — shown once, store in a password manager
3. Confirm backup key by re-entering it

You are then asked if you want to set up 2FA, then taken to the admin panel to configure email settings.

---

## Admin Panel

Access via the **Admin** link in the navigation bar (admin accounts only).

### User Management
- View all users with their status, role, and letter counts
- Promote or demote users to/from admin (last admin cannot be removed)
- Delete a user and all their letters
- View a user's letter schedule (dates only — contents are private)
- Delete individual or all letters for a user
- Disable 2FA for a locked-out user

### Email Settings
Configure SMTP credentials — see [Email Setup](#email-setup) below.

### Backups
- Set auto-backup frequency (6h / 12h / 24h / 48h / 7 days)
- Set how many backups to keep (oldest pruned automatically)
- **Backup Now** — create a backup immediately
- **Download** — save a backup file to your computer
- **Restore** — restore from a listed backup (requires backup key)
- **Upload & Restore** — restore from a downloaded `.fmbak` file (requires backup key)

### App Settings
- Set your public **domain name** (e.g. `futuremail.co.nz`)
- Leave blank to default to `localhost`
- Used in email footers and any links sent to users

---

## Email Setup

### Option A — Gmail with App Password (simplest)

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. **Security** → **2-Step Verification** (must be enabled)
3. **App passwords** → generate one for "Mail"
4. In FutureMail: **Admin → Email Settings**, enter:

| Field | Value |
|---|---|
| SMTP Host | `smtp.gmail.com` |
| SMTP Port | `587` |
| SMTP Username | `your@gmail.com` |
| SMTP Password | the 16-character app password |
| From Name | `FutureMail` (or anything you like) |
| From Address | `noreply@yourdomain.com` |

---

### Option B — Custom Domain via Cloudflare + Gmail

This lets emails appear to come from `noreply@yourdomain.com` while still being delivered through Gmail's servers. It requires a domain managed by Cloudflare.

#### Step 1 — Enable Cloudflare Email Routing

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com) and select your domain
2. In the left sidebar go to **Email → Email Routing**
3. Click **Enable Email Routing** — Cloudflare will add the required MX records automatically
4. Under **Routing Rules → Custom addresses**, click **Create address**:
   - Custom address: `noreply`
   - Destination: `your.personal@gmail.com`
5. Save — emails sent to `noreply@yourdomain.com` will now forward to your Gmail

#### Step 2 — Add a "Send mail as" alias in Gmail

1. In Gmail → **Settings (⚙)** → **See all settings**
2. Go to the **Accounts and Import** tab
3. Under **Send mail as** → click **Add another email address**
4. Fill in:
   - Name: `FutureMail`
   - Email: `noreply@yourdomain.com`
   - Uncheck **Treat as an alias**
5. Click **Next Step** → choose **Send through Gmail's servers**
6. Gmail sends a confirmation code to `noreply@yourdomain.com` — because Cloudflare is forwarding it, you will receive it in your Gmail inbox
7. Enter the code to confirm the alias

#### Step 3 — Add DNS records in Cloudflare

**SPF record:**

| Type | Name | Content | TTL |
|---|---|---|---|
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | Auto |

**DMARC record:**

| Type | Name | Content | TTL |
|---|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:noreply@yourdomain.com` | Auto |

> DKIM is handled automatically by Gmail when using "Send mail as" through Gmail's servers.

#### Step 4 — Configure FutureMail

| Field | Value |
|---|---|
| SMTP Host | `smtp.gmail.com` |
| SMTP Port | `587` |
| SMTP Username | `your.personal@gmail.com` |
| SMTP Password | Gmail App Password |
| From Name | `FutureMail` |
| From Address | `noreply@yourdomain.com` |

Verify at [mxtoolbox.com/spf.aspx](https://mxtoolbox.com/spf.aspx).

---

## Security

| Layer | Protection |
|---|---|
| Database | AES-256 encrypted at rest (SQLite3MultipleCiphers) |
| Backups | AES-256-GCM encrypted, require backup key to restore |
| Passwords | bcrypt hashed (cost factor 12) |
| Sessions | JWT signed with auto-generated secret (HS256, 7-day expiry) |
| Pending letters | Body and subject never returned by any API endpoint |
| Admin view | Dates only — no subject, no body, no recipients |
| 2FA | TOTP (RFC 6238) — optional per user, compatible with any TOTP app |

---

## Two-Factor Authentication (2FA)

2FA is optional and per-user. When enabled, login requires a password plus a 6-digit code from an authenticator app.

### Supported apps

Any TOTP-compatible app — **Proton Authenticator**, Google Authenticator, Authy, Bitwarden, 1Password, or any RFC 6238 TOTP app.

### Enabling 2FA

1. Log in and click **Security** in the navigation bar
2. Click **Enable 2FA**
3. Open your authenticator app and either scan the QR code, or use **Manual entry**:
   - **Account:** FutureMail
   - **Key:** the base32 secret shown on screen (Copy button provided)
   - **Type:** Time-based (TOTP)
4. Enter the 6-digit code to confirm it's working
5. **Save your recovery codes** — shown once, store in a password manager

### Logging in with 2FA

After email and password, you will be prompted for your 6-digit code. Click **Use a recovery code instead** if you've lost access to your app.

### Admin — resetting a locked-out user

Go to **Admin → User Management** — a **Disable 2FA** button appears next to users who have it enabled.

---

## Running as a Background Service (PM2)

```bash
npm install -g pm2
pm2 start server/index.js --name futuremail --interpreter $(which node)
pm2 save
pm2 startup   # Copy and run the command it prints
```

```bash
pm2 status              # Check if it's running
pm2 logs futuremail     # View live logs
pm2 restart futuremail  # Apply code changes
pm2 stop futuremail     # Stop the app
```

---

## Project Structure

```
future-mail/
├── server/
│   ├── index.js              # Express entry point, auto-generates secret.key
│   ├── routes/
│   │   ├── auth.js           # Registration, login (with 2FA step), verification, password reset
│   │   ├── letters.js        # Letter CRUD (owner only)
│   │   ├── admin.js          # User management, SMTP, backups, app config
│   │   └── twoFactor.js      # TOTP 2FA setup, verify, disable, validate
│   ├── jobs/
│   │   ├── emailSender.js    # Cron: deliver letters + clean expired accounts
│   │   ├── mailer.js         # Nodemailer helpers (verification, reset, test)
│   │   └── backup.js         # Encrypted backup creation and restore
│   ├── middleware/
│   │   ├── auth.js           # JWT verification
│   │   └── admin.js          # Admin role check
│   └── db/
│       └── database.js       # Encrypted SQLite schema + all prepared queries
├── client/src/
│   ├── App.jsx               # Router and route guards
│   ├── context/
│   │   └── AuthContext.jsx   # Global auth state and JWT helpers
│   ├── components/
│   │   └── Layout.jsx        # Navigation shell for authenticated pages
│   └── pages/
│       ├── Setup.jsx         # First-run: restore or create admin + backup key
│       ├── Login.jsx         # Sign in
│       ├── Register.jsx      # New user registration
│       ├── Verify.jsx        # 8-digit code entry (2-min resend cooldown)
│       ├── ForgotPassword.jsx     # Request reset code
│       ├── ResetPassword.jsx      # Enter code + new password
│       ├── Dashboard.jsx          # Letter list (sealed pending / readable delivered)
│       ├── Compose.jsx            # Write and schedule a letter
│       ├── LetterDetail.jsx       # View a delivered letter
│       ├── TwoFactorSettings.jsx  # Enable/disable 2FA, QR + manual entry
│       ├── TwoFactorLogin.jsx     # 2FA code entry step during login
│       ├── SetupMFAPrompt.jsx     # Post-registration 2FA prompt
│       └── Admin.jsx              # Admin panel (users, email, backups, app config)
├── Dockerfile                # Multi-stage Docker build
├── docker-compose.yml        # Docker Compose configuration
├── .dockerignore             # Files excluded from Docker image
├── README.md                 # This file
├── README-Docker.md          # Full Docker deployment guide
├── install.sh                # Local install script
├── ABOUT.md                  # Project background and story
├── secret.key                # Auto-generated — never delete
├── backup.key                # Set during setup — required to restore backups
├── futuremail.db             # AES-256 encrypted SQLite database
└── .env.example              # Optional — only needed to change port
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/app-config` | No | Get public app config (domain) |
| GET | `/api/auth/setup-status` | No | Is first-run setup needed? |
| GET | `/api/auth/backup-key` | No | Generate a backup key (setup only) |
| GET | `/api/auth/restore/list` | No | List available backups (setup only) |
| POST | `/api/auth/restore/from-disk` | No | Restore from server backup (setup only) |
| POST | `/api/auth/restore/from-upload` | No | Restore from uploaded file (setup only) |
| POST | `/api/auth/setup` | No | Create first admin account |
| POST | `/api/auth/register` | No | Register a new user |
| POST | `/api/auth/verify` | No | Submit 8-digit verification code |
| POST | `/api/auth/resend-code` | No | Resend verification email |
| POST | `/api/auth/login` | No | Sign in, receive JWT |
| GET | `/api/auth/me` | Yes | Get current user |
| POST | `/api/auth/forgot-password` | No | Request password reset code |
| POST | `/api/auth/reset-password` | No | Submit reset code + new password |
| GET | `/api/letters` | Yes | List own letters + stats |
| POST | `/api/letters` | Yes | Schedule a new letter |
| GET | `/api/letters/:id` | Yes | View a delivered letter (owner only) |
| DELETE | `/api/letters/:id` | Yes | Delete any own letter |
| GET | `/api/admin/users` | Admin | List all users with stats |
| PATCH | `/api/admin/users/:id/role` | Admin | Change user role |
| DELETE | `/api/admin/users/:id` | Admin | Delete user + all their letters |
| DELETE | `/api/admin/users/:id/2fa` | Admin | Disable 2FA for any user |
| GET | `/api/admin/users/:id/letters` | Admin | List letter dates for a user |
| DELETE | `/api/admin/letters/:id` | Admin | Delete any letter |
| DELETE | `/api/admin/users/:id/letters` | Admin | Delete all letters for a user |
| GET | `/api/admin/smtp` | Admin | Get SMTP config |
| POST | `/api/admin/smtp` | Admin | Save SMTP config |
| POST | `/api/admin/smtp/test` | Admin | Test SMTP connection |
| GET | `/api/admin/backup/config` | Admin | Get backup schedule config |
| POST | `/api/admin/backup/config` | Admin | Save backup schedule |
| GET | `/api/admin/backup/list` | Admin | List backup files |
| POST | `/api/admin/backup/now` | Admin | Create backup immediately |
| GET | `/api/admin/backup/download/:f` | Admin | Download a backup file |
| DELETE | `/api/admin/backup/:f` | Admin | Delete a backup file |
| POST | `/api/admin/backup/restore/:f` | Admin | Restore from stored backup |
| POST | `/api/admin/backup/restore-upload` | Admin | Restore from uploaded file |
| GET | `/api/admin/app-config` | Admin | Get app settings (domain) |
| POST | `/api/admin/app-config` | Admin | Save app settings |
| GET | `/api/2fa/status` | Yes | Is 2FA enabled for current user? |
| POST | `/api/2fa/setup` | Yes | Generate TOTP secret + QR code |
| POST | `/api/2fa/verify-setup` | Yes | Confirm code, activate 2FA, get recovery codes |
| POST | `/api/2fa/disable` | Yes | Disable 2FA (requires password) |
| POST | `/api/2fa/validate` | No* | Complete login with TOTP or recovery code |

---

## Backup & Recovery

Backups are stored as encrypted `.fmbak` files. Three things are needed to restore:

1. The `.fmbak` file
2. The **backup key** (set during first-run setup — save to a password manager)
3. A running FutureMail instance to restore into

On a fresh install, choose **Restore from backup** at the setup screen. The server restores everything and restarts automatically — no further configuration needed.

Keep off-site copies of your backups and `backup.key` for disaster recovery.

---

## License

MIT — do whatever you want with it.

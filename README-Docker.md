# FutureMail v4.72 — Docker Deployment Guide

---

## System Prerequisites

Before you begin, ensure the following are installed on your server or machine:

### Docker Engine
Required to build and run the container.

**Linux (Ubuntu / Debian):**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

**macOS / Windows:**
Download and install **Docker Desktop** from [docs.docker.com/get-docker](https://docs.docker.com/get-docker/)

Verify installation:
```bash
docker --version
# Should print: Docker version 24.x.x or higher
```

### Docker Compose
Required to run the `docker compose` command.

Docker Compose is **included with Docker Desktop** on macOS and Windows.

On Linux, verify it is available:
```bash
docker compose version
# Should print: Docker Compose version v2.x.x or higher
```

If not installed on Linux:
```bash
sudo apt install docker-compose-plugin
```

---

## Installation

> **Note:** The steps below assume `future-mail-v4.72.zip` was downloaded to your `~/Downloads` folder. If you saved it elsewhere, adjust the path accordingly.

### Step 1 — Extract the zip

```bash
mkdir ~/future-mail && cd ~/future-mail
unzip ~/Downloads/future-mail-v4.72.zip
mv future-mail/* . && mv future-mail/.* . 2>/dev/null
rm -rf ~/Downloads/future-mail
```

### Step 2 — Configure your ports (optional)

By default FutureMail runs HTTPS on port **3008** with an HTTP redirect on port **3009**. To use different ports, open `docker-compose.yml` and change the left numbers:

```yaml
ports:
  - "3008:3001"   # HTTPS — change 3008 to your preferred port
  - "3009:3002"   # HTTP redirect — keep this one port higher than above
```

Leave this step out to use the defaults.

### Step 3 — Build and start

```bash
docker compose up -d --build
```

Docker will:
1. Build the React frontend
2. Compile the native SQLite encryption module
3. Package everything into a container image
4. Start the container in the background

> **Note:** The first build takes **3–5 minutes**. Subsequent starts are instant as the image is cached.

### Step 4 — Open in your browser

```
https://localhost:3008
```

Or if running on a remote server, replace `localhost` with the **IP address or hostname** of that server:

```
https://192.168.1.100:3008
https://yourserver.local:3008
https://futuremail.co.nz:3008
```

> **Certificate warning:** Your browser will display a security warning because the certificate is self-signed. This is expected. Click through it:
> - **Chrome / Edge:** "Advanced" → "Proceed to ... (unsafe)"
> - **Firefox:** "Advanced" → "Accept the Risk and Continue"
>
> To permanently remove the warning, import `./data/certs/cert.pem` into your OS or browser trust store. See the **Trusting the Certificate** section below.

The first-run setup wizard will appear automatically. Follow the steps to:
1. Create your admin account
2. Save your backup encryption key
3. Configure email settings in the admin console

---

## Persistent Data

All data is stored in a `./data` folder created automatically next to your `docker-compose.yml` file. This makes your data easy to find, back up, and manage — no Docker volume commands needed.

```
~/future-mail/
  data/
    futuremail.db    — AES-256 encrypted database
    secret.key       — JWT + database encryption source key
    backup.key       — backup file encryption key
    backups/         — encrypted .fmbak backup files
    certs/
      cert.pem       — self-signed TLS certificate (auto-generated)
      key.pem        — TLS private key (auto-generated, permissions 600)
```

This folder persists across container restarts, rebuilds, and updates.

---

## Changing the Port

Open `docker-compose.yml` and change the left numbers on both ports lines:

```yaml
ports:
  - "3008:3001"   # HTTPS — change 3008 to any port you want
  - "3009:3002"   # HTTP redirect — keep this one port higher than above
```

The right numbers (`3001`, `3002`) are internal container ports — never change those. Then restart:
```bash
docker compose up -d
```

Access the app at `https://localhost:3008` (or your server's IP/hostname on that port).

---

## Trusting the Certificate

The self-signed certificate is saved at `./data/certs/cert.pem`. Importing it into your trust store removes the browser warning permanently.

**Linux:**
```bash
sudo cp data/certs/cert.pem /usr/local/share/ca-certificates/futuremail.crt
sudo update-ca-certificates
```

**Windows:**
Double-click `cert.pem` → Install Certificate → Local Machine → "Trusted Root Certification Authorities" → Finish.

**macOS:**
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain data/certs/cert.pem
```

The certificate is valid for 10 years and is auto-regenerated if deleted.

---

## Disabling HTTPS

To revert to plain HTTP, edit `docker-compose.yml`:

```yaml
ports:
  - "3008:3001"
environment:
  - HTTPS_ENABLED=false
```

Then restart:
```bash
docker compose up -d
```

---

## Useful Commands

| Task | Command |
|---|---|
| Start in background | `docker compose up -d` |
| Stop | `docker compose down` |
| View live logs | `docker compose logs -f` |
| Rebuild after code changes | `docker compose up -d --build` |
| Open a shell inside container | `docker compose exec futuremail sh` |
| Check container status | `docker compose ps` |
| **Stop and delete all data** | `docker compose down && rm -rf ./data` |

> ⚠ Deleting `./data` permanently removes the database, keys, and all backups. Only do this to start completely fresh.

---

## Updating FutureMail

To update to a new version without losing data:

```bash
# Stop the running container (./data folder is preserved)
docker compose down

# Extract the new version over the top
unzip ~/Downloads/future-mail-vX.X.zip
mv future-mail/* . && mv future-mail/.* . 2>/dev/null
rm -rf ~/Downloads/future-mail

# Rebuild and restart
docker compose up -d --build
```

Your database, keys, and backups in `./data` are untouched.

---

## Backing Up Your Data

The FutureMail admin panel (Admin → Backups) handles encrypted application-level backups. For a full copy of all data files simply copy the `./data` folder:

```bash
cp -r ~/future-mail/data ~/future-mail-backup-$(date +%Y%m%d)
```

> Keep a copy of your **backup.key** file separately and securely — it is required to restore any `.fmbak` backup created by the application.

---

## Troubleshooting

**Running without Docker (local install)**
HTTPS is enabled by default and requires `openssl` to be installed on the host machine. Linux and macOS have it by default. On Windows it must be installed separately — see [slproweb.com/products/Win32OpenSSL.html](https://slproweb.com/products/Win32OpenSSL.html). To disable HTTPS for a local install, add `HTTPS_ENABLED=false` to a `.env` file in the project root. Docker deployments are unaffected — `openssl` is installed automatically inside the container.

**Build fails with a compilation error**
The native SQLite encryption module needs build tools. These are installed automatically inside the container. If the build fails, ensure your Docker daemon has internet access to pull the base Alpine image.

**Port already in use**
Change the port number in `docker-compose.yml` as described above, then run `docker compose up -d`.

**Container starts but browser shows nothing**
Check the logs:
```bash
docker compose logs futuremail
```

**Cannot reach the app from another machine**
Ensure both ports are open in your server's firewall. On Ubuntu:
```bash
sudo ufw allow 3008/tcp   # HTTPS
sudo ufw allow 3009/tcp   # HTTP redirect
```
Replace the numbers with your chosen ports.

**Reset everything and start completely fresh**
```bash
docker compose down
rm -rf ./data
docker compose up -d --build
```

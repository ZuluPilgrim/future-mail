# FutureMail v4.7 — Docker Deployment Guide

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

> **Note:** The steps below assume `future-mail-v4.7.zip` was downloaded to your `~/Downloads` folder. If you saved it elsewhere, adjust the path accordingly.

### Step 1 — Extract the zip

```bash
mkdir ~/future-mail && cd ~/future-mail
unzip ~/Downloads/future-mail-v4.7.zip
mv future-mail/* . && mv future-mail/.* . 2>/dev/null
rm -rf ~/Downloads/future-mail
```

### Step 2 — Configure your port (optional)

By default FutureMail runs on port **3008**. To use a different port, open `docker-compose.yml` and change the left number on the ports line:

```yaml
ports:
  - "3008:3001"   # change 3008 to your preferred port
```

Leave this step out to use the default port 3008.

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
http://localhost:3008
```

Or if running on a remote server, replace `localhost` with the **IP address or hostname** of that server:

```
http://192.168.1.100:3001
http://yourserver.local:3001
http://futuremail.co.nz:3001
```

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
```

This folder persists across container restarts, rebuilds, and updates.

---

## Changing the Port

Open `docker-compose.yml` and change the left number on the ports line:

```yaml
ports:
  - "3008:3001"   # change 3008 to any port you want
```

The right number (`3001`) is the internal container port — never change that. Only the left number (the host port) needs updating.

Then restart:
```bash
docker compose up -d
```

Access the app at `http://localhost:3008` (or your server's IP/hostname on that port).

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
Ensure the port is open in your server's firewall. On Ubuntu:
```bash
sudo ufw allow 3008/tcp
```
Replace `3001` with your chosen port.

**Reset everything and start completely fresh**
```bash
docker compose down
rm -rf ./data
docker compose up -d --build
```

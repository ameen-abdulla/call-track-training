# Call Track Training — Windows Installer & Deployment Architecture (Operator Guide)

## Overview

Call Track Training is packaged into a **single-file Windows installer executable** (`CallTrackTraining-Setup-<version>.exe`) targeting Windows 10/11 x64.

The client machine requires **no pre-installed dependencies**:
- ❌ No Node.js / npm
- ❌ No Git
- ❌ No Docker
- ❌ No Prisma CLI
- ❌ No manual Cloudflare Tunnel commands
- ❌ No terminal windows left open

Everything required for 24/7 background operation is bundled into the installer:
- **Node.js 24 LTS x64 Windows binary** (`v24.18.0`)
- **Cloudflared Windows x64 binary** (`v2026.10.0`)
- **WinSW 2.12.0 x64 Service Wrapper**
- **Next.js 16 Standalone Server**
- **Prisma Schema & Windows Query Engine**

---

## 🏗️ System Architecture

```text
Public Hostname (e.g. training.clientdomain.com)
            ↓ (HTTPS)
Cloudflare Edge Network
            ↓ (Secure Outbound WebSocket/QUIC Tunnel)
cloudflared Windows Service
            ↓ (HTTP 127.0.0.1:4000)
CallTrackTrainingApp Windows Service (WinSW + Node.js 24 Standalone)
            ↓
SQLite Database (C:\ProgramData\CallTrackTraining\data\calltrack-training.db)
```

### Security & Ingress Model:
1. **Localhost Only:** The Next.js server binds strictly to `127.0.0.1` (never `0.0.0.0`).
2. **Zero Inbound Ports:** No router port-forwarding or inbound Windows Firewall rules are required.
3. **Automated Recovery:** Both `CallTrackTrainingApp` and `cloudflared` run as Windows Services that restart automatically on failure and survive PC reboots and user logouts.

---

## 📁 Filesystem & Data Layout

In compliance with Windows enterprise deployment standards, immutable application files are separated from mutable machine data:

### 1. Application Files (`C:\Program Files\CallTrackTraining\`)
- `runtime\node.exe` — Bundled Node.js 24 LTS runtime
- `cloudflared\cloudflared.exe` — Official Cloudflare Tunnel binary
- `service\CallTrackTrainingApp.exe` + `.xml` — WinSW service wrapper
- `app\server.js` + `.next\static` + `public` — Next.js standalone application
- `app\cli\bootstrap.js` — Database bootstrap and offline migration tool
- `app\prisma\schema.prisma` — Prisma schema definition

### 2. Mutable Machine Data (`C:\ProgramData\CallTrackTraining\`)
- `data\calltrack-training.db` — Persistent SQLite database
- `backups\calltrack-backup-*.db` — WAL-safe snapshots via `VACUUM INTO` (14-day rolling retention)
- `logs\CallTrackTrainingApp.log` — Rolling service stdout/stderr logs
- `config\.env` — Machine environment configuration (`AUTH_SECRET`, `PORT`, `DATABASE_URL`)
- `config\cloudflared-token.txt` — Secure Cloudflare tunnel token (restricted permissions)

---

## 🛠️ Building the Installer

The build pipeline is 100% reproducible via `build-installer.ps1`:

```powershell
# From call-track-training root:
powershell -ExecutionPolicy Bypass -File .\build-installer.ps1
```

### Pipeline Workflow:
1. Verifies pinned tools (`node.exe`, `cloudflared.exe`, `WinSW-x64.exe`, `ISCC.exe`).
2. Executes `npm run build` with `output: "standalone"`.
3. Copies `.next/static` and `public` into `.next/standalone`.
4. Audits Prisma engines (`query_engine-windows.dll.node`).
5. Compiles `installer/CallTrackTraining.iss` using Inno Setup 6.2.2.
6. Generates `dist/CallTrackTraining-Setup-0.2.0.exe` and outputs its SHA256 checksum.

---

## ☁️ Creating a Cloudflare Remotely Managed Tunnel

Before delivering the installer to the client, the operator sets up the Cloudflare Tunnel:

1. In the **Cloudflare Zero Trust Dashboard**:
   - Go to **Networks** → **Tunnels** → **Create a Tunnel**.
   - Choose **Cloudflared**.
   - Name the tunnel (e.g. `call-track-training`).
2. **Public Hostname Route:**
   - Subdomain: `training` (or desired hostname)
   - Domain: `yourdomain.com`
   - Service: `HTTP`
   - URL: `127.0.0.1:4000`
3. **Copy the Tunnel Token:**
   - Under the install command, copy the tunnel token (the long string following `--token`).
   - Give this **Public Hostname** and **Tunnel Token** to the client.

---

## 🤖 Silent / Headless Installation Mode

For automated deployments or enterprise management, the installer supports silent switches:

```powershell
CallTrackTraining-Setup-0.2.0.exe /VERYSILENT /SUPPRESSMSGBOXES `
  /HOSTNAME="training.clientdomain.com" `
  /TOKEN="eyJh..." `
  /ADMIN_NAME="Operations Admin" `
  /ADMIN_EMAIL="admin@clientdomain.com" `
  /ADMIN_PASSWORD="YourSecurePassword123!" `
  /PORT="4000"
```

---

## 🔍 Operator Health Check & Troubleshooting

### 1. Check Service Status
```powershell
Get-Service CallTrackTrainingApp, cloudflared
```

### 2. Query Local Health Endpoint
```powershell
Invoke-RestMethod http://127.0.0.1:4000/api/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "application": "Call Track Training",
  "version": "0.2.0",
  "process": {
    "alive": true,
    "uptimeSeconds": 142
  },
  "database": {
    "status": "connected",
    "latencyMs": 2
  }
}
```

### 3. Inspect Service Logs
```powershell
Get-Content -Tail 50 -Wait "C:\ProgramData\CallTrackTraining\logs\CallTrackTrainingApp.log"
```

### 4. Restart Services Manually
```powershell
Restart-Service CallTrackTrainingApp
Restart-Service cloudflared
```

---

## 🔄 Upgrade & Rollback Behavior

### Upgrades:
- When a newer setup is executed over an existing installation:
  1. Detects `C:\ProgramData\CallTrackTraining\data\calltrack-training.db`.
  2. Stops running services safely.
  3. Executes a pre-upgrade `VACUUM INTO` snapshot to `backups\`.
  4. Preserves `config\.env` and `AUTH_SECRET`.
  5. Updates binary files and applies schema changes via `bootstrap.js --upgrade`.
  6. Restarts services and executes health checks.
  7. **Never deletes existing contacts or user data.**

### Uninstallation:
- Stops and uninstalls `CallTrackTrainingApp` and `cloudflared` services.
- Deletes `C:\Program Files\CallTrackTraining\`.
- **Prompts explicitly** whether to preserve or remove `C:\ProgramData\CallTrackTraining\`. By default, data is preserved to prevent accidental loss.

# Call Track — Training Environment

> **Environment: Dedicated Client Training & Simulation Sandbox**  
> Standalone instance running concurrently alongside production on **Port 4000**.  
> 📖 **Client Setup Guide**: See [CLIENT_SETUP_GUIDE.md](CLIENT_SETUP_GUIDE.md) for step-by-step installation.  
> 🛠️ **Developer Technical Guide**: See [TRAINING.md](TRAINING.md) for architecture & promotion workflows.

---

## 🚀 Key Features of the Training Environment

- **Side-by-Side Execution**: Runs concurrently with live Production (`http://localhost:3000`) on the same machine without port or database conflicts.
- **Port 4000**: Accessible at `http://localhost:4000`.
- **Visual Amber Banner**: High-contrast amber banner (`⚠️ TRAINING ENVIRONMENT`) across the top prevents any confusion.
- **Synthetic Data**: Comes pre-loaded with synthetic demo prospect lists—no real customer data is ever exposed.
- **Dedicated Shortcuts**: Creates `Start Call Track (Training)` and `Stop Call Track (Training)` desktop shortcuts.
- **Training User Accounts**: Uses `-trn` user logins (`admin-trn@calltrack.local` and `freelancer-trn@calltrack.local`).

---

## ⚡ Quick Start (Client / Trainee)

### Prerequisites
- **Recommended Node.js Version**: Node.js 20+ LTS (if running natively).
- **Docker Desktop**: Docker Desktop 24+ with WSL 2 integration (if running containerized).
- **Port Allocation**: Requires Port **`4000`** free and available.

---

### Option A: Via Docker Desktop (Recommended)
1. Ensure **Docker Desktop** is open and running (whale icon in taskbar).
2. Right-click **`setup.ps1`** → **Run with PowerShell**.
3. Use the generated Desktop shortcuts:
   - **`Start Call Track (Training)`** → Builds/starts the container and opens `http://localhost:4000`.
   - **`Stop Call Track (Training)`** → Shuts down training container.

*(First-time launch builds the container image in ~2–3 minutes; subsequent starts take ~5 seconds).*

For complete step-by-step instructions, see [CLIENT_SETUP_GUIDE.md](CLIENT_SETUP_GUIDE.md).

---

### Option B: Via Windows Batch Launcher (Native Node.js)
1. Double-click **`Start Call Track.bat`** in this folder.
   - Automatically verifies Node.js LTS, configures unique local secrets in `.env`, runs migrations, seeds initial data, builds Next.js production bundle, and validates HTTP health before launching browser.
   - If any step fails, the launcher halts with fail-fast diagnostics and does **not** launch a broken server.
2. Server will start on **`http://localhost:4000`** and open in your default browser.
3. To stop the server at any time, double-click **`Stop Call Track.bat`**.

---

## 🔐 Training Login Credentials

Secure passwords are dynamically generated upon database seed and stored in **`SEED_CREDENTIALS.txt`**:

```
============================================
  CALL TRACK TRAINING — SEED CREDENTIALS
  Admin:      admin-trn@calltrack.local       →  <Generated_Password>
  Freelancer: freelancer-trn@calltrack.local  →  <Generated_Password>
============================================
```

> ⚠️ Open **`SEED_CREDENTIALS.txt`** in Notepad to retrieve your training credentials.

---

## 🔍 Verification & Health Checking

To verify the training instance is running and healthy:
- **Web Browser**: Visit `http://localhost:4000` or `http://localhost:4000/api/healthz` (returns `{"status":"ok"}`).
- **PowerShell Port Check**:
  ```powershell
  Test-NetConnection localhost -Port 4000
  Invoke-WebRequest http://localhost:4000/api/healthz -UseBasicParsing
  ```

---

## 🔄 Resetting Training Sandbox Data

If training agents log test calls and you want to restore a fresh slate:
- **Docker Flow**:
  1. Double-click `Stop Call Track (Training)`.
  2. In PowerShell, run: `docker volume rm call-track-training-data`
  3. Double-click `Start Call Track (Training)`. Fresh data is seeded automatically.
- **Native Flow**:
  1. Double-click `Stop Call Track.bat`.
  2. Delete `prisma/dev.db` and `prisma/.seeded`.
  3. Double-click `Start Call Track.bat`.

---

## 🛡️ Security & Dependency Hygiene

- **Version Control Secrets**: No `.env` files or hardcoded authentication secrets are tracked in source control. Unique per-install cryptographic secrets are automatically generated upon first run.
- **Dependency Audit Policy**: **Do NOT run `npm audit fix --force` blindly**. Running force audit downgrades `@prisma/client` to 6.12.0 breaking compatibility. Run `npm audit` only to inspect advisories.

---

## 🐳 Architecture & Isolation

- **Docker Container**: `call-track-training`
- **Docker Volume**: `call-track-training-data` (completely isolated from production `call-track-data`)
- **Port**: `4000` (app) and `5556` (Prisma Studio)
- **Local Database**: `./dev.db` (local SQLite file)



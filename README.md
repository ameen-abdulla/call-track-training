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

### Option A: Via Docker Desktop (Recommended)
1. Ensure Docker Desktop is running.
2. Right-click **`setup.ps1`** → **Run with PowerShell**.
3. Use the generated Desktop shortcuts:
   - **`Start Call Track (Training)`** → Launches container & opens `http://localhost:4000`.
   - **`Stop Call Track (Training)`** → Shuts down training container.

For complete details, please read [CLIENT_SETUP_GUIDE.md](CLIENT_SETUP_GUIDE.md).

### Option B: Via Windows Batch Launcher (Native Node.js)
1. Double-click **`Start Call Track.bat`** in this folder.
2. Server will start on port 4000 and automatically open in your browser.
3. Double-click **`Stop Call Track.bat`** to stop.

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

> ⚠️ Open **`SEED_CREDENTIALS.txt`** to retrieve your training credentials.

---

## 🐳 Architecture & Isolation

- **Docker Container**: `call-track-training`
- **Docker Volume**: `call-track-training-data` (completely isolated from production `call-track-data`)
- **Port**: `4000` (app) and `5556` (Prisma Studio)
- **Local Database**: `./dev.db` (local SQLite file)


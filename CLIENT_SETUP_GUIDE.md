# Call Track — Client Setup & Operation Guide
## Running the Training Environment Alongside Production

Welcome to your **Call Track (Training)** environment! This dedicated environment gives you and your team a 100% safe sandbox to practice tele-calling, train new agents, test scripts, and explore features—**on the exact same computer as your live production app, running at the exact same time, with zero risk to your live client data.**

---

## 1. Overview & Key Differences at a Glance

The Training environment is completely separated from your Live Production app. It uses its own isolated database, its own network port, its own Docker volume, and unique training login accounts.

| Feature | 🔴 Live Production | 🟠 Training Sandbox |
| :--- | :--- | :--- |
| **Purpose** | Real client tele-calling & live operations | Practice, agent training & mock calls |
| **Browser URL** | `http://localhost:3000` *(or your live domain)* | `http://localhost:4000` |
| **Visual Cue** | Standard Blue interface | **Prominent Amber Banner** across top: `⚠️ TRAINING ENVIRONMENT` |
| **Desktop Start Shortcut** | `Start Call Track` | `Start Call Track (Training)` |
| **Desktop Stop Shortcut** | `Stop Call Track` | `Stop Call Track (Training)` |
| **Admin Login** | `admin@calltrack.local` | `admin-trn@calltrack.local` |
| **Freelancer Login** | `freelancer@calltrack.local` | `freelancer-trn@calltrack.local` |
| **Prospect Data** | Your real company prospect lists | **100% synthetic demo prospects** (Acme, Demo Logistics, etc.) |
| **Database Storage** | Isolated `call-track-data` volume | Isolated `call-track-training-data` volume |
| **Can run concurrently?** | **YES** — Can run simultaneously on the same machine | **YES** — Can run simultaneously on the same machine |

> [!NOTE]
> **Safety Guarantee:** Any call logged, contact edited, or status changed in the Training environment **only affects the training sandbox**. Your live production database is completely untouched.

---

## 2. One-Time Setup Instructions

Setting up the training environment on your computer takes less than 2 minutes.

### Step 1: Place the Training Folder
Ensure the `call-track-training` folder is placed on your computer in your chosen working directory (for example, right next to your existing `call-track` folder).

> ⚠️ **Important:** Do **not** merge or copy files from `call-track-training` into your live `call-track` folder. Keep them in two separate side-by-side folders.

### Step 2: Ensure Docker Desktop is Running
If you already use Call Track on your system, Docker Desktop is already installed.
1. Look at your Windows taskbar (bottom-right near the clock) for the **Docker whale icon**.
2. If it is not running, open **Docker Desktop** from your Start menu and wait until the whale icon shows it is ready.

### Step 3: Run the Setup Script
1. Open your `call-track-training` folder in Windows File Explorer.
2. Locate the file named **`setup.ps1`**.
3. **Right-click `setup.ps1`** and select **"Run with PowerShell"**.
   *(If Windows asks "Do you want to allow this app...", click **Yes**).*
4. The script will run for approximately 20–30 seconds and will:
   - Verify Docker Desktop is active.
   - Create two dedicated training shortcuts on your Desktop:
     - 🚀 **`Start Call Track (Training)`**
     - 🛑 **`Stop Call Track (Training)`**
5. When the script says `"Setup complete! Press Enter to finish"`, press **Enter**.

> [!TIP]
> Your existing production shortcuts (`Start Call Track` and `Stop Call Track`) remain untouched on your Desktop. The new training shortcuts are clearly labeled with **`(Training)`**.

---

## 3. Daily Usage: Starting & Stopping

### Starting the Training App
1. Make sure Docker Desktop is open.
2. Double-click the **`Start Call Track (Training)`** icon on your Desktop.
3. A small background window will start the training container and automatically open your default browser to:
   ```
   http://localhost:4000
   ```
   *(Note: The very first time you launch, it will take 2–3 minutes to build the container image. Subsequent starts will take only 5–10 seconds).*

### Stopping the Training App
1. When you or your agents are finished practicing, double-click **`Stop Call Track (Training)`** on your Desktop.
2. The training container will cleanly shut down and free up system memory.

---

## 4. Alternative Method: Running Without Docker (Native Node.js)

If you prefer to run the training app directly using Windows batch files without Docker:
1. Open the `call-track-training` folder.
2. Double-click **`Start Call Track.bat`**.
   - If Node.js is missing, it will automatically prompt you to download the official Node.js LTS installer.
   - On the first run, it installs dependencies, initializes the local training database, and loads the synthetic training contacts.
   - It will automatically launch the server in the background and open `http://localhost:4000`.
3. To stop the server at any time, double-click **`Stop Call Track.bat`** in the same folder.

---

## 5. Login Credentials

The training environment includes two pre-configured user accounts with distinct `-trn` usernames:

### 1. Training Administrator Account
- **Email:** `admin-trn@calltrack.local`
- **Role:** Administrator (full access to team overview, assigning contacts, performance analytics, and settings).
- **Password:** Found in the file named **`SEED_CREDENTIALS.txt`** located inside your `call-track-training` folder.

### 2. Training Freelancer / Agent Account
- **Email:** `freelancer-trn@calltrack.local`
- **Role:** Freelancer / Tele-caller (focused calling dashboard, script prompter, call logger, follow-up calendar).
- **Password:** Found in the file named **`SEED_CREDENTIALS.txt`** located inside your `call-track-training` folder.

### How to Find Your Passwords:
1. Open the `call-track-training` folder.
2. Double-click **`SEED_CREDENTIALS.txt`** in Notepad.
3. Copy the password for either the Admin or Freelancer account.

```text
============================================================
  CALL TRACK TRAINING — SEED CREDENTIALS
============================================================

Admin Account:
  Email:    admin-trn@calltrack.local
  Password: [See your SEED_CREDENTIALS.txt file]

Freelancer Account:
  Email:    freelancer-trn@calltrack.local
  Password: [See your SEED_CREDENTIALS.txt file]
============================================================
```

> [!IMPORTANT]
> When creating additional training accounts or resetting passwords, new passwords must be at least **8 characters** long and include at least **1 uppercase letter**, **1 number**, and **1 special character** (e.g., `@`, `$`, `!`, `%`, `*`, `?`, `&`).

---

## 6. How to Tell Which App You Are In

To avoid any confusion when running both apps simultaneously, look for these three visual cues:

1. **Top Banner:** The Training instance displays a persistent, high-contrast amber banner across the top:
   > ⚠️ **TRAINING ENVIRONMENT — Port 4000 — Changes here do not affect production**
2. **Browser Tab Title:** The training tab starts with `[TRAINING] Call Track — ...`.
3. **Browser Address Bar:**
   - Training is always: `http://localhost:4000`
   - Production is always: `http://localhost:3000` *(or your live URL)*

---

## 7. Resetting Training Data (Fresh Practice Slate)

Over time, your training agents may log dozens of test calls, change contact statuses, or add practice notes. If you ever want to wipe out practice history and return to a clean, fresh demo dataset:

### If using Docker:
1. Double-click **`Stop Call Track (Training)`**.
2. Open PowerShell or Command Prompt and run:
   ```powershell
   docker volume rm call-track-training-data
   ```
3. Double-click **`Start Call Track (Training)`**. A fresh database with default sample contacts will be regenerated automatically.

### If using Native Batch (`.bat`):
1. Double-click **`Stop Call Track.bat`**.
2. Delete the `dev.db` file inside the `call-track-training/prisma` folder.
3. In terminal, run `npx prisma db push` and `npx tsx prisma/seed.ts` (or double-click `Start Call Track.bat`).

---

## 8. Frequently Asked Questions (FAQ)

#### Q: Can I run both the Production and Training apps at the same time?
**Yes, absolutely.** Production uses port 3000 and the `call-track-data` storage; Training uses port 4000 and the `call-track-training-data` storage. You can have both open side by side in split-screen or across multiple monitors.

#### Q: Will anything done in the Training app affect our real customers or call history?
**No.** The databases, volumes, and network connections are completely separated. Nothing in training can reach or alter production data.

#### Q: Are the prospects in the training app real?
**No.** All prospect records in the training app are 100% synthetic demo entries (fictitious company names, demo phone numbers, and placeholder notes) specifically created for training and onboarding.

#### Q: What if `Start Call Track (Training)` shows "Docker Desktop is not installed"?
Ensure Docker Desktop is installed and running. If Docker Desktop was just started, wait 15–20 seconds for the engine to initialize before launching the shortcut.

#### Q: Can I install this on a new trainee's laptop?
**Yes.** Simply copy the `call-track-training` folder to their computer, ensure Docker Desktop (or Node.js) is installed, and run `setup.ps1`. They will immediately have their own local training sandbox.

---

## Need Assistance?
If you encounter any issues during setup or operation, please reach out to your system administrator or developer.

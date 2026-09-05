# Call Track — Standalone Training Environment

This repository (`call-track-training`) is a standalone, client-ready training and simulation environment for Call Track. It runs completely side by side with the production instance on the same machine without any port, database, or volume collisions.

---

## 1. Port & Network Allocation

| Service | Training Environment | Production Environment |
| :--- | :--- | :--- |
| **Next.js Web App** | `http://localhost:4000` | `http://localhost:3000` (or `https://calltrack.flexibook.ai`) |
| **Prisma Studio** | `http://localhost:5556` | `http://localhost:5555` |
| **Database File** | Local `./dev.db` inside training folder | Local `./dev.db` inside production folder |
| **Automated Backups** | `./backups-training/` | `./backups/` |
| **Docker Container** | `call-track-training` | `call-track` |
| **Docker Volume** | `call-track-training-data` | `call-track-data` |

---

## 2. Visual Differentiation

To ensure clients and internal users always know which instance they are using:
- **Persistent App Header**: A high-contrast amber banner across the top:  
  `⚠️ TRAINING ENVIRONMENT — Port 4000 — Changes here do not affect production`
- **Page Title**: Prefixed with `[TRAINING] Call Track — Tele-Calling Command Center`.
- **PWA Manifest**: Manifest name is `Call Track — Training`, short name is `CT Training`, and theme color is set to amber (`#d97706`).

---

## 3. Seed Data & Account Isolation

- **Training-Specific Usernames (`-trn`)**:
  - Admin: `admin-trn@calltrack.local`
  - Freelancer: `freelancer-trn@calltrack.local`
  - Passwords are auto-generated on seed and saved in `SEED_CREDENTIALS.txt`.
- **Zero Real Business Data**: The production CSV has been replaced with synthetic sample rows in `prisma/training_sample_prospect_list.csv` (e.g., Demo Apex Logistics, Acme International Demo Academy, etc.).
- **Isolated Secrets**: `.env` contains unique cryptographic `AUTH_SECRET` and `NEXTAUTH_SECRET` values distinct from production.

---

## 4. Promotion Workflow (Training → Production)

The git configuration has two remotes configured:
```bash
git remote -v
# origin      https://github.com/ameen-abdulla/call-track-training.git (fetch & push)
# production  https://github.com/ameen-abdulla/call-track.git (fetch & push)
```

### Promoting Features/Fixes to Production via Cherry-Pick

1. Develop and test your changes on `call-track-training` (commit your work to `main` or a feature branch).
2. Note the commit hash:
   ```bash
   git log -n 1 --oneline
   # Example: a1b2c3d feat: add new export filter
   ```
3. Push to the training repository:
   ```bash
   git push origin main
   ```
4. Open your production repository (`d:\FamCode\Call Tracker\call-track\`):
   ```bash
   # Add the training remote once (if not already added)
   git remote add training https://github.com/ameen-abdulla/call-track-training.git

   # Fetch latest commits from training
   git fetch training

   # Cherry-pick the desired feature commit cleanly into production
   git cherry-pick a1b2c3d

   # Push to production
   git push origin main
   ```

This ensures port configurations, seed data, and training banners remain strictly inside the training environment while feature code is promoted cleanly.

---

## 5. Quick Start Commands

- **Install Dependencies**: `npm install`
- **Database Push**: `npm run db:push`
- **Seed Database**: `npm run db:seed`
- **Start Dev Server (Port 4000)**: `npm run dev`
- **Build & Run Production Mode (Port 4000)**:
  ```bash
  npm run build
  npm run start
  ```
- **Launch via Batch File**: Double-click `Start Call Track.bat` in this directory.
- **Stop Server**: Double-click `Stop Call Track.bat` in this directory.

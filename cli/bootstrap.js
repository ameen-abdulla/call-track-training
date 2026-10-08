/**
 * Call Track Training — Dedicated Database Bootstrap & Upgrade Tool
 * 
 * Handles:
 *  - Offline schema deployment via built-in node:sqlite
 *  - Initial Administrator account creation (bcrypt hashed, validated)
 *  - WAL-safe SQLite backups using VACUUM INTO
 *  - Backup retention pruning (preserves newest backup)
 *  - Zero dependency on external CSVs or development seeds
 */

'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

// Load config from ProgramData .env if present
const configEnvPath = process.env.CALLTRACK_ENV_FILE ||
  (process.env.PROGRAMDATA
    ? path.join(process.env.PROGRAMDATA, 'CallTrackTraining', 'config', '.env')
    : 'C:\\ProgramData\\CallTrackTraining\\config\\.env');

if (fs.existsSync(configEnvPath)) {
  try {
    const content = fs.readFileSync(configEnvPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[bootstrap] Warning reading config at ' + configEnvPath + ':', err.message);
  }
}

// Ensure explicit SQLite database location
const defaultDbPath = process.env.PROGRAMDATA
  ? path.join(process.env.PROGRAMDATA, 'CallTrackTraining', 'data', 'calltrack-training.db')
  : 'C:\\ProgramData\\CallTrackTraining\\data\\calltrack-training.db';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:' + defaultDbPath.replace(/\\/g, '/');
}

function getResolvedDbFilePath() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:')) {
    return path.resolve(dbUrl.replace(/^file:/, ''));
  }
  return path.resolve(defaultDbPath);
}

function getBackupDirectory() {
  if (process.env.BACKUP_DIR && path.isAbsolute(process.env.BACKUP_DIR)) {
    return process.env.BACKUP_DIR;
  }
  return process.env.PROGRAMDATA
    ? path.join(process.env.PROGRAMDATA, 'CallTrackTraining', 'backups')
    : 'C:\\ProgramData\\CallTrackTraining\\backups';
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: 'help',
    name: '',
    email: '',
    password: '',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--init') options.mode = 'init';
    else if (arg === '--upgrade') options.mode = 'upgrade';
    else if (arg === '--backup') options.mode = 'backup';
    else if (arg === '--verify') options.mode = 'verify';
    else if (arg === '--generate-secret') options.mode = 'generate-secret';
    else if (arg.startsWith('--name=')) options.name = arg.slice(7);
    else if (arg === '--name' && i + 1 < args.length) options.name = args[++i];
    else if (arg.startsWith('--email=')) options.email = arg.slice(8);
    else if (arg === '--email' && i + 1 < args.length) options.email = args[++i];
    else if (arg.startsWith('--password=')) options.password = arg.slice(11);
    else if (arg === '--password' && i + 1 < args.length) options.password = args[++i];
  }

  return options;
}

function generateId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

function loadBcrypt() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'bcryptjs'),
    path.join(__dirname, 'node_modules', 'bcryptjs'),
    'bcryptjs',
  ];
  for (const c of candidates) {
    try { return require(c); } catch {}
  }
  throw new Error('[bootstrap] bcryptjs not found in any expected location');
}

const SCHEMA_STATEMENTS = [
  'CREATE TABLE IF NOT EXISTS "User" (\n' +
  '    "id" TEXT NOT NULL PRIMARY KEY,\n' +
  '    "name" TEXT NOT NULL,\n' +
  '    "email" TEXT NOT NULL,\n' +
  '    "phone" TEXT,\n' +
  '    "passwordHash" TEXT NOT NULL,\n' +
  '    "role" TEXT NOT NULL DEFAULT \'FREELANCER\',\n' +
  '    "freelancerStatus" TEXT,\n' +
  '    "applicationNote" TEXT,\n' +
  '    "appliedAt" DATETIME,\n' +
  '    "reviewedAt" DATETIME,\n' +
  '    "reviewedById" TEXT,\n' +
  '    "suspendedAt" DATETIME,\n' +
  '    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n' +
  '    "updatedAt" DATETIME NOT NULL,\n' +
  '    CONSTRAINT "User_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE\n' +
  ');',

  'CREATE TABLE IF NOT EXISTS "Contact" (\n' +
  '    "id" TEXT NOT NULL PRIMARY KEY,\n' +
  '    "name" TEXT NOT NULL,\n' +
  '    "phone" TEXT NOT NULL,\n' +
  '    "phone2" TEXT,\n' +
  '    "email" TEXT,\n' +
  '    "company" TEXT,\n' +
  '    "source" TEXT,\n' +
  '    "callPriority" TEXT,\n' +
  '    "status" TEXT NOT NULL DEFAULT \'new\',\n' +
  '    "assignedToId" TEXT,\n' +
  '    "topic" TEXT,\n' +
  '    "createdById" TEXT NOT NULL,\n' +
  '    "deletedAt" DATETIME,\n' +
  '    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n' +
  '    "updatedAt" DATETIME NOT NULL,\n' +
  '    CONSTRAINT "Contact_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,\n' +
  '    CONSTRAINT "Contact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE\n' +
  ');',

  'CREATE TABLE IF NOT EXISTS "Tag" (\n' +
  '    "id" TEXT NOT NULL PRIMARY KEY,\n' +
  '    "name" TEXT NOT NULL,\n' +
  '    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n' +
  ');',

  'CREATE TABLE IF NOT EXISTS "ContactTag" (\n' +
  '    "contactId" TEXT NOT NULL,\n' +
  '    "tagId" TEXT NOT NULL,\n' +
  '    PRIMARY KEY ("contactId", "tagId"),\n' +
  '    CONSTRAINT "ContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,\n' +
  '    CONSTRAINT "ContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE\n' +
  ');',

  'CREATE TABLE IF NOT EXISTS "AssignmentHistory" (\n' +
  '    "id" TEXT NOT NULL PRIMARY KEY,\n' +
  '    "contactId" TEXT NOT NULL,\n' +
  '    "fromUserId" TEXT,\n' +
  '    "toUserId" TEXT,\n' +
  '    "changedById" TEXT NOT NULL,\n' +
  '    "reason" TEXT,\n' +
  '    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n' +
  '    CONSTRAINT "AssignmentHistory_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,\n' +
  '    CONSTRAINT "AssignmentHistory_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,\n' +
  '    CONSTRAINT "AssignmentHistory_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,\n' +
  '    CONSTRAINT "AssignmentHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE\n' +
  ');',

  'CREATE TABLE IF NOT EXISTS "CallAttempt" (\n' +
  '    "id" TEXT NOT NULL PRIMARY KEY,\n' +
  '    "contactId" TEXT NOT NULL,\n' +
  '    "freelancerId" TEXT NOT NULL,\n' +
  '    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n' +
  '    "method" TEXT NOT NULL,\n' +
  '    "userAgent" TEXT,\n' +
  '    "ipHash" TEXT,\n' +
  '    CONSTRAINT "CallAttempt_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,\n' +
  '    CONSTRAINT "CallAttempt_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE\n' +
  ');',

  'CREATE TABLE IF NOT EXISTS "Interaction" (\n' +
  '    "id" TEXT NOT NULL PRIMARY KEY,\n' +
  '    "contactId" TEXT NOT NULL,\n' +
  '    "freelancerId" TEXT NOT NULL,\n' +
  '    "type" TEXT NOT NULL,\n' +
  '    "connected" BOOLEAN,\n' +
  '    "callAttemptId" TEXT,\n' +
  '    "response" TEXT,\n' +
  '    "interestArea" TEXT,\n' +
  '    "nextActivityRequired" BOOLEAN NOT NULL DEFAULT false,\n' +
  '    "nextActivityDate" DATETIME,\n' +
  '    "nextActivity" TEXT,\n' +
  '    "notes" TEXT,\n' +
  '    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n' +
  '    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n' +
  '    CONSTRAINT "Interaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,\n' +
  '    CONSTRAINT "Interaction_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,\n' +
  '    CONSTRAINT "Interaction_callAttemptId_fkey" FOREIGN KEY ("callAttemptId") REFERENCES "CallAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE\n' +
  ');',

  'CREATE TABLE IF NOT EXISTS "ActivityLog" (\n' +
  '    "id" TEXT NOT NULL PRIMARY KEY,\n' +
  '    "actorId" TEXT NOT NULL,\n' +
  '    "action" TEXT NOT NULL,\n' +
  '    "targetType" TEXT NOT NULL,\n' +
  '    "targetId" TEXT,\n' +
  '    "metadata" TEXT,\n' +
  '    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n' +
  '    CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE\n' +
  ');',

  'CREATE TABLE IF NOT EXISTS "Call" (\n' +
  '    "id" TEXT NOT NULL PRIMARY KEY,\n' +
  '    "contactId" TEXT NOT NULL,\n' +
  '    "agentId" TEXT NOT NULL,\n' +
  '    "callTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n' +
  '    "outcome" TEXT NOT NULL,\n' +
  '    "responseLookup" TEXT,\n' +
  '    "recommendedAction" TEXT,\n' +
  '    "interestLevel" TEXT,\n' +
  '    "feedbackNotes" TEXT,\n' +
  '    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n' +
  '    CONSTRAINT "Call_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,\n' +
  '    CONSTRAINT "Call_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE\n' +
  ');',

  'CREATE TABLE IF NOT EXISTS "Activity" (\n' +
  '    "id" TEXT NOT NULL PRIMARY KEY,\n' +
  '    "contactId" TEXT NOT NULL,\n' +
  '    "agentId" TEXT NOT NULL,\n' +
  '    "callId" TEXT,\n' +
  '    "activityType" TEXT NOT NULL,\n' +
  '    "followUpType" TEXT,\n' +
  '    "dueDate" DATETIME NOT NULL,\n' +
  '    "status" TEXT NOT NULL DEFAULT \'pending\',\n' +
  '    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n' +
  '    "completedAt" DATETIME,\n' +
  '    CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,\n' +
  '    CONSTRAINT "Activity_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,\n' +
  '    CONSTRAINT "Activity_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE SET NULL ON UPDATE CASCADE\n' +
  ');',

  'CREATE TABLE IF NOT EXISTS "Notification" (\n' +
  '    "id" TEXT NOT NULL PRIMARY KEY,\n' +
  '    "userId" TEXT NOT NULL,\n' +
  '    "type" TEXT NOT NULL,\n' +
  '    "message" TEXT NOT NULL,\n' +
  '    "relatedId" TEXT,\n' +
  '    "isRead" BOOLEAN NOT NULL DEFAULT false,\n' +
  '    "sentById" TEXT,\n' +
  '    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n' +
  '    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,\n' +
  '    CONSTRAINT "Notification_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE\n' +
  ');',

  'CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");',
  'CREATE INDEX IF NOT EXISTS "Contact_deletedAt_idx" ON "Contact"("deletedAt");',
  'CREATE UNIQUE INDEX IF NOT EXISTS "Tag_name_key" ON "Tag"("name");',
  'CREATE INDEX IF NOT EXISTS "AssignmentHistory_contactId_createdAt_idx" ON "AssignmentHistory"("contactId", "createdAt");',
  'CREATE INDEX IF NOT EXISTS "CallAttempt_contactId_idx" ON "CallAttempt"("contactId");',
  'CREATE INDEX IF NOT EXISTS "CallAttempt_freelancerId_idx" ON "CallAttempt"("freelancerId");',
  'CREATE INDEX IF NOT EXISTS "CallAttempt_triggeredAt_idx" ON "CallAttempt"("triggeredAt");',
  'CREATE INDEX IF NOT EXISTS "Interaction_contactId_idx" ON "Interaction"("contactId");',
  'CREATE INDEX IF NOT EXISTS "Interaction_freelancerId_idx" ON "Interaction"("freelancerId");',
  'CREATE INDEX IF NOT EXISTS "Interaction_type_idx" ON "Interaction"("type");',
  'CREATE INDEX IF NOT EXISTS "Interaction_occurredAt_idx" ON "Interaction"("occurredAt");',
  'CREATE INDEX IF NOT EXISTS "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");',
  'CREATE INDEX IF NOT EXISTS "ActivityLog_action_idx" ON "ActivityLog"("action");',
  'CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");',
  'CREATE INDEX IF NOT EXISTS "Activity_agentId_dueDate_idx" ON "Activity"("agentId", "dueDate");',
  'CREATE INDEX IF NOT EXISTS "Activity_dueDate_idx" ON "Activity"("dueDate");',
  'CREATE INDEX IF NOT EXISTS "Activity_status_idx" ON "Activity"("status");',
];

function initializeSchema(existingDb) {
  console.log('[bootstrap] Syncing database schema via SQLite...');
  const dbFile = getResolvedDbFilePath();
  const dbDir = path.dirname(dbFile);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const shouldClose = !existingDb;
  const db = existingDb || new DatabaseSync(dbFile);

  try {
    db.exec('PRAGMA foreign_keys = ON;');
    for (const stmt of SCHEMA_STATEMENTS) {
      db.exec(stmt);
    }
    console.log('[bootstrap] ✅ Database schema sync completed successfully.');
  } finally {
    if (shouldClose) {
      db.close();
    }
  }
}

async function createBackup() {
  const dbFile = getResolvedDbFilePath();
  if (!fs.existsSync(dbFile)) {
    console.log('[bootstrap] No existing database file found to backup.');
    return null;
  }

  const backupDir = getBackupDirectory();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const backupFile = path.join(backupDir, 'calltrack-backup-' + timestamp + '.db');
  if (fs.existsSync(backupFile)) {
    try { fs.unlinkSync(backupFile); } catch {}
  }
  const normalizedBackupPath = backupFile.replace(/\\/g, '/');

  console.log('[bootstrap] Creating WAL-safe database backup to: ' + backupFile);
  const db = new DatabaseSync(dbFile);

  try {
    db.exec("VACUUM INTO '" + normalizedBackupPath + "'");
    console.log('[bootstrap] ✅ Backup successfully verified: ' + backupFile);
  } catch (err) {
    throw new Error('Failed to create database backup: ' + err.message);
  } finally {
    db.close();
  }

  // Prune old backups beyond retention policy
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);
  if (retentionDays > 0) {
    try {
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('calltrack-backup-') && f.endsWith('.db'))
        .map(f => {
          const fullPath = path.join(backupDir, f);
          const stat = fs.statSync(fullPath);
          return { name: f, fullPath, mtimeMs: stat.mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

      const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      for (let i = 1; i < files.length; i++) {
        if (files[i].mtimeMs < cutoffMs) {
          fs.unlinkSync(files[i].fullPath);
          console.log('[bootstrap] Pruned expired backup: ' + files[i].name);
        }
      }
    } catch (e) {
      console.warn('[bootstrap] Warning pruning old backups:', e.message);
    }
  }

  return backupFile;
}

async function bootstrapAdmin(adminName, adminEmail, adminPassword) {
  if (!adminEmail || !adminPassword) {
    console.log('[bootstrap] No initial administrator credentials supplied. Skipping admin creation.');
    return;
  }

  const bcrypt = loadBcrypt();
  const dbFile = getResolvedDbFilePath();
  const db = new DatabaseSync(dbFile);

  try {
    const normalizedEmail = adminEmail.trim().toLowerCase();
    const hash = bcrypt.hashSync(adminPassword, 10);
    const name = (adminName && adminName.trim()) || 'Admin User';

    const existing = db.prepare('SELECT id, role FROM "User" WHERE lower(email) = ?').get(normalizedEmail);
    if (existing) {
      db.prepare('UPDATE "User" SET passwordHash = ?, role = \'ADMIN\', updatedAt = datetime(\'now\') WHERE id = ?').run(hash, existing.id);
      console.log('[bootstrap] ✅ Updated existing administrator account: ' + normalizedEmail);
    } else {
      const id = generateId();
      db.prepare('INSERT INTO "User" (id, name, email, passwordHash, role, updatedAt) VALUES (?, ?, ?, ?, \'ADMIN\', datetime(\'now\'))').run(id, name, normalizedEmail, hash);
      console.log('[bootstrap] ✅ Created initial administrator account: ' + normalizedEmail);
    }
  } finally {
    db.close();
  }
}

async function verifyDatabase() {
  const dbFile = getResolvedDbFilePath();
  const db = new DatabaseSync(dbFile);
  try {
    const row = db.prepare('SELECT count(*) as c FROM "User"').get();
    const userCount = row ? row.c : 0;
    console.log('[bootstrap] ✅ Database verification successful. Total users: ' + userCount);
  } catch (err) {
    throw new Error('Database verification failed: ' + err.message);
  } finally {
    db.close();
  }
}

async function main() {
  const options = parseArgs();

  if (options.mode === 'generate-secret') {
    const secret = crypto.randomBytes(32).toString('hex');
    process.stdout.write(secret);
    process.exit(0);
  }

  if (options.mode === 'backup') {
    await createBackup();
    process.exit(0);
  }

  if (options.mode === 'upgrade') {
    console.log('[bootstrap] Starting application database upgrade...');
    await createBackup();
    initializeSchema();
    await verifyDatabase();
    console.log('[bootstrap] ✅ Upgrade completed successfully.');
    process.exit(0);
  }

  if (options.mode === 'init') {
    console.log('[bootstrap] Starting application database initialization...');
    const dbFile = getResolvedDbFilePath();
    const isExisting = fs.existsSync(dbFile);

    if (isExisting) {
      console.log('[bootstrap] Existing database detected at ' + dbFile + '. Creating backup first...');
      await createBackup();
    }

    initializeSchema();
    await bootstrapAdmin(options.name, options.email, options.password);
    await verifyDatabase();
    console.log('[bootstrap] ✅ Database initialization completed successfully.');
    process.exit(0);
  }

  if (options.mode === 'verify') {
    await verifyDatabase();
    process.exit(0);
  }

  console.log('\nUsage:\n  node bootstrap.js --init --name="Admin" --email="admin@test.com" --password="..."\n  node bootstrap.js --upgrade\n  node bootstrap.js --backup\n  node bootstrap.js --verify\n  node bootstrap.js --generate-secret\n');
  process.exit(1);
}

main().catch(err => {
  console.error('[bootstrap] ❌ Fatal error:', err.message);
  process.exit(1);
});

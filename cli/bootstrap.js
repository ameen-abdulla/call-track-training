/**
 * Call Track Training — Dedicated Database Bootstrap & Upgrade Tool
 * 
 * Handles:
 *  - Offline schema deployment via bundled Prisma schema engine
 *  - Initial Administrator account creation (bcrypt hashed, validated)
 *  - WAL-safe SQLite backups using VACUUM INTO
 *  - Backup retention pruning (preserves newest backup)
 *  - Zero dependency on external CSVs or development seeds
 */

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

// Load config from ProgramData .env if present
const configEnvPath = process.env.CALLTRACK_ENV_FILE ||
  (process.env.PROGRAMDATA
    ? path.join(process.env.PROGRAMDATA, 'CallTrackTraining', 'config', '.env')
    : 'C:\\ProgramData\\CallTrackTraining\\config\\.env')

if (fs.existsSync(configEnvPath)) {
  try {
    const content = fs.readFileSync(configEnvPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim()
          let val = trimmed.slice(eqIdx + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          if (!process.env[key]) {
            process.env[key] = val
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[bootstrap] Warning reading config at ${configEnvPath}:`, err.message)
  }
}

// Ensure explicit SQLite database location
const defaultDbPath = process.env.PROGRAMDATA
  ? path.join(process.env.PROGRAMDATA, 'CallTrackTraining', 'data', 'calltrack-training.db')
  : 'C:\\ProgramData\\CallTrackTraining\\data\\calltrack-training.db'

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${defaultDbPath.replace(/\\/g, '/')}`
}

function getResolvedDbFilePath() {
  const dbUrl = process.env.DATABASE_URL || ''
  if (dbUrl.startsWith('file:')) {
    return path.resolve(dbUrl.replace(/^file:/, ''))
  }
  return path.resolve(defaultDbPath)
}

function getBackupDirectory() {
  if (process.env.BACKUP_DIR && path.isAbsolute(process.env.BACKUP_DIR)) {
    return process.env.BACKUP_DIR
  }
  return process.env.PROGRAMDATA
    ? path.join(process.env.PROGRAMDATA, 'CallTrackTraining', 'backups')
    : 'C:\\ProgramData\\CallTrackTraining\\backups'
}

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    mode: 'help',
    name: '',
    email: '',
    password: '',
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--init') options.mode = 'init'
    else if (arg === '--upgrade') options.mode = 'upgrade'
    else if (arg === '--backup') options.mode = 'backup'
    else if (arg === '--verify') options.mode = 'verify'
    else if (arg === '--generate-secret') options.mode = 'generate-secret'
    else if (arg.startsWith('--name=')) options.name = arg.slice(7)
    else if (arg === '--name' && i + 1 < args.length) options.name = args[++i]
    else if (arg.startsWith('--email=')) options.email = arg.slice(8)
    else if (arg === '--email' && i + 1 < args.length) options.email = args[++i]
    else if (arg.startsWith('--password=')) options.password = arg.slice(11)
    else if (arg === '--password' && i + 1 < args.length) options.password = args[++i]
  }

  return options
}

function runPrismaDbPush() {
  console.log('[bootstrap] Syncing Prisma database schema...')
  const dbFile = getResolvedDbFilePath()
  const dbDir = path.dirname(dbFile)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // Find prisma CLI script and schema.prisma
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js'),
    path.join(__dirname, 'node_modules', 'prisma', 'build', 'index.js'),
    path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js'),
  ]
  const prismaCli = candidates.find(p => fs.existsSync(p))
  if (!prismaCli) {
    throw new Error('Prisma CLI build/index.js was not found in application bundle.')
  }

  const schemaCandidates = [
    path.join(__dirname, '..', 'prisma', 'schema.prisma'),
    path.join(__dirname, 'prisma', 'schema.prisma'),
    path.join(process.cwd(), 'prisma', 'schema.prisma'),
  ]
  const schemaPath = schemaCandidates.find(p => fs.existsSync(p))
  if (!schemaPath) {
    throw new Error('schema.prisma was not found in application bundle.')
  }

  // Run with bundled node
  const nodeExe = process.execPath
  execFileSync(nodeExe, [
    prismaCli,
    'db',
    'push',
    `--schema=${schemaPath}`,
    '--skip-generate',
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: `file:${dbFile.replace(/\\/g, '/')}`,
    },
  })

  console.log('[bootstrap] ✅ Prisma schema sync completed successfully.')
}

async function createBackup() {
  const dbFile = getResolvedDbFilePath()
  if (!fs.existsSync(dbFile)) {
    console.log('[bootstrap] No existing database file found to backup.')
    return null
  }

  const backupDir = getBackupDirectory()
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
  const backupFile = path.join(backupDir, `calltrack-backup-${timestamp}.db`)
  const normalizedBackupPath = backupFile.replace(/\\/g, '/')

  console.log(`[bootstrap] Creating WAL-safe database backup to: ${backupFile}`)
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()

  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${normalizedBackupPath}'`)
    console.log(`[bootstrap] ✅ Backup successfully verified: ${backupFile}`)
    await prisma.$disconnect()
  } catch (err) {
    await prisma.$disconnect()
    throw new Error(`Failed to create database backup: ${err.message}`)
  }

  // Prune old backups beyond retention policy
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10)
  if (retentionDays > 0) {
    try {
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('calltrack-backup-') && f.endsWith('.db'))
        .map(f => {
          const fullPath = path.join(backupDir, f)
          const stat = fs.statSync(fullPath)
          return { name: f, fullPath, mtimeMs: stat.mtimeMs }
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs)

      const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000
      for (let i = 1; i < files.length; i++) {
        if (files[i].mtimeMs < cutoffMs) {
          fs.unlinkSync(files[i].fullPath)
          console.log(`[bootstrap] Pruned expired backup: ${files[i].name}`)
        }
      }
    } catch (e) {
      console.warn('[bootstrap] Warning pruning old backups:', e.message)
    }
  }

  return backupFile
}

async function bootstrapAdmin(adminName, adminEmail, adminPassword) {
  if (!adminEmail || !adminPassword) {
    console.log('[bootstrap] No initial administrator credentials supplied. Skipping admin creation.')
    return
  }

  const bcrypt = require('bcryptjs')
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()

  try {
    const normalizedEmail = adminEmail.trim().toLowerCase()
    const passwordHash = await bcrypt.hash(adminPassword, 10)
    const name = adminName?.trim() || 'Admin User'

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          passwordHash,
          role: 'ADMIN',
        },
      })
      console.log(`[bootstrap] ✅ Updated existing administrator account: ${normalizedEmail}`)
    } else {
      await prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
          role: 'ADMIN',
        },
      })
      console.log(`[bootstrap] ✅ Created initial administrator account: ${normalizedEmail}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

async function verifyDatabase() {
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    const userCount = await prisma.user.count()
    console.log(`[bootstrap] ✅ Database verification successful. Total users: ${userCount}`)
    await prisma.$disconnect()
  } catch (err) {
    await prisma.$disconnect()
    throw new Error(`Database verification failed: ${err.message}`)
  }
}

async function main() {
  const options = parseArgs()

  if (options.mode === 'generate-secret') {
    const secret = crypto.randomBytes(32).toString('hex')
    process.stdout.write(secret)
    process.exit(0)
  }

  if (options.mode === 'backup') {
    await createBackup()
    process.exit(0)
  }

  if (options.mode === 'upgrade') {
    console.log('[bootstrap] Starting application database upgrade...')
    await createBackup()
    runPrismaDbPush()
    await verifyDatabase()
    console.log('[bootstrap] ✅ Upgrade completed successfully.')
    process.exit(0)
  }

  if (options.mode === 'init') {
    console.log('[bootstrap] Starting application database initialization...')
    const dbFile = getResolvedDbFilePath()
    const isExisting = fs.existsSync(dbFile)

    if (isExisting) {
      console.log(`[bootstrap] Existing database detected at ${dbFile}. Creating backup first...`)
      await createBackup()
    }

    runPrismaDbPush()
    await bootstrapAdmin(options.name, options.email, options.password)
    await verifyDatabase()
    console.log('[bootstrap] ✅ Database initialization completed successfully.')
    process.exit(0)
  }

  if (options.mode === 'verify') {
    await verifyDatabase()
    process.exit(0)
  }

  console.log(`
Usage:
  node bootstrap.js --init --name="Admin" --email="admin@test.com" --password="..."
  node bootstrap.js --upgrade
  node bootstrap.js --backup
  node bootstrap.js --verify
  node bootstrap.js --generate-secret
`)
  process.exit(1)
}

main().catch(err => {
  console.error('[bootstrap] ❌ Fatal error:', err.message)
  process.exit(1)
})

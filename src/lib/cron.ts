import cron from 'node-cron'
import { prisma } from './db'
import fs from 'fs'
import path from 'path'

export function startCronJobs() {
  // 1. Hourly: mark overdue activities and notify agents
  cron.schedule('0 * * * *', async () => {
    console.log('[cron] Running overdue check...')
    try {
      const overdue = await prisma.activity.findMany({
        where: { status: 'pending', dueDate: { lt: new Date() } },
        include: { contact: { select: { name: true } } },
      })
      for (const activity of overdue) {
        await prisma.activity.update({ where: { id: activity.id }, data: { status: 'overdue' } })
        await prisma.notification.create({
          data: {
            userId: activity.agentId,
            type: 'overdue_reminder',
            message: `Overdue follow-up: ${activity.contact.name} — ${activity.activityType} was due ${activity.dueDate.toLocaleDateString()}`,
            relatedId: activity.id,
          },
        })
      }
      console.log(`[cron] Marked ${overdue.length} activities as overdue`)
    } catch (err) {
      console.error('[cron] Error running overdue check:', err)
    }
  })

  // 2. Daily 8am: remind agents of activities due today
  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Running daily due-today reminder...')
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const dueToday = await prisma.activity.findMany({
        where: { status: 'pending', dueDate: { gte: today, lt: tomorrow } },
        include: { contact: { select: { name: true } } },
      })
      for (const activity of dueToday) {
        await prisma.notification.create({
          data: {
            userId: activity.agentId,
            type: 'system',
            message: `Due today: ${activity.activityType} with ${activity.contact.name}`,
            relatedId: activity.id,
          },
        })
      }
      console.log(`[cron] Sent ${dueToday.length} due-today reminders`)
    } catch (err) {
      console.error('[cron] Error running daily reminder:', err)
    }
  })

  // 3. Automated SQLite WAL-safe Database Backup Job
  const backupSchedule = process.env.BACKUP_CRON_SCHEDULE || '0 2 * * *' // Default daily at 2:00 AM
  cron.schedule(backupSchedule, async () => {
    console.log('[cron] Running automated SQLite WAL-safe database backup...')
    try {
      let backupDir = process.env.BACKUP_DIR
      if (!backupDir) {
        backupDir = process.env.PROGRAMDATA
          ? path.join(process.env.PROGRAMDATA, 'CallTrackTraining', 'backups')
          : path.join(/*turbopackIgnore: true*/ process.cwd(), 'backups-training')
      } else if (!path.isAbsolute(backupDir)) {
        backupDir = process.env.PROGRAMDATA
          ? path.join(process.env.PROGRAMDATA, 'CallTrackTraining', backupDir)
          : path.join(/*turbopackIgnore: true*/ process.cwd(), backupDir)
      }

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true })
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
      const backupFilePath = path.join(backupDir, `calltrack-backup-${timestamp}.db`)
      const normalizedPath = backupFilePath.replace(/\\/g, '/')

      // VACUUM INTO creates a zero-corruption point-in-time snapshot of SQLite in WAL mode
      await prisma.$executeRawUnsafe(`VACUUM INTO '${normalizedPath}'`)
      console.log(`[cron] ✅ SQLite backup created successfully at: ${backupFilePath}`)

      // Retention cleanup (Default 14 days)
      const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10)
      if (retentionDays > 0) {
        try {
          const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('calltrack-backup-') && f.endsWith('.db'))
            .map(f => {
              const fullPath = path.join(backupDir!, f)
              const stat = fs.statSync(fullPath)
              return { name: f, fullPath, mtimeMs: stat.mtimeMs }
            })
            .sort((a, b) => b.mtimeMs - a.mtimeMs) // newest first

          const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000
          // Never delete the newest verified backup (index 0)
          for (let i = 1; i < files.length; i++) {
            if (files[i].mtimeMs < cutoffMs) {
              fs.unlinkSync(files[i].fullPath)
              console.log(`[cron] 🗑️ Pruned old backup beyond ${retentionDays} days retention: ${files[i].name}`)
            }
          }
        } catch (pruneErr) {
          console.warn('[cron] ⚠️ Warning pruning old backups:', pruneErr)
        }
      }
    } catch (err) {
      console.error('[cron] ❌ Error executing automated SQLite database backup:', err)
    }
  })
}

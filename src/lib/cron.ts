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
      const backupDirName = process.env.BACKUP_DIR || 'backups-training'
      const backupDir = path.join(/*turbopackIgnore: true*/ process.cwd(), backupDirName)
      if (!fs.existsSync(/*turbopackIgnore: true*/ backupDir)) {
        fs.mkdirSync(/*turbopackIgnore: true*/ backupDir, { recursive: true })
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
      const backupFilePath = path.join(backupDir, `calltrack-backup-${timestamp}.db`)
      const normalizedPath = backupFilePath.replace(/\\/g, '/')

      // VACUUM INTO creates a zero-corruption point-in-time snapshot of SQLite in WAL mode
      await prisma.$executeRawUnsafe(`VACUUM INTO '${normalizedPath}'`)
      console.log(`[cron] ✅ SQLite backup created successfully at: ${backupFilePath}`)
    } catch (err) {
      console.error('[cron] ❌ Error executing automated SQLite database backup:', err)
    }
  })
}

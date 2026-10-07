import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { initServer } from '@/lib/server-init'

export async function GET() {
  initServer()
  const startTime = Date.now()
  let databaseStatus = 'unknown'
  let dbLatencyMs = -1

  try {
    const dbStart = Date.now()
    await prisma.$queryRawUnsafe('SELECT 1')
    dbLatencyMs = Date.now() - dbStart
    databaseStatus = 'connected'

    return NextResponse.json({
      status: 'ok',
      application: 'Call Track Training',
      version: '0.2.0',
      process: {
        alive: true,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        nodeVersion: process.version,
      },
      database: {
        status: databaseStatus,
        latencyMs: dbLatencyMs,
      },
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        status: 'degraded',
        application: 'Call Track Training',
        version: '0.2.0',
        process: {
          alive: true,
          uptimeSeconds: Math.floor(process.uptime()),
        },
        database: {
          status: 'disconnected',
          error: err instanceof Error ? err.message : 'Database ping failed',
        },
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}

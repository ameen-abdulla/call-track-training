import { startCronJobs } from './cron'

let started = false

export function checkEnvironmentConfig() {
  const isProd = process.env.NODE_ENV === 'production'
  const authUrl = process.env.AUTH_URL
  const nextAuthUrl = process.env.NEXTAUTH_URL

  const isLocalhost = (url?: string) =>
    Boolean(url && (url.includes('localhost') || url.includes('127.0.0.1')))

  if (isProd && (isLocalhost(authUrl) || isLocalhost(nextAuthUrl))) {
    const offending = isLocalhost(authUrl)
      ? `AUTH_URL="${authUrl}"`
      : `NEXTAUTH_URL="${nextAuthUrl}"`
    console.warn(`
================================================================================
⚠️  [CALL TRACK CONFIGURATION WARNING]
Production environment detected with localhost Auth URL:
  ${offending}

When deployed behind reverse proxies (Cloudflare, Nginx, Coolify, Traefik),
having AUTH_URL or NEXTAUTH_URL set to localhost will cause redirect loops,
origin mismatches, and login failures.

Please update your environment variables in your hosting dashboard:
  AUTH_URL="https://calltrack.flexibook.ai"
  NEXTAUTH_URL="https://calltrack.flexibook.ai"
  AUTH_TRUST_HOST=true
================================================================================
`)
  }

  const KNOWN_PLACEHOLDERS = ['your-secret', 'change-me', 'development-secret', 'secret', 'changeme', 'password']
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ''

  if (isProd && (!secret || KNOWN_PLACEHOLDERS.includes(secret.toLowerCase()))) {
    const msg = `CRITICAL SECURITY ERROR: AUTH_SECRET is missing or matches a known insecure placeholder ('${secret}'). Application cannot start in production mode.`
    console.error(`\n================================================================================\n❌  [CALL TRACK FATAL CONFIGURATION ERROR]\n${msg}\n================================================================================\n`)
    throw new Error(msg)
  }
}

export function initServer() {
  if (typeof window === 'undefined' && !started) {
    checkEnvironmentConfig()
    startCronJobs()
    started = true
  }
}


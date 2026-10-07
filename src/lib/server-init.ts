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

  if (isProd && !process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    console.warn(`
================================================================================
⚠️  [CALL TRACK CONFIGURATION WARNING]
AUTH_SECRET or NEXTAUTH_SECRET is not set in production!
Authentication sessions will fail or be insecure.
Generate a secret with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
================================================================================
`)
  }
}

export function initServer() {
  if (typeof window === 'undefined' && !started) {
    checkEnvironmentConfig()
    startCronJobs()
    started = true
  }
}


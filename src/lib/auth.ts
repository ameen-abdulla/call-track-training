import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { rateLimit, resetLimit } from '@/lib/rate-limit'
import { normalizeEmail } from '@/lib/password-policy'

const FIVE_MINUTES = 5 * 60 * 1000
// 5 failed attempts per IP per 15 minutes before lockout
const LOGIN_LIMIT = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000

// In production, guard against accidentally having localhost configured for AUTH_URL or NEXTAUTH_URL.
// When deployed behind a reverse proxy (Cloudflare, Nginx, Coolify, Traefik), Auth.js rewrites the request origin
// to AUTH_URL if present. If it points to localhost, all redirects and origin validations fail.
if (process.env.NODE_ENV === 'production') {
  if (process.env.AUTH_URL && (process.env.AUTH_URL.includes('localhost') || process.env.AUTH_URL.includes('127.0.0.1'))) {
    console.warn(
      `[Call Track Auth] Detected localhost AUTH_URL ("${process.env.AUTH_URL}") in production. Unsetting to allow dynamic reverse proxy host resolution via trustHost: true.`
    )
    delete process.env.AUTH_URL
  }
  if (process.env.NEXTAUTH_URL && (process.env.NEXTAUTH_URL.includes('localhost') || process.env.NEXTAUTH_URL.includes('127.0.0.1'))) {
    console.warn(
      `[Call Track Auth] Detected localhost NEXTAUTH_URL ("${process.env.NEXTAUTH_URL}") in production. Unsetting to allow dynamic reverse proxy host resolution via trustHost: true.`
    )
    delete process.env.NEXTAUTH_URL
  }
}

// Ensure AUTH_TRUST_HOST is enabled for reverse proxy environments
if (!process.env.AUTH_TRUST_HOST) {
  process.env.AUTH_TRUST_HOST = 'true'
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        ipKey: { label: '', type: 'text' }, // forwarded by middleware for rate-limit key
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = normalizeEmail(credentials.email as string)
        // Rate-limit by email (prevents targeted brute-force even across IPs)
        const emailKey = `email:${email}`
        const rl = rateLimit('login', emailKey, LOGIN_LIMIT, LOGIN_WINDOW_MS)
        if (!rl.allowed) {
          const mins = Math.ceil(rl.retryAfterMs / 60000)
          throw new Error(`too_many_attempts:${mins}`)
        }

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!valid) return null

        // Successful login — clear the rate-limit bucket
        resetLimit('login', emailKey)

        // Block non-approved freelancers with specific error codes
        if (user.role === 'FREELANCER') {
          if (user.freelancerStatus === 'PENDING') {
            throw new Error('pending_approval')
          }
          if (user.freelancerStatus === 'REJECTED') {
            throw new Error('account_rejected')
          }
          if (user.freelancerStatus === 'SUSPENDED') {
            throw new Error('account_suspended')
          }
          if (user.freelancerStatus !== 'APPROVED') {
            throw new Error('account_not_approved')
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          freelancerStatus: user.freelancerStatus ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) {
        // In production, if baseUrl is localhost, resolve against AUTH_URL/NEXTAUTH_URL or return relative url
        if (
          process.env.NODE_ENV === 'production' &&
          (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))
        ) {
          const prodUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL
          if (prodUrl && !prodUrl.includes('localhost') && !prodUrl.includes('127.0.0.1')) {
            return `${prodUrl.replace(/\/$/, '')}${url}`
          }
          return url
        }
        return `${baseUrl}${url}`
      }
      // Allows callback URLs on the same origin
      try {
        const urlObj = new URL(url)
        const baseObj = new URL(baseUrl)
        if (urlObj.origin === baseObj.origin) return url

        // Also allow if origin matches configured non-localhost domain
        const envUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL
        if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
          const envObj = new URL(envUrl)
          if (urlObj.origin === envObj.origin) return url
        }
      } catch {
        // Invalid URL, fall back to baseUrl
      }
      return baseUrl
    },
    async jwt({ token, user }) {
      // On first login — populate token from user object
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
        token.freelancerStatus = (user as { freelancerStatus?: string | null }).freelancerStatus ?? null
        token.checkedAt = Date.now()
        return token
      }

      // Periodic re-check for freelancers (every 5 min)
      if (
        token.role === 'FREELANCER' &&
        token.checkedAt &&
        Date.now() - token.checkedAt > FIVE_MINUTES
      ) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { freelancerStatus: true },
        })
        if (dbUser) {
          token.freelancerStatus = dbUser.freelancerStatus ?? null
          token.checkedAt = Date.now()
        }
      }

      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.freelancerStatus = (token.freelancerStatus as string | null) ?? null
      }
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
})

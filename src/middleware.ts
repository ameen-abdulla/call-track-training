import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Builds resilient redirect URLs that preserve the user-facing origin and protocol,
 * especially behind reverse proxies (Coolify, Nginx, Cloudflare, Traefik).
 * Avoids falling back to raw internal container addresses (e.g., http://localhost:3000).
 */
function getSafeRedirectUrl(targetPath: string, req: NextRequest): URL {
  const url = req.nextUrl.clone()

  if (targetPath.includes('?')) {
    const [path, query] = targetPath.split('?')
    url.pathname = path
    url.search = query ? `?${query}` : ''
  } else {
    url.pathname = targetPath
    url.search = ''
  }

  // Reverse proxies pass original client host in X-Forwarded-Host or Host
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const forwardedProto = req.headers.get('x-forwarded-proto')

  if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
    url.host = forwardedHost.split(',')[0].trim()
    if (forwardedProto) {
      url.protocol = forwardedProto.split(',')[0].trim().replace(/:$/, '') + ':'
    }
  } else if (
    process.env.NODE_ENV === 'production' &&
    (url.hostname.includes('localhost') || url.hostname.includes('127.0.0.1'))
  ) {
    // If still resolving to localhost in production, fallback to configured AUTH_URL / NEXTAUTH_URL
    const envUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      try {
        const parsed = new URL(envUrl)
        url.protocol = parsed.protocol
        url.host = parsed.host
        url.port = parsed.port
      } catch {
        // ignore invalid URL
      }
    }
  }

  return url
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Public routes — use startsWith('/login') so query strings like /login?error=... are also public
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname === '/auth/signed-out' ||
    pathname.startsWith('/api/auth') ||
    pathname === '/api/health' ||
    pathname === '/api/healthz'

  if (isPublic) {
    // Only bounce away from /login if the user is actually allowed in
    // (ADMIN always allowed; FREELANCER only if APPROVED)
    // Non-approved freelancers must stay on /login to avoid a redirect loop
    if (
      session &&
      (pathname.startsWith('/login') || pathname.startsWith('/register')) &&
      (session.user.role === 'ADMIN' || session.user.freelancerStatus === 'APPROVED')
    ) {
      const dest = session.user.role === 'ADMIN' ? '/admin' : '/freelancer'
      return NextResponse.redirect(getSafeRedirectUrl(dest, req))
    }
    return NextResponse.next()
  }

  // Not logged in
  if (!session) {
    return NextResponse.redirect(getSafeRedirectUrl('/login', req))
  }

  // Block non-approved freelancers on every protected route
  if (
    session.user.role === 'FREELANCER' &&
    session.user.freelancerStatus !== 'APPROVED'
  ) {
    return NextResponse.redirect(getSafeRedirectUrl('/login?error=account_status', req))
  }

  // Role-based routing
  if (pathname.startsWith('/admin') && session.user.role !== 'ADMIN') {
    return NextResponse.redirect(getSafeRedirectUrl('/freelancer', req))
  }
  if (pathname.startsWith('/freelancer') && session.user.role !== 'FREELANCER') {
    return NextResponse.redirect(getSafeRedirectUrl('/admin', req))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)'],
}

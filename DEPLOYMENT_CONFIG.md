# Call Track — Production Deployment & Environment Guide

> **Target Canonical URL**: `https://calltrack.flexibook.ai`  
> **Target Dashboard**: `https://calltrack.flexibook.ai/admin`  
> **App Framework**: Next.js 16 (App Router) + NextAuth v5 (Auth.js) + Prisma ORM (SQLite WAL)

---

## 1. Quick Summary of Bug 1C & The Solution

In previous configurations, default environment templates contained:
```env
AUTH_URL="http://localhost:4000"
NEXTAUTH_URL="http://localhost:4000"
```
When deployed behind reverse proxies (Coolify, Nginx, Cloudflare, Traefik), NextAuth v5 overwrote incoming request origins with `AUTH_URL`. Consequently:
1. Unauthenticated requests to `/admin` redirected users to `http://localhost:4000/login` instead of `https://calltrack.flexibook.ai/login`.
2. Login callbacks failed due to origin mismatches and CSRF protection.

### Resilient Fixes Applied in Codebase:
- **`src/lib/auth.ts`**: Automatically detects if `AUTH_URL` or `NEXTAUTH_URL` was mistakenly left as `localhost` in production mode and strips it out so NextAuth falls back to dynamic host resolution using reverse proxy headers (`X-Forwarded-Host`, `X-Forwarded-Proto`) via `trustHost: true`. Added a safe redirect callback preventing localhost redirects.
- **`src/middleware.ts`**: Replaced all raw `new URL(..., req.url)` redirects with `getSafeRedirectUrl(..., req)` which inspects `req.nextUrl`, `X-Forwarded-Host`, and `X-Forwarded-Proto` to always preserve the public HTTPS domain.
- **`src/lib/server-init.ts`**: Logs an explicit startup warning if production is started with localhost auth URLs.

---

## 2. Production Environment Variables Matrix

Set these variables in your hosting dashboard (**Coolify**, **Railway**, **Docker Compose**, or **VPS `.env`**):

| Variable | Recommended Production Value | Required? | Notes |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | `production` | **Yes** | Enables optimized production builds and security rules |
| `PORT` | `3000` | Optional | Internal container port (mapped to reverse proxy) |
| `HOSTNAME` | `0.0.0.0` | Optional | Binds server to all container network interfaces |
| `DATABASE_URL` | `file:/data/dev.db` | **Yes** | Persistent volume path in Docker (or `file:./dev.db` if bare-metal) |
| `AUTH_SECRET` | *(64-char hex string)* | **Yes** | Secret for signing session tokens and JWTs |
| `NEXTAUTH_SECRET`| *(Same as AUTH_SECRET)* | **Yes** | Backward-compatibility alias for Auth.js |
| `AUTH_URL` | `https://calltrack.flexibook.ai` | **Yes** | **Canonical production URL. DO NOT leave as localhost!** |
| `NEXTAUTH_URL` | `https://calltrack.flexibook.ai` | **Yes** | **Canonical production URL. DO NOT leave as localhost!** |
| `AUTH_TRUST_HOST` | `true` | **Yes** | Instructs Auth.js to trust reverse proxy headers |
| `BACKUP_CRON_SCHEDULE` | `0 2 * * *` | Optional | Daily at 2:00 AM SQLite snapshot (WAL-safe) |

### How to Generate a Secure Auth Secret:
Run this on your terminal (PowerShell, Bash, or Node.js):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Or via OpenSSL:
```bash
openssl rand -base64 32
```
Copy the resulting string into both `AUTH_SECRET` and `NEXTAUTH_SECRET`.

---

## 3. Reverse Proxy Configuration

Call Track runs inside a Docker container or Node.js process listening on port `3000`. The reverse proxy (Nginx, Traefik/Coolify, Caddy, Cloudflare) must forward requests to port `3000` with the appropriate proxy headers.

### A. Nginx Configuration
```nginx
server {
    server_name calltrack.flexibook.ai;

    # SSL certificate configuration (managed via Certbot or custom certs)
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/calltrack.flexibook.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/calltrack.flexibook.ai/privkey.pem;

    client_max_body_size 25M; # Allows CSV lead imports

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forwarded Host & Protocol (CRUCIAL FOR AUTH.JS)
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;

        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name calltrack.flexibook.ai;
    return 301 https://$host$request_uri;
}
```

### B. Caddy Configuration
```caddyfile
calltrack.flexibook.ai {
    encode gzip zstd

    reverse_proxy 127.0.0.1:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
    }
}
```

### C. Coolify (Docker / Traefik)
If deploying via **Coolify**:
1. In your Coolify Project, choose **Docker Compose** or **Dockerfile**.
2. Set Domain to `https://calltrack.flexibook.ai`.
3. Set Port to `3000`.
4. Add Persistent Storage:
   - Volume Name: `call-track-data`
   - Destination Path: `/data`
5. In the **Environment Variables** tab, enter:
   ```env
   NODE_ENV=production
   DATABASE_URL=file:/data/dev.db
   AUTH_SECRET=<YOUR_GENERATED_SECRET>
   NEXTAUTH_SECRET=<YOUR_GENERATED_SECRET>
   AUTH_URL=https://calltrack.flexibook.ai
   NEXTAUTH_URL=https://calltrack.flexibook.ai
   AUTH_TRUST_HOST=true
   ```
6. Click **Deploy**. Coolify's Traefik reverse proxy handles SSL and headers automatically.

### D. Cloudflare Settings (Crucial!)
If your domain is proxied through Cloudflare (Orange Cloud enabled):
1. **SSL/TLS Encryption Mode**: Set to **Full (Strict)** or **Full**.
   > ⚠️ **CAUTION**: **NEVER** set Cloudflare to **Flexible**! In Flexible mode, Cloudflare connects to your origin over HTTP (`$scheme = http`). Next.js detects HTTP, issues a 301/307 redirect to HTTPS, and Cloudflare re-requests HTTP, causing an **infinite redirect loop (ERR_TOO_MANY_REDIRECTS)**.
2. **Always Use HTTPS**: Enabled.
3. **WebSockets**: Enabled (under Network settings).
4. **IP Geolocation / True-Client-IP**: Enabled.

---

## 4. Docker Compose Deployment (Self-Hosted VPS)

Use the provided `docker-compose.yml`:

```yaml
services:
  call-track:
    build: .
    container_name: call-track
    ports:
      - "127.0.0.1:3000:3000" # Expose only to local reverse proxy
    volumes:
      - call-track-data:/data
      - ./backups:/app/backups
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/data/dev.db
      - AUTH_SECRET=your-secure-generated-secret-min-32-chars
      - NEXTAUTH_SECRET=your-secure-generated-secret-min-32-chars
      - AUTH_URL=https://calltrack.flexibook.ai
      - NEXTAUTH_URL=https://calltrack.flexibook.ai
      - AUTH_TRUST_HOST=true
    restart: unless-stopped

volumes:
  call-track-data:
```

### Deploying via Docker Compose:
```bash
# 1. Build and start container in detached mode
docker compose up -d --build

# 2. View container logs to verify database push and seeding
docker compose logs -f call-track
```

---

## 5. Deployment Verification Checklist

Execute these 5 tests immediately after deployment to confirm 100% functionality:

### ✅ Test 1: Healthcheck API
Run from your terminal or browser:
```bash
curl -i https://calltrack.flexibook.ai/api/healthz
```
- **Expected response**: `HTTP/1.1 200 OK`
- **Body**: `{"status":"ok","time":"..."}`

---

### ✅ Test 2: Unauthenticated Middleware Redirection
Open an Incognito / Private browsing window and navigate directly to:
```
https://calltrack.flexibook.ai/admin
```
- **Expected response**:
  - The browser is redirected to: `https://calltrack.flexibook.ai/login`
  - **Verify**: The URL bar does **NOT** contain `localhost:3000` or `localhost:4000`.

---

### ✅ Test 3: Admin Login & Session Persistence
1. Go to `https://calltrack.flexibook.ai/login`.
2. Sign in with the seeded Admin credentials:
   - **Email**: `admin@calltrack.ai`
   - **Password**: *(The seeded admin password from `SEED_CREDENTIALS.txt` or your configured password)*
3. **Expected response**:
   - The user is redirected to `https://calltrack.flexibook.ai/admin`.
   - Admin command center metrics and leads load properly.
   - Open Browser DevTools > Application > Cookies: Verify `authjs.session-token` is present and marked `Secure`.

---

### ✅ Test 4: Freelancer Registration & Approval
1. Open an Incognito window and visit `https://calltrack.flexibook.ai/register`.
2. Register a new caller account (e.g., `testcaller@example.com`).
3. Verify the registration success message: "Your registration has been submitted and is pending admin approval."
4. In your Admin window (`https://calltrack.flexibook.ai/admin`), navigate to the **Team** tab.
5. Verify the new applicant appears under **Pending Approval**.
6. Click **Approve**.
7. In the Incognito window, log in with `testcaller@example.com`.
8. **Expected response**: The caller is redirected to `https://calltrack.flexibook.ai/freelancer`.

---

### ✅ Test 5: Sign Out Redirection
1. In either Admin or Freelancer view, click **Sign Out**.
2. **Expected response**: The browser redirects cleanly to `https://calltrack.flexibook.ai/auth/signed-out` on the public domain.

---

### ✅ Test 6: Database Persistence Check
Verify that the database persists across container restarts:
```bash
docker compose restart call-track
```
Refresh `https://calltrack.flexibook.ai/admin` — verify all data, contacts, and approved users remain intact.

---

## 6. Troubleshooting Common Issues

### Issue A: "UntrustedHost" Error in Logs
- **Cause**: NextAuth detected an incoming Host header that wasn't trusted.
- **Fix**: Ensure `AUTH_TRUST_HOST=true` is set in your environment and your reverse proxy forwards `X-Forwarded-Host: calltrack.flexibook.ai`.

### Issue B: Redirect Loop (ERR_TOO_MANY_REDIRECTS)
- **Cause**: Cloudflare SSL mode is set to "Flexible".
- **Fix**: Change Cloudflare SSL/TLS to **Full** or **Full (Strict)**. Ensure Nginx forwards `X-Forwarded-Proto $scheme`.

### Issue C: Redirects to `http://localhost:...`
- **Cause**: An old `.env` file with `AUTH_URL=http://localhost:4000` is being used, or the reverse proxy stripped the `Host` header.
- **Fix**:
  1. In your hosting environment variables, update `AUTH_URL` and `NEXTAUTH_URL` to `https://calltrack.flexibook.ai`.
  2. The code in `src/lib/auth.ts` will automatically strip localhost in `NODE_ENV=production` as a fallback.

### Issue D: Database Resets on Container Redeploy
- **Cause**: Volume mapping missing in Docker.
- **Fix**: Ensure `DATABASE_URL=file:/data/dev.db` and the named volume `call-track-data:/data` is defined in `docker-compose.yml` or your Coolify volume settings.

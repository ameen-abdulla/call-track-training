import type { Metadata, Viewport } from 'next'
import { Manrope, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { initServer } from '@/lib/server-init'
import { ThemeProvider } from '@/components/theme-provider'

const manrope = Manrope({
  variable: '--font-heading',
  subsets: ['latin'],
  display: 'swap',
})

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#d97706',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: '[TRAINING] Call Track — Tele-Calling Command Center',
  description: 'Enterprise Marketing Call & Feedback Tracking Platform — Training Instance',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Call Track Training' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  initServer()

  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="bg-[var(--bg)] text-[var(--text-primary)] font-sans antialiased min-h-screen selection:bg-[var(--accent)] selection:text-white transition-colors duration-150">
        <div className="bg-amber-500 text-slate-950 font-mono text-[11px] font-bold py-1 px-3 text-center uppercase tracking-wider sticky top-0 z-50 shadow-xs flex items-center justify-center gap-2">
          <span>⚠️ TRAINING ENVIRONMENT — Port 4000 — Changes here do not affect production</span>
        </div>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

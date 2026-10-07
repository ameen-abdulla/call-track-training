'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import { Clock, CheckCircle2 } from 'lucide-react'
import { PasswordRequirements } from '@/components/password-requirements'
import { validatePassword } from '@/lib/password-policy'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', applicationNote: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const pwCheck = validatePassword(form.password)
    if (!pwCheck.valid) {
      setError(pwCheck.errors[0])
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] flex items-center justify-center p-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 w-full max-w-sm text-center shadow-[var(--shadow-raised)] space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <h1 className="text-base font-bold text-[var(--text-primary)]">Application Submitted</h1>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Your freelancer account is pending administrator review. You will be able to log in once your application has been approved.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold py-2.5 rounded-[var(--radius-sm)] shadow-xs transition-colors"
            >
              Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>

        <div className="text-center mb-6">
          <div className="w-10 h-10 mx-auto rounded-[var(--radius-sm)] bg-[var(--accent)] text-white flex items-center justify-center font-bold text-lg shadow-sm mb-3">
            CT
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Apply as Caller</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Tele-calling freelancer registration</p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-raised)] p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs p-3 rounded-[var(--radius-sm)]">
                {error}
              </div>
            )}

            <div>
              <label className="block font-semibold text-[var(--text-secondary)] mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block font-semibold text-[var(--text-secondary)] mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block font-semibold text-[var(--text-secondary)] mb-1">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                placeholder="+974..."
              />
            </div>

            <div>
              <label className="block font-semibold text-[var(--text-secondary)] mb-1">Password *</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={e => {
                  setForm(f => ({ ...f, password: e.target.value }))
                  if (error) setError('')
                }}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                placeholder="••••••••"
              />
              <PasswordRequirements password={form.password} />
            </div>

            <div>
              <label className="block font-semibold text-[var(--text-secondary)] mb-1">Application Note / Referral</label>
              <textarea
                value={form.applicationNote}
                onChange={e => setForm(f => ({ ...f, applicationNote: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none resize-none"
                placeholder="Who referred you or your tele-calling experience..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white py-2.5 rounded-[var(--radius-sm)] font-semibold text-xs shadow-xs disabled:opacity-50 transition-colors"
            >
              {loading ? 'Submitting Application...' : 'Submit Application'}
            </button>
          </form>

          <p className="text-center text-[var(--text-muted)] text-xs pt-2 border-t border-[var(--border)]">
            Already registered?{' '}
            <Link href="/login" className="text-[var(--accent)] hover:underline font-semibold">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

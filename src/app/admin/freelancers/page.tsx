'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Search, CheckCircle2, AlertCircle, Phone, Mail, ArrowLeft, Trash2, UserCheck, UserX } from 'lucide-react'
import { PasswordRequirements } from '@/components/password-requirements'
import { validatePassword } from '@/lib/password-policy'

interface Freelancer {
  id: string
  name: string
  email: string
  phone: string | null
  freelancerStatus: string | null
  applicationNote: string | null
  appliedAt: string | null
  _count: { assignedContacts: number; calls: number }
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/20' },
  APPROVED: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/20' },
  REJECTED: { bg: 'bg-red-500/10', text: 'text-red-700 dark:text-red-300', border: 'border-red-500/20' },
  SUSPENDED: { bg: 'bg-orange-500/10', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500/20' },
}

export default function FreelancersPage() {
  const router = useRouter()
  const [freelancers, setFreelancers] = useState<Freelancer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingFreelancer, setDeletingFreelancer] = useState<Freelancer | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [newFreelancer, setNewFreelancer] = useState({ name: '', email: '', phone: '', password: '', applicationNote: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [message, setMessage] = useState('')

  const loadFreelancers = () => {
    fetch('/api/admin/freelancers')
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        if (Array.isArray(data)) setFreelancers(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading freelancers:', err)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadFreelancers()
  }, [])

  const pending = freelancers.filter(f => f.freelancerStatus === 'PENDING')
  const approved = freelancers.filter(f => f.freelancerStatus === 'APPROVED')

  const filtered = freelancers.filter(f => {
    if (!search) return true
    const s = search.toLowerCase()
    return f.name.toLowerCase().includes(s) || f.email.toLowerCase().includes(s) || (f.phone && f.phone.includes(s))
  })

  async function handleCreateFreelancer(e: React.FormEvent) {
    e.preventDefault()
    const pwCheck = validatePassword(newFreelancer.password)
    if (!pwCheck.valid) {
      setCreateError(pwCheck.errors[0])
      return
    }
    setCreating(true)
    setCreateError('')

    try {
      const res = await fetch('/api/admin/freelancers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFreelancer),
      })

      let data: any = null
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null)
      } else {
        const text = await res.text().catch(() => '')
        data = { error: text || `Server returned ${res.status} ${res.statusText}` }
      }

      if (!res.ok) {
        let errorMessage = data?.error || 'Failed to create freelancer'
        if (res.status === 401) {
          errorMessage = 'Session expired. Please log in again.'
        } else if (res.status === 403) {
          errorMessage = 'You do not have permission to perform this action.'
        } else if (res.status === 409) {
          errorMessage = data?.error || 'An account with this email already exists.'
        } else if (res.status === 400) {
          errorMessage = data?.error || 'Validation error'
        } else if (res.status >= 500) {
          errorMessage = data?.error || `Server error (${res.status}). Please try again or contact support.`
        }
        setCreateError(errorMessage)
      } else {
        setShowAddModal(false)
        setNewFreelancer({ name: '', email: '', phone: '', password: '', applicationNote: '' })
        setMessage(`Freelancer account for "${data?.name || newFreelancer.name}" created successfully.`)
        loadFreelancers()
      }
    } catch (err: unknown) {
      console.error('Error creating freelancer:', err)
      const isNetworkError =
        err instanceof TypeError &&
        (err.message.toLowerCase().includes('fetch') ||
          err.message.toLowerCase().includes('network') ||
          err.message.toLowerCase().includes('failed to fetch'))

      if (isNetworkError) {
        setCreateError('Unable to reach server. Please check your internet connection or server status.')
      } else {
        setCreateError(err instanceof Error ? err.message : 'Unable to reach server. Please check your internet connection or server status.')
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteFreelancer() {
    if (!deletingFreelancer) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/freelancers/${deletingFreelancer.id}`, {
        method: 'DELETE',
      })
      let data: any = null
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null)
      } else {
        const text = await res.text().catch(() => '')
        data = { error: text || `Server returned ${res.status} ${res.statusText}` }
      }

      if (res.ok) {
        setDeletingFreelancer(null)
        setMessage(data?.message || 'Freelancer removed successfully.')
        loadFreelancers()
      } else {
        let errorMessage = data?.error || 'Failed to delete freelancer'
        if (res.status === 401) {
          errorMessage = 'Session expired. Please log in again.'
        } else if (res.status === 403) {
          errorMessage = 'You do not have permission to perform this action.'
        } else if (res.status >= 500) {
          errorMessage = data?.error || `Server error (${res.status}). Please try again or contact support.`
        }
        alert(errorMessage)
      }
    } catch (err: unknown) {
      console.error('Error deleting freelancer:', err)
      const isNetworkError =
        err instanceof TypeError &&
        (err.message.toLowerCase().includes('fetch') ||
          err.message.toLowerCase().includes('network') ||
          err.message.toLowerCase().includes('failed to fetch'))
      alert(
        isNetworkError
          ? 'Unable to reach server. Please check your internet connection or server status.'
          : (err instanceof Error ? err.message : 'Error connecting to server.')
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link
              href="/admin"
              className="text-[var(--text-secondary)] hover:text-[var(--accent)] text-xs flex items-center gap-1 mb-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </Link>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Caller Team & Freelancers</h1>
            <p className="text-xs text-[var(--text-secondary)]">Manage accounts, permissions, and lead quotas</p>
          </div>

          <div className="flex items-center gap-2">
            {pending.length > 0 && (
              <Link
                href="/admin/freelancers/pending"
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{pending.length} Pending Review</span>
              </Link>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-3.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Freelancer</span>
            </button>
          </div>
        </div>

        {message && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs px-3.5 py-2.5 rounded-[var(--radius-sm)] flex items-center justify-between">
            <span>✓ {message}</span>
            <button onClick={() => setMessage('')} className="text-emerald-500 hover:text-emerald-700">✕</button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 shadow-[var(--shadow-card)]">
            <span className="text-[11px] text-[var(--text-secondary)]">Total Callers</span>
            <p className="text-lg font-bold font-mono text-[var(--text-primary)] mt-0.5">{freelancers.length}</p>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 shadow-[var(--shadow-card)]">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Approved</span>
            <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{approved.length}</p>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 shadow-[var(--shadow-card)]">
            <span className="text-[11px] text-amber-600 dark:text-amber-400">Pending</span>
            <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">{pending.length}</p>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 shadow-[var(--shadow-card)]">
            <span className="text-[11px] text-blue-600 dark:text-blue-400">Assigned Leads</span>
            <p className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
              {freelancers.reduce((acc, f) => acc + (f._count?.assignedContacts || 0), 0)}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none shadow-xs"
          />
        </div>

        {/* List of Freelancers */}
        {loading ? (
          <p className="text-center py-12 text-xs text-[var(--text-muted)]">Loading callers...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-[var(--radius-md)] p-12 text-center text-xs text-[var(--text-muted)] space-y-1">
            <p className="font-semibold text-[var(--text-primary)]">No freelancers found</p>
            <p>Click "Add Freelancer" or share the registration link (`/register`).</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(f => {
              const statusStyle = STATUS_STYLES[f.freelancerStatus ?? ''] ?? { bg: 'bg-[var(--bg)]', text: 'text-[var(--text-secondary)]', border: 'border-[var(--border)]' }

              return (
                <div
                  key={f.id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] p-3.5 shadow-[var(--shadow-card)] flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Link
                        href={`/admin/freelancers/${f.id}`}
                        className="font-bold text-sm text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                      >
                        {f.name}
                      </Link>
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.2 rounded-[var(--radius-sm)] border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                        {f.freelancerStatus ?? 'UNKNOWN'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)] mt-1 flex-wrap">
                      <span>✉️ {f.email}</span>
                      {f.phone && <span>📞 {f.phone}</span>}
                    </div>

                    {f.applicationNote && (
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 bg-[var(--bg)] p-2 rounded-[var(--radius-sm)] border border-[var(--border)] line-clamp-1">
                        Note: {f.applicationNote}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right font-mono bg-[var(--bg)] px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)]">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{f._count?.assignedContacts ?? 0}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">leads assigned</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/freelancers/${f.id}`}
                        className="px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] font-medium"
                      >
                        Manage →
                      </Link>

                      <button
                        onClick={() => setDeletingFreelancer(f)}
                        className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-red-600 hover:bg-red-500/10 transition-colors"
                        title="Delete Freelancer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Freelancer Confirmation Modal */}
      {deletingFreelancer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md p-5 shadow-[var(--shadow-modal)] space-y-3 text-xs">
            <div className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Delete Freelancer Account?</h3>
            </div>

            <p className="text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to permanently delete <strong>{deletingFreelancer.name}</strong> ({deletingFreelancer.email})?
            </p>

            {deletingFreelancer._count?.assignedContacts > 0 && (
              <div className="p-2.5 rounded-[var(--radius-sm)] bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold">
                ⚠️ {deletingFreelancer._count.assignedContacts} currently assigned contacts will be safely returned to the Unassigned Pool.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingFreelancer(null)}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFreelancer}
                disabled={deleting}
                className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-red-600 hover:bg-red-700 text-white font-semibold shadow-xs"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Freelancer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-sm p-5 shadow-[var(--shadow-modal)] space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Create Approved Freelancer</h3>
              <button onClick={() => { setShowAddModal(false); setCreateError('') }} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
            </div>

            <form onSubmit={handleCreateFreelancer} className="space-y-2.5 text-xs">
              {createError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-600 text-[11px] p-2 rounded-[var(--radius-sm)]">
                  {createError}
                </div>
              )}

              <div>
                <label className="font-semibold text-[var(--text-secondary)]">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Caller"
                  value={newFreelancer.name}
                  onChange={e => setNewFreelancer(p => ({ ...p, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[var(--text-secondary)]">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="sarah@example.com"
                  value={newFreelancer.email}
                  onChange={e => setNewFreelancer(p => ({ ...p, email: e.target.value }))}
                  className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[var(--text-secondary)]">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+974..."
                  value={newFreelancer.phone}
                  onChange={e => setNewFreelancer(p => ({ ...p, phone: e.target.value }))}
                  className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[var(--text-secondary)]">Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  value={newFreelancer.password}
                  onChange={e => {
                    setNewFreelancer(p => ({ ...p, password: e.target.value }))
                    if (createError) setCreateError('')
                  }}
                  className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
                <PasswordRequirements password={newFreelancer.password} />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setCreateError('') }}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-xs"
                >
                  {creating ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

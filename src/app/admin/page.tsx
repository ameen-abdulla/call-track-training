'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import {
  Users, Phone, TrendingUp, AlertCircle, Upload, UserPlus, Bell,
  Pencil, Search, Filter, CheckCircle2, UserCheck, UserX, Tag as TagIcon,
  Sparkles, Trash2, History, BarChart3, Edit3, ArrowRight, ShieldAlert,
  Calendar, RotateCcw, LayoutDashboard, Layers, PieChart as PieIcon, Settings,
  LogOut, PhoneCall, ShieldCheck, CheckSquare, ChevronRight, Menu, X
} from 'lucide-react'
import { NotificationBell } from '@/components/notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'
import { PasswordRequirements } from '@/components/password-requirements'
import { validatePassword } from '@/lib/password-policy'

// Analytics Components
import { KPIStrip, KPIsData } from '@/components/analytics/kpi-strip'
import { TagCoverageChart } from '@/components/analytics/tag-coverage-chart'
import { FreelancerWorkloadTable } from '@/components/analytics/freelancer-workload-table'
import { ConnectedChart } from '@/components/analytics/connected-chart'
import { InteractionsTimeline } from '@/components/analytics/interactions-timeline'
import { ResponseAnalyticsChart } from '@/components/analytics/response-analytics-chart'
import { InterestAreaChart } from '@/components/analytics/interest-area-chart'
import { FollowupPipelineCard } from '@/components/analytics/followup-pipeline-card'
import { DataQualityPanel } from '@/components/analytics/data-quality-panel'
import { SalesFunnelChart } from '@/components/analytics/sales-funnel-chart'
import { UrgencyBadge } from '@/components/urgency-badge'
import { UrgencyPanel } from '@/components/analytics/urgency-panel'
import { CallOutcomesTable } from '@/components/analytics/call-outcomes-table'
import { ContactUrgency } from '@/lib/urgency'

interface Tag {
  id: string
  name: string
}

interface Contact {
  id: string
  name: string
  phone: string
  phone2: string | null
  email: string | null
  company: string | null
  source: string | null
  status: string
  topic: string | null
  callPriority?: string | null
  tags?: { tag: { id: string; name: string } }[]
  assignedTo?: { id: string; name: string; email?: string } | null
  _count?: { calls: number; interactions?: number }
  urgency?: ContactUrgency
}

interface OverdueActivity {
  id: string
  activityType: string
  dueDate: string
  contact: { name: string; phone: string }
  agent: { name: string }
}

interface Freelancer {
  id: string
  name: string
  email: string
  phone?: string | null
  freelancerStatus: string | null
  _count?: { assignedContacts: number; calls: number }
}

const STATUS_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  new: { bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-500/20' },
  queued: { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500/20' },
  contacted: { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/20' },
  follow_up: { bg: 'bg-orange-500/10', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500/20' },
  converted: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-500/20' },
  lost: { bg: 'bg-red-500/10', text: 'text-red-700 dark:text-red-400', border: 'border-red-500/20' },
}

export default function AdminDashboard() {
  const { data: session } = useSession()
  
  // Navigation State
  const [mainView, setMainView] = useState<'analytics' | 'contacts' | 'overdue' | 'freelancers' | 'settings'>('analytics')
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'overview' | 'team' | 'pipeline' | 'outcomes'>('overview')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Analytics Filters
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [analyticsDateRange, setAnalyticsDateRange] = useState('all') // all | today | 7d | 30d
  const [analyticsFreelancer, setAnalyticsFreelancer] = useState('all')
  const [analyticsTag, setAnalyticsTag] = useState('all')
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  // Contacts State
  const [contacts, setContacts] = useState<Contact[]>([])
  const [overdueList, setOverdueList] = useState<OverdueActivity[]>([])
  const [selectedFollowupBucket, setSelectedFollowupBucket] = useState('overdue')
  const [followupsLoading, setFollowupsLoading] = useState(false)
  const [freelancers, setFreelancers] = useState<Freelancer[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [pendingFreelancers, setPendingFreelancers] = useState<number>(0)
  const [search, setSearch] = useState('')
  const [filterAssignment, setFilterAssignment] = useState('all')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [loading, setLoading] = useState(true)

  // Modals
  const [showAddContact, setShowAddContact] = useState(false)
  const [showAddFreelancer, setShowAddFreelancer] = useState(false)
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [showAssign, setShowAssign] = useState<Contact | null>(null)
  const [showContactDetail, setShowContactDetail] = useState<Contact | null>(null)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null)
  const [deletingFreelancer, setDeletingFreelancer] = useState<Freelancer | null>(null)
  const [deletingFreelancerLoading, setDeletingFreelancerLoading] = useState(false)
  
  // Add Contact Form
  const [newContact, setNewContact] = useState({
    name: '', phone: '', phone2: '', email: '', company: '', source: '', topic: '', callPriority: '', assignedToId: '', tagIds: [] as string[]
  })
  const [addingContact, setAddingContact] = useState(false)

  // Edit Contact Form
  const [editFormData, setEditFormData] = useState({
    name: '', phone: '', phone2: '', email: '', company: '', source: '', topic: '', callPriority: '', status: '', tagIds: [] as string[]
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // Add Freelancer Form
  const [newFreelancer, setNewFreelancer] = useState({ name: '', email: '', phone: '', password: '', applicationNote: '' })
  const [creatingFreelancer, setCreatingFreelancer] = useState(false)
  const [createFreelancerError, setCreateFreelancerError] = useState('')

  // Add Admin Form
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' })
  const [creatingAdmin, setCreatingAdmin] = useState(false)
  const [createAdminError, setCreateAdminError] = useState('')
  const [adminSuccessMessage, setAdminSuccessMessage] = useState('')

  // Assign Form
  const [assignAgentId, setAssignAgentId] = useState('')
  const [assignTopic, setAssignTopic] = useState('')
  const [assigning, setAssigning] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)

  // Clear Data (Danger Zone) state
  const [clearDataText, setClearDataText] = useState('')
  const [clearDataLoading, setClearDataLoading] = useState(false)
  const [clearDataResult, setClearDataResult] = useState<{ success: boolean; contacts: number; calls: number; interactions: number; activities: number } | null>(null)

  // Persist last opened view in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('calltrack_admin_view')
      if (saved && ['analytics', 'contacts', 'overdue', 'freelancers', 'settings'].includes(saved)) {
        setMainView(saved as typeof mainView)
      }
      const savedSub = localStorage.getItem('calltrack_admin_subtab')
      if (savedSub && ['overview', 'team', 'pipeline', 'outcomes'].includes(savedSub)) {
        setAnalyticsSubTab(savedSub as typeof analyticsSubTab)
      }
    } catch {}
  }, [])

  const handleSetMainView = (v: typeof mainView) => {
    setMainView(v)
    try { localStorage.setItem('calltrack_admin_view', v) } catch {}
  }

  const handleSetSubTab = (s: typeof analyticsSubTab) => {
    setAnalyticsSubTab(s)
    try { localStorage.setItem('calltrack_admin_subtab', s) } catch {}
  }

  // Fetch Analytics Data
  useEffect(() => {
    let ignore = false
    async function loadAnalytics() {
      setAnalyticsLoading(true)
      try {
        const query = new URLSearchParams()
        query.set('dateRange', analyticsDateRange)
        if (analyticsFreelancer && analyticsFreelancer !== 'all') query.set('freelancerId', analyticsFreelancer)
        if (analyticsTag && analyticsTag !== 'all') query.set('tagId', analyticsTag)

        const res = await fetch(`/api/admin/analytics?${query.toString()}`)
        if (res.ok && !ignore) {
          const data = await res.json()
          setAnalyticsData(data)
        }
      } catch (err) {
        console.error('Error fetching analytics:', err)
      } finally {
        if (!ignore) setAnalyticsLoading(false)
      }
    }

    loadAnalytics()
    return () => { ignore = true }
  }, [analyticsDateRange, analyticsFreelancer, analyticsTag, refreshKey])

  // Fetch Core Contacts & Freelancers
  useEffect(() => {
    let ignore = false
    async function loadCoreData() {
      try {
        const queryParams = new URLSearchParams()
        if (search) queryParams.set('search', search)
        if (filterAssignment && filterAssignment !== 'all') queryParams.set('assignment', filterAssignment)
        if (filterStatus) queryParams.set('status', filterStatus)
        if (filterPriority) queryParams.set('callPriority', filterPriority)
        if (filterTag) queryParams.set('tagId', filterTag)
        if (filterUrgency) queryParams.set('urgency', filterUrgency)

        const [contactsRes, freelancersRes, tagsRes, dashRes] = await Promise.all([
          fetch(`/api/contacts?${queryParams.toString()}`),
          fetch('/api/admin/freelancers'),
          fetch('/api/admin/tags'),
          fetch('/api/admin/dashboard'),
        ])

        const [contactsData, freelancersData, tagsData, dashData] = await Promise.all([
          contactsRes.ok ? contactsRes.json().catch(() => []) : [],
          freelancersRes.ok ? freelancersRes.json().catch(() => []) : [],
          tagsRes.ok ? tagsRes.json().catch(() => []) : [],
          dashRes.ok ? dashRes.json().catch(() => ({} as any)) : ({} as any),
        ])

        if (!ignore) {
          if (Array.isArray(contactsData)) setContacts(contactsData)
          if (Array.isArray(freelancersData)) setFreelancers(freelancersData)
          if (Array.isArray(tagsData)) setTags(tagsData)
          if (dashData?.pendingFreelancers !== undefined) setPendingFreelancers(dashData.pendingFreelancers)
        }
      } catch (e) {
        console.error('Error loading core data:', e)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadCoreData()
    return () => { ignore = true }
  }, [search, filterAssignment, filterStatus, filterPriority, filterTag, filterUrgency, refreshKey])

  // Fetch Activities for Overdue / Follow-ups View based on selected bucket
  useEffect(() => {
    let ignore = false
    async function loadActivities() {
      setFollowupsLoading(true)
      try {
        const res = await fetch(`/api/activities?bucket=${selectedFollowupBucket}`)
        if (res.ok && !ignore) {
          const data = await res.json()
          if (Array.isArray(data)) {
            setOverdueList(data)
          }
        }
      } catch (err) {
        console.error('Error fetching activities:', err)
      } finally {
        if (!ignore) setFollowupsLoading(false)
      }
    }

    loadActivities()
    return () => { ignore = true }
  }, [selectedFollowupBucket, refreshKey])

  const refreshAll = () => setRefreshKey(k => k + 1)

  // Actions
  async function handleAddContact() {
    setAddingContact(true)
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newContact),
    })
    setAddingContact(false)
    setShowAddContact(false)
    setNewContact({ name: '', phone: '', phone2: '', email: '', company: '', source: '', topic: '', callPriority: '', assignedToId: '', tagIds: [] })
    refreshAll()
  }

  const openEditContact = (c: Contact) => {
    setEditingContact(c)
    setEditFormData({
      name: c.name,
      phone: c.phone,
      phone2: c.phone2 || '',
      email: c.email || '',
      company: c.company || '',
      source: c.source || '',
      topic: c.topic || '',
      callPriority: c.callPriority || '',
      status: c.status || 'new',
      tagIds: c.tags?.map(t => t.tag.id) || [],
    })
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingContact) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/contacts/${editingContact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      })
      if (res.ok) {
        setEditingContact(null)
        refreshAll()
      } else {
        alert('Failed to update contact')
      }
    } catch {
      alert('Error updating contact')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteContact() {
    if (!deletingContact) return
    try {
      const res = await fetch(`/api/contacts/${deletingContact.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeletingContact(null)
        setShowContactDetail(null)
        refreshAll()
      } else {
        alert('Failed to delete contact')
      }
    } catch {
      alert('Error connecting to server')
    }
  }

  async function handleDeleteFreelancer() {
    if (!deletingFreelancer) return
    setDeletingFreelancerLoading(true)
    try {
      const res = await fetch(`/api/admin/freelancers/${deletingFreelancer.id}`, { method: 'DELETE' })
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
        refreshAll()
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
      setDeletingFreelancerLoading(false)
    }
  }

  async function handleCreateFreelancer(e: React.FormEvent) {
    e.preventDefault()
    const pwCheck = validatePassword(newFreelancer.password)
    if (!pwCheck.valid) {
      setCreateFreelancerError(pwCheck.errors[0])
      return
    }
    setCreatingFreelancer(true)
    setCreateFreelancerError('')
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
        setCreateFreelancerError(errorMessage)
      } else {
        setShowAddFreelancer(false)
        setNewFreelancer({ name: '', email: '', phone: '', password: '', applicationNote: '' })
        refreshAll()
      }
    } catch (err: unknown) {
      console.error('Error creating freelancer:', err)
      const isNetworkError =
        err instanceof TypeError &&
        (err.message.toLowerCase().includes('fetch') ||
          err.message.toLowerCase().includes('network') ||
          err.message.toLowerCase().includes('failed to fetch'))

      if (isNetworkError) {
        setCreateFreelancerError('Unable to reach server. Please check your internet connection or server status.')
      } else {
        setCreateFreelancerError(err instanceof Error ? err.message : 'Unable to reach server. Please check your internet connection or server status.')
      }
    } finally {
      setCreatingFreelancer(false)
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault()
    const pwCheck = validatePassword(newAdmin.password)
    if (!pwCheck.valid) {
      setCreateAdminError(pwCheck.errors[0])
      return
    }
    setCreatingAdmin(true)
    setCreateAdminError('')
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAdmin.name,
          email: newAdmin.email,
          password: newAdmin.password,
          role: 'ADMIN',
        }),
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
        let errorMessage = data?.error || 'Failed to create admin user'
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
        setCreateAdminError(errorMessage)
      } else {
        setShowAddAdmin(false)
        setNewAdmin({ name: '', email: '', password: '' })
        setAdminSuccessMessage(`Admin account for "${data?.name || newAdmin.name}" created successfully.`)
        setTimeout(() => setAdminSuccessMessage(''), 6000)
        refreshAll()
      }
    } catch (err: unknown) {
      console.error('Error creating admin:', err)
      const isNetworkError =
        err instanceof TypeError &&
        (err.message.toLowerCase().includes('fetch') ||
          err.message.toLowerCase().includes('network') ||
          err.message.toLowerCase().includes('failed to fetch'))

      if (isNetworkError) {
        setCreateAdminError('Unable to reach server. Please check your internet connection or server status.')
      } else {
        setCreateAdminError(err instanceof Error ? err.message : 'Unable to reach server. Please check your internet connection or server status.')
      }
    } finally {
      setCreatingAdmin(false)
    }
  }

  async function handleAssign() {
    if (!showAssign) return
    setAssigning(true)
    await fetch(`/api/contacts/${showAssign.id}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: assignAgentId, topic: assignTopic }),
    })
    setAssigning(false)
    setShowAssign(null)
    setAssignAgentId('')
    setAssignTopic('')
    refreshAll()
  }

  async function handleRemind(activityId: string) {
    await fetch(`/api/activities/${activityId}/remind`, { method: 'POST' })
    alert('Reminder sent to freelancer!')
  }

  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/contacts/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        alert(`Imported ${data.imported} contacts successfully!`)
        refreshAll()
      } else {
        alert(data.error || 'Failed to import contacts')
      }
    } catch {
      alert('Network error while importing contacts')
    } finally {
      e.target.value = ''
    }
  }

  async function handleClearData() {
    if (clearDataText !== 'DELETE ALL DATA') return
    setClearDataLoading(true)
    try {
      const res = await fetch('/api/admin/clear-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationText: clearDataText }),
      })
      const data = await res.json()
      if (res.ok) {
        setClearDataResult(data)
        setClearDataText('')
        refreshAll()
      } else {
        alert(data.error || 'Failed to clear data')
      }
    } catch {
      alert('Error connecting to server')
    } finally {
      setClearDataLoading(false)
    }
  }

  const approvedFreelancers = freelancers.filter(f => f.freelancerStatus === 'APPROVED' || !f.freelancerStatus)
  const assignedCount = contacts.filter(c => c.assignedTo).length
  const unassignedCount = contacts.filter(c => !c.assignedTo).length

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col justify-between bg-[var(--surface)] border-r border-[var(--border)] p-4 shrink-0 shadow-[var(--shadow-card)]">
        <div className="space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white flex items-center justify-center font-bold text-base shadow-sm">
              CT
            </div>
            <div>
              <h2 className="font-bold text-sm text-[var(--text-primary)] leading-tight">Call Track</h2>
              <p className="text-[10px] text-[var(--text-secondary)]">Tele-Calling Ops Center</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1">
            {[
              { key: 'analytics', label: 'Command Center', icon: LayoutDashboard, onClick: () => { handleSetMainView('analytics'); handleSetSubTab('overview') }, active: mainView === 'analytics' && analyticsSubTab !== 'outcomes' },
              { key: 'contacts', label: 'Contacts & Leads', icon: Users, badge: contacts.length, onClick: () => handleSetMainView('contacts'), active: mainView === 'contacts' },
              { key: 'outcomes', label: 'Call Outcomes', icon: PhoneCall, onClick: () => { handleSetMainView('analytics'); handleSetSubTab('outcomes') }, active: mainView === 'analytics' && analyticsSubTab === 'outcomes' },
              { key: 'overdue', label: 'Overdue Follow-ups', icon: AlertCircle, badge: overdueList.length, danger: overdueList.length > 0, onClick: () => handleSetMainView('overdue'), active: mainView === 'overdue' },
              { key: 'freelancers', label: 'Freelancer Roster', icon: Users, badge: pendingFreelancers > 0 ? `${pendingFreelancers} new` : undefined, onClick: () => handleSetMainView('freelancers'), active: mainView === 'freelancers' },
              { key: 'settings', label: 'Settings', icon: Settings, onClick: () => handleSetMainView('settings'), active: mainView === 'settings' },
            ].map(item => {
              const Icon = item.icon
              const active = item.active

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[var(--radius-sm)] text-xs font-medium transition-all ${
                    active
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                      item.danger
                        ? 'bg-red-500/15 text-red-600 dark:text-red-400 animate-pulse'
                        : active
                        ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                        : 'bg-[var(--bg)] text-[var(--text-secondary)]'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}

            <div className="pt-4 mt-4 border-t border-[var(--border)] space-y-1">
              <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                Admin Management
              </span>

              <Link
                href="/admin/calendar"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-sm)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Team Calendar</span>
              </Link>

              <Link
                href="/admin/tags"
                className="w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-sm)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <TagIcon className="w-3.5 h-3.5" />
                  <span>Category Tags</span>
                </div>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{tags.length}</span>
              </Link>

              <Link
                href="/admin/activity-logs"
                className="w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-sm)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <History className="w-3.5 h-3.5" />
                  <span>Audit Activity Logs</span>
                </div>
              </Link>

              <Link
                href="/admin/contacts/deleted"
                className="w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-sm)] text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Deleted Contacts Pool</span>
                </div>
              </Link>
            </div>
          </nav>
        </div>

        {/* User & Sign Out Footer */}
        <div className="pt-4 border-t border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-primary)]">
                {session?.user?.name?.[0] || 'A'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{session?.user?.name || 'Admin User'}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate">{session?.user?.email}</p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/auth/signed-out' })}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-red-600 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs">
            CT
          </div>
          <span className="font-bold text-sm text-[var(--text-primary)]">Call Track</span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-secondary)]"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[var(--surface)] border-b border-[var(--border)] p-4 space-y-2 z-30">
          {[
            { key: 'analytics', label: 'Command Center', icon: LayoutDashboard, onClick: () => { handleSetMainView('analytics'); handleSetSubTab('overview') }, active: mainView === 'analytics' && analyticsSubTab !== 'outcomes' },
            { key: 'contacts', label: 'Contacts & Leads', icon: Users, count: contacts.length, onClick: () => handleSetMainView('contacts'), active: mainView === 'contacts' },
            { key: 'outcomes', label: 'Call Outcomes', icon: PhoneCall, onClick: () => { handleSetMainView('analytics'); handleSetSubTab('outcomes') }, active: mainView === 'analytics' && analyticsSubTab === 'outcomes' },
            { key: 'overdue', label: 'Overdue Follow-ups', icon: AlertCircle, count: overdueList.length, onClick: () => handleSetMainView('overdue'), active: mainView === 'overdue' },
            { key: 'freelancers', label: 'Freelancer Roster', icon: Users, onClick: () => handleSetMainView('freelancers'), active: mainView === 'freelancers' },
            { key: 'settings', label: 'Settings', icon: Settings, onClick: () => handleSetMainView('settings'), active: mainView === 'settings' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => { item.onClick(); setMobileMenuOpen(false) }}
              className={`w-full flex items-center justify-between p-2.5 rounded-[var(--radius-sm)] text-xs font-medium ${
                item.active ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-bold' : 'text-[var(--text-secondary)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && <span className="font-mono text-[10px]">{item.count}</span>}
            </button>
          ))}

          <div className="pt-2 border-t border-[var(--border)] flex justify-between gap-2">
            <Link href="/admin/calendar" className="text-xs text-[var(--text-secondary)] py-1.5">Calendar</Link>
            <Link href="/admin/activity-logs" className="text-xs text-[var(--text-secondary)] py-1.5">Audit Logs</Link>
            <Link href="/admin/contacts/deleted" className="text-xs text-red-600 py-1.5">Deleted Pool</Link>
            <button onClick={() => signOut({ callbackUrl: '/auth/signed-out' })} className="text-xs text-[var(--text-secondary)] py-1.5">Sign Out</button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Sticky Filter / Context Bar */}
        <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 sticky top-0 md:top-0 z-20 shadow-xs">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-base font-bold text-[var(--text-primary)]">
                {mainView === 'analytics' ? 'Tele-Calling Command Center' :
                 mainView === 'contacts' ? 'Contact Pipeline & Lead Pool' :
                 mainView === 'overdue' ? 'Overdue Follow-ups & Reminders' :
                 mainView === 'settings' ? 'Settings & Danger Zone' :
                 'Freelancer Team & Workload'}
              </h1>
              <p className="text-[11px] text-[var(--text-secondary)]">
                AutoTrace Qatar Ops Pipeline · Real-time Sync
              </p>
            </div>

            {/* Filter controls for Analytics */}
            {mainView === 'analytics' && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Horizon Selector */}
                <div className="flex bg-[var(--bg)] p-0.5 rounded-[var(--radius-sm)] border border-[var(--border)]">
                  {['all', 'today', '7d', '30d'].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setAnalyticsDateRange(d)}
                      className={`px-2.5 py-1 rounded-[4px] text-[11px] font-medium transition-all ${
                        analyticsDateRange === d
                          ? 'bg-[var(--surface)] text-[var(--accent)] font-semibold shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {d === 'all' ? 'All Time' : d === 'today' ? 'Today' : d === '7d' ? '7D' : '30D'}
                    </button>
                  ))}
                </div>

                {/* Freelancer Filter */}
                <select
                  value={analyticsFreelancer}
                  onChange={e => setAnalyticsFreelancer(e.target.value)}
                  className="px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-[11px] text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="all">👥 All Freelancers</option>
                  {approvedFreelancers.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>

                {/* Tag Filter */}
                <select
                  value={analyticsTag}
                  onChange={e => setAnalyticsTag(e.target.value)}
                  className="px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-[11px] text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="all">🏷️ All Tags</option>
                  {tags.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* View Contents */}
        <div className="max-w-6xl w-full mx-auto p-4 space-y-4 pb-20">
          {/* ===================== VIEW 1: COMMAND CENTER (ANALYTICS) ===================== */}
          {mainView === 'analytics' && (
            <div className="space-y-4">
              {/* Progressive Disclosure Sub-Tabs */}
              <div className="flex border-b border-[var(--border)] gap-6 text-xs font-semibold overflow-x-auto">
                {[
                  { key: 'overview', label: '📊 Executive Overview' },
                  { key: 'team', label: '👥 Team & Tag Coverage' },
                  { key: 'pipeline', label: '📈 Conversion Funnel & Outcomes' },
                  { key: 'outcomes', label: '📞 Call Outcomes' },
                ].map(st => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => handleSetSubTab(st.key as typeof analyticsSubTab)}
                    className={`pb-2.5 border-b-2 transition-all whitespace-nowrap ${
                      analyticsSubTab === st.key
                        ? 'border-[var(--accent)] text-[var(--accent)] font-bold'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {analyticsLoading || !analyticsData ? (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] p-12 text-center text-xs text-[var(--text-muted)]">
                  Loading telemetry analytics...
                </div>
              ) : (
                <>
                  {/* Top KPI Strip is persistent across analytics views */}
                  <KPIStrip
                    kpis={analyticsData.kpis}
                    onSelectFilter={(type) => {
                      if (type === 'overdue') {
                        setSelectedFollowupBucket('overdue')
                        handleSetMainView('overdue')
                        return
                      }
                      if (type === 'calls') {
                        handleSetMainView('analytics')
                        handleSetSubTab('outcomes')
                        return
                      }
                      if (type === 'demos') {
                        handleSetMainView('analytics')
                        handleSetSubTab('pipeline')
                        return
                      }
                      handleSetMainView('contacts')
                      // Reset stale filters so contacts are visible
                      setFilterPriority('')
                      setFilterTag('')
                      setFilterUrgency('')
                      setSearch('')
                      if (type === 'unassigned') {
                        setFilterAssignment('unassigned')
                        setFilterStatus('')
                      } else if (type === 'assigned') {
                        setFilterAssignment('assigned')
                        setFilterStatus('')
                      } else if (type === 'converted') {
                        setFilterAssignment('all')
                        setFilterStatus('converted')
                      } else {
                        setFilterAssignment('all')
                        setFilterStatus('')
                      }
                    }}
                  />

                  {/* Subtab 1: Executive Overview */}
                  {analyticsSubTab === 'overview' && (
                    <div className="space-y-4">
                      {/* Priority Pair: Reachability Donut + Followup Urgency */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <ConnectedChart data={analyticsData.connectedVsNot} />
                        <FollowupPipelineCard
                          data={analyticsData.followupPipeline}
                          onSelectBucket={(bucketKey) => {
                            if (bucketKey === 'noFollowup') {
                              handleSetMainView('contacts')
                              setFilterAssignment('all')
                              setFilterPriority('')
                              setFilterTag('')
                              setFilterUrgency('')
                              setFilterStatus('')
                              setSearch('')
                            } else {
                              setSelectedFollowupBucket(bucketKey)
                              handleSetMainView('overdue')
                            }
                          }}
                        />
                      </div>

                      {/* Lead Outreach Urgency Meter */}
                      <UrgencyPanel
                        data={analyticsData.urgency}
                        onFilterClick={(statusKey) => {
                          handleSetMainView('contacts')
                          setFilterPriority('')
                          setFilterTag('')
                          setSearch('')
                          setFilterStatus('')
                          if (statusKey === 'unassigned') {
                            setFilterAssignment('unassigned')
                            setFilterUrgency('')
                          } else {
                            setFilterAssignment('assigned')
                            setFilterUrgency(statusKey) // 'red' | 'orange' | 'green' | 'attempted'
                          }
                        }}
                      />

                      {/* Actionable Pipeline Health Inbox */}
                      <DataQualityPanel data={analyticsData.dataQuality} />
                    </div>
                  )}

                  {/* Subtab 2: Team & Coverage */}
                  {analyticsSubTab === 'team' && (
                    <div className="space-y-4">
                      <TagCoverageChart data={analyticsData.tagCoverage} />
                      <FreelancerWorkloadTable data={analyticsData.freelancerWorkload} />
                    </div>
                  )}

                  {/* Subtab 3: Conversion Funnel & Outcomes */}
                  {analyticsSubTab === 'pipeline' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <SalesFunnelChart data={analyticsData.salesFunnel} />
                        <ResponseAnalyticsChart data={analyticsData.responseBreakdown} />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <InterestAreaChart data={analyticsData.interestAreaBreakdown} />
                        <InteractionsTimeline data={analyticsData.interactionsTimeline} />
                      </div>
                    </div>
                  )}

                  {/* Subtab 4: Call Outcomes */}
                  {analyticsSubTab === 'outcomes' && (
                    <div className="space-y-4">
                      <CallOutcomesTable initialFreelancerId={analyticsFreelancer !== 'all' ? analyticsFreelancer : undefined} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ===================== VIEW 2: CONTACTS & LEADS ===================== */}
          {mainView === 'contacts' && (
            <div className="space-y-3">
              {/* Segmented Pool Switcher */}
              <div className="grid grid-cols-3 gap-2 bg-[var(--surface)] p-1.5 rounded-[var(--radius-md)] border border-[var(--border)] shadow-[var(--shadow-card)]">
                <button
                  type="button"
                  onClick={() => {
                    setFilterAssignment('all')
                    setFilterUrgency('')
                  }}
                  className={`py-2 px-3 rounded-[var(--radius-sm)] text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                    filterAssignment === 'all'
                      ? 'bg-[var(--accent)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'
                  }`}
                >
                  <span>📋 All Contacts</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">{contacts.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterAssignment('unassigned')
                    setFilterUrgency('')
                  }}
                  className={`py-2 px-3 rounded-[var(--radius-sm)] text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                    filterAssignment === 'unassigned'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'
                  }`}
                >
                  <UserX className="w-3.5 h-3.5 text-amber-500" />
                  <span>Unassigned Pool</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">{unassignedCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterAssignment('assigned')
                    setFilterUrgency('')
                  }}
                  className={`py-2 px-3 rounded-[var(--radius-sm)] text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                    filterAssignment === 'assigned'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Assigned Leads</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">{assignedCount}</span>
                </button>
              </div>

              {/* Filter and Action Bar */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 shadow-[var(--shadow-card)] space-y-2.5">
                <div className="flex gap-2 flex-wrap items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      placeholder="Search name, phone, company, freelancer..."
                      value={search}
                      onChange={e => {
                        setSearch(e.target.value)
                      }}
                      className="w-full pl-8 pr-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                  </div>

                  <select
                    value={filterPriority}
                    onChange={e => {
                      setFilterPriority(e.target.value)
                      setFilterUrgency('')
                    }}
                    className="px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">Priority: All</option>
                    <option value="A">Priority A</option>
                    <option value="B">Priority B</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={e => {
                      setFilterStatus(e.target.value)
                      setFilterUrgency('')
                    }}
                    className="px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">Status: All</option>
                    {['new', 'queued', 'contacted', 'follow_up', 'converted', 'lost'].map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>

                  <select
                    value={filterUrgency}
                    onChange={e => setFilterUrgency(e.target.value)}
                    className="px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">Urgency: All</option>
                    <option value="red">🔴 Red (&gt;48h)</option>
                    <option value="orange">🟠 Orange (24–48h)</option>
                    <option value="green">🟢 Green (&lt;24h)</option>
                    <option value="attempted">⚪ Attempted</option>
                  </select>

                  <select
                    value={filterTag}
                    onChange={e => {
                      setFilterTag(e.target.value)
                      setFilterUrgency('')
                    }}
                    className="px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">Tag: All</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  {(search || filterPriority || filterStatus || filterUrgency || filterTag || filterAssignment !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        setFilterPriority('')
                        setFilterStatus('')
                        setFilterUrgency('')
                        setFilterTag('')
                        setFilterAssignment('all')
                      }}
                      className="p-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-xs flex items-center gap-1"
                      title="Reset all filters"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowAddContact(true)}
                    className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-sm)] flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Prospect</span>
                  </button>

                  <label className="bg-[var(--bg)] hover:bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-medium px-3 py-1.5 rounded-[var(--radius-sm)] flex items-center gap-1.5 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import CSV</span>
                    <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
                  </label>
                </div>
              </div>

              {/* Scannable Lead Records */}
              {loading ? (
                <div className="text-center py-12 text-xs text-[var(--text-muted)]">Loading contacts...</div>
              ) : contacts.length === 0 ? (
                <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-[var(--radius-md)] p-12 text-center text-xs text-[var(--text-muted)] space-y-1">
                  <p className="font-semibold text-[var(--text-primary)]">No contacts match the current criteria</p>
                  <p>Try resetting search or filters.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {contacts.map(contact => {
                    const assigned = contact.assignedTo
                    const statusMeta = STATUS_BADGES[contact.status] || STATUS_BADGES.new

                    return (
                      <div
                        key={contact.id}
                        className={`bg-[var(--surface)] border rounded-[var(--radius-md)] p-3.5 shadow-[var(--shadow-card)] transition-all hover:border-[var(--accent)]/50 ${
                          !assigned ? 'border-amber-500/30' : 'border-[var(--border)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowContactDetail(contact)}>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-bold text-sm text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                                {contact.name}
                              </span>

                              <span className={`text-[10px] font-mono font-semibold px-2 py-0.2 rounded-[var(--radius-sm)] border ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}>
                                {contact.status.replace('_', ' ')}
                              </span>

                              {contact.callPriority && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-[var(--radius-sm)] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  Pri {contact.callPriority}
                                </span>
                              )}

                              {assigned ? (
                                <span className="text-[11px] px-2 py-0.2 rounded-[var(--radius-sm)] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-medium flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 text-indigo-500" />
                                  <span>{assigned.name}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono font-bold px-2 py-0.2 rounded-[var(--radius-sm)] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                  <UserX className="w-3 h-3 text-amber-500" />
                                  UNASSIGNED
                                </span>
                              )}

                              <UrgencyBadge urgency={contact.urgency} />
                            </div>

                            {contact.company && <p className="text-xs text-[var(--text-secondary)]">{contact.company}</p>}

                            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-1.5 flex-wrap font-mono">
                              <span>📞 {contact.phone}</span>
                              {contact.phone2 && <span>📱 {contact.phone2}</span>}
                              {contact.email && <span>✉️ {contact.email}</span>}
                              {contact._count?.interactions !== undefined && (
                                <span>({contact._count.interactions} logs)</span>
                              )}
                            </div>

                            {contact.topic && (
                              <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 bg-[var(--bg)] px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] line-clamp-1">
                                📋 {contact.topic}
                              </p>
                            )}
                          </div>

                          {/* Quick Action Controls */}
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setShowAssign(contact)
                                setAssignAgentId(contact.assignedTo?.id || '')
                                setAssignTopic(contact.topic || '')
                              }}
                              className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all border ${
                                assigned
                                  ? 'bg-[var(--bg)] hover:bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-primary)]'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs'
                              }`}
                            >
                              {assigned ? 'Reassign' : 'Assign'}
                            </button>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditContact(contact)}
                                className="p-1 hover:bg-[var(--bg)] rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                                title="Edit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setDeletingContact(contact)}
                                className="p-1 hover:bg-red-500/10 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-red-600 transition-colors"
                                title="Soft Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setShowContactDetail(contact)}
                                className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-1 font-medium"
                              >
                                Details →
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===================== VIEW 3: OVERDUE FOLLOW-UPS ===================== */}
          {mainView === 'overdue' && (
            <div className="space-y-3">
              {/* Bucket Selector Strip */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 bg-[var(--surface)] p-1.5 rounded-[var(--radius-md)] border border-[var(--border)] shadow-[var(--shadow-card)] flex-1">
                  {[
                    { key: 'overdue', label: 'All Overdue' },
                    { key: 'dueToday', label: 'Due Today' },
                    { key: 'next7Days', label: 'Next 7 Days' },
                    { key: 'days8to30', label: '8–30 Days' },
                    { key: 'days31Plus', label: '31+ Days' },
                  ].map(b => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setSelectedFollowupBucket(b.key)}
                      className={`py-2 px-3 rounded-[var(--radius-sm)] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        selectedFollowupBucket === b.key
                          ? b.key === 'overdue'
                            ? 'bg-red-600 text-white shadow-xs'
                            : b.key === 'dueToday'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-[var(--accent)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'
                      }`}
                    >
                      <span>{b.label}</span>
                    </button>
                  ))}
                </div>

                <Link
                  href="/admin/calendar"
                  className="text-xs text-[var(--accent)] hover:underline font-semibold whitespace-nowrap"
                >
                  View in Calendar →
                </Link>
              </div>

              {followupsLoading ? (
                <div className="text-center py-12 text-xs text-[var(--text-muted)]">Loading activities...</div>
              ) : overdueList.length === 0 ? (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] p-12 text-center text-xs text-[var(--text-muted)] space-y-1">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-1" />
                  <p className="font-semibold text-[var(--text-primary)] text-sm">
                    {selectedFollowupBucket === 'overdue'
                      ? 'All Scheduled Activities On Time'
                      : 'No Activities Scheduled'}
                  </p>
                  <p>
                    {selectedFollowupBucket === 'overdue'
                      ? 'No overdue follow-up calls or meetings found.'
                      : 'No follow-up calls or meetings scheduled for this timeframe.'}
                  </p>
                </div>
              ) : (
                overdueList.map(activity => (
                  <div key={activity.id} className="bg-[var(--surface)] border border-red-500/30 rounded-[var(--radius-md)] p-3.5 shadow-[var(--shadow-card)] flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[var(--text-primary)]">{activity.contact.name}</p>
                      <p className="text-xs font-mono text-[var(--text-secondary)]">{activity.contact.phone}</p>
                      <div className="flex items-center gap-2 mt-1 font-mono text-xs text-red-600 dark:text-red-400 font-semibold">
                        <span>{activity.activityType.toUpperCase()}</span>
                        <span>·</span>
                        <span>Due: {new Date(activity.dueDate).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Assigned to caller: {activity.agent.name}</p>
                    </div>

                    <button
                      onClick={() => handleRemind(activity.id)}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-sm)] border border-amber-500/30 flex items-center gap-1.5 transition-colors"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Send Nudge</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ===================== VIEW 4: FREELANCER ROSTER ===================== */}
          {mainView === 'freelancers' && (
            <div className="space-y-4">
              {adminSuccessMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs px-3.5 py-2.5 rounded-[var(--radius-sm)] flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>{adminSuccessMessage}</span>
                  </div>
                  <button onClick={() => setAdminSuccessMessage('')} className="text-emerald-500 hover:text-emerald-700">✕</button>
                </div>
              )}

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] p-4 shadow-[var(--shadow-card)] space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] text-sm">Freelancer Team ({freelancers.length})</h3>
                    <p className="text-[11px] text-[var(--text-secondary)]">Manage caller accounts and lead loads</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowAddAdmin(true); setCreateAdminError('') }}
                      className="bg-[var(--bg)] hover:bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-sm)] flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Add Admin</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAddFreelancer(true)}
                      className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-sm)] flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Freelancer</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {freelancers.map(agent => (
                    <div key={agent.id} className="p-3 bg-[var(--bg)] rounded-[var(--radius-sm)] border border-[var(--border)] flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/freelancers/${agent.id}`} className="font-bold text-xs text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                            {agent.name}
                          </Link>
                          <span className={`text-[10px] font-mono font-semibold px-2 py-0.2 rounded-[var(--radius-sm)] border ${
                            agent.freelancerStatus === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          }`}>
                            {agent.freelancerStatus || 'ACTIVE'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">{agent.email}</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right font-mono">
                          <p className="text-xs font-bold text-[var(--text-primary)]">{agent._count?.assignedContacts ?? 0} leads</p>
                        </div>

                        <div className="flex items-center gap-1">
                          <Link
                            href={`/admin/freelancers/${agent.id}`}
                            className="px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] text-[11px] font-medium"
                          >
                            Manage →
                          </Link>

                          <button
                            onClick={() => setDeletingFreelancer(agent)}
                            className="p-1 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-red-600 hover:bg-red-500/10 transition-colors"
                            title="Delete Freelancer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===================== VIEW 5: SETTINGS ===================== */}
          {mainView === 'settings' && (
            <div className="space-y-4 max-w-2xl">
              {/* Danger Zone Card */}
              <div className="bg-[var(--surface)] border-2 border-red-500/40 rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-card)] space-y-4">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-600" />
                  <div>
                    <h2 className="font-bold text-sm text-red-600 dark:text-red-400">Danger Zone — Clear All Data</h2>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Permanently deletes all contacts, calls, interactions, activities, and notifications.
                      User accounts and category tags are preserved. This action is irreversible.
                    </p>
                  </div>
                </div>

                {/* Current counts */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] p-2.5 text-center">
                    <p className="font-mono font-bold text-[var(--text-primary)] text-lg">{contacts.length}</p>
                    <p className="text-[var(--text-muted)]">contacts in system</p>
                  </div>
                  <div className="bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] p-2.5 text-center">
                    <p className="font-mono font-bold text-[var(--text-primary)] text-lg">
                      {analyticsData?.kpis?.callsLogged ?? '—'}
                    </p>
                    <p className="text-[var(--text-muted)]">call logs recorded</p>
                  </div>
                </div>

                {clearDataResult ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[var(--radius-sm)] p-3 space-y-1">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">✓ Data cleared successfully</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Deleted: {clearDataResult.contacts} contacts · {clearDataResult.calls} calls · {clearDataResult.interactions} interactions · {clearDataResult.activities} activities
                    </p>
                    <button
                      onClick={() => { setClearDataResult(null); window.location.reload() }}
                      className="text-[11px] text-[var(--accent)] underline"
                    >
                      Reload page
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-secondary)]">
                      To confirm, type <strong className="text-red-600 font-mono">DELETE ALL DATA</strong> exactly:
                    </p>
                    <input
                      type="text"
                      value={clearDataText}
                      onChange={e => setClearDataText(e.target.value)}
                      placeholder="Type DELETE ALL DATA to confirm"
                      className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-red-500/30 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-red-500"
                    />
                    <button
                      onClick={handleClearData}
                      disabled={clearDataText !== 'DELETE ALL DATA' || clearDataLoading}
                      className="w-full py-2.5 rounded-[var(--radius-sm)] text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {clearDataLoading ? 'Deleting...' : 'Clear All Data — Cannot Be Undone'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ===================== MODALS WITH PINNED FOOTERS ===================== */}

      {/* Edit Contact Modal */}
      {editingContact && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-lg shadow-[var(--shadow-modal)] flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Edit Contact Lead</h3>
                <p className="text-[10px] text-[var(--text-secondary)]">Edits are recorded in the audit trail.</p>
              </div>
              <button onClick={() => setEditingContact(null)} className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg)] text-[var(--text-muted)]">✕</button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveEdit} id="edit-contact-form" className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="font-semibold text-[var(--text-secondary)]">Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={e => setEditFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-[var(--text-secondary)]">Primary Phone *</label>
                  <input
                    type="tel"
                    required
                    value={editFormData.phone}
                    onChange={e => setEditFormData(p => ({ ...p, phone: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[var(--text-secondary)]">Mobile / WhatsApp</label>
                  <input
                    type="tel"
                    value={editFormData.phone2}
                    onChange={e => setEditFormData(p => ({ ...p, phone2: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-[var(--text-secondary)]">Email Address</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={e => setEditFormData(p => ({ ...p, email: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[var(--text-secondary)]">Company</label>
                  <input
                    type="text"
                    value={editFormData.company}
                    onChange={e => setEditFormData(p => ({ ...p, company: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-[var(--text-secondary)]">Priority</label>
                  <select
                    value={editFormData.callPriority}
                    onChange={e => setEditFormData(p => ({ ...p, callPriority: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">None</option>
                    <option value="A">Priority A</option>
                    <option value="B">Priority B</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[var(--text-secondary)]">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={e => setEditFormData(p => ({ ...p, status: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    {['new', 'queued', 'contacted', 'follow_up', 'converted', 'lost'].map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[var(--text-secondary)]">Topic to discuss</label>
                <textarea
                  value={editFormData.topic}
                  onChange={e => setEditFormData(p => ({ ...p, topic: e.target.value }))}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none resize-none"
                />
              </div>
            </form>

            {/* Pinned Sticky Footer */}
            <div className="p-3 border-t border-[var(--border)] bg-[var(--bg)] flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--surface)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-contact-form"
                disabled={savingEdit}
                className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-colors shadow-xs"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingContact && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-sm p-5 shadow-[var(--shadow-modal)] space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Delete Contact?</h3>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to soft-delete <strong>{deletingContact.name}</strong>?
              {deletingContact.assignedTo && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400 font-semibold">
                  ⚠️ This will automatically unassign {deletingContact.assignedTo.name}.
                </span>
              )}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingContact(null)}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteContact}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md shadow-[var(--shadow-modal)] flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Add New Prospect</h3>
              <button onClick={() => setShowAddContact(false)} className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg)] text-[var(--text-muted)]">✕</button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              {[
                { key: 'name', label: 'Prospect Name *', type: 'text', placeholder: 'e.g. Al Rayah Driving School' },
                { key: 'phone', label: 'Primary Phone *', type: 'tel', placeholder: '+974...' },
                { key: 'phone2', label: 'Mobile / WhatsApp', type: 'tel', placeholder: 'optional' },
                { key: 'company', label: 'Company / Org', type: 'text', placeholder: 'optional' },
                { key: 'email', label: 'Email', type: 'email', placeholder: 'optional' },
              ].map(field => (
                <div key={field.key}>
                  <label className="font-semibold text-[var(--text-secondary)]">{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={newContact[field.key as keyof typeof newContact] as string}
                    onChange={e => setNewContact(p => ({ ...p, [field.key]: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
              ))}

              <div>
                <label className="font-semibold text-[var(--text-secondary)]">Call Priority</label>
                <select
                  value={newContact.callPriority}
                  onChange={e => setNewContact(p => ({ ...p, callPriority: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="">None</option>
                  <option value="A">Priority A</option>
                  <option value="B">Priority B</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[var(--text-secondary)]">Topic / Notes</label>
                <textarea
                  placeholder="Talking points or target fleet details..."
                  value={newContact.topic}
                  onChange={e => setNewContact(p => ({ ...p, topic: e.target.value }))}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-3 border-t border-[var(--border)] bg-[var(--bg)] flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowAddContact(false)}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddContact}
                disabled={!newContact.name || !newContact.phone || addingContact}
                className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {addingContact ? 'Adding...' : 'Add Prospect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Freelancer Modal */}
      {showAddFreelancer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-sm p-5 shadow-[var(--shadow-modal)] space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Add Approved Freelancer</h3>
              <button onClick={() => { setShowAddFreelancer(false); setCreateFreelancerError('') }} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
            </div>

            <form onSubmit={handleCreateFreelancer} className="space-y-2.5 text-xs">
              {createFreelancerError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-600 text-[11px] p-2 rounded-[var(--radius-sm)]">
                  {createFreelancerError}
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
                <label className="font-semibold text-[var(--text-secondary)]">Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  value={newFreelancer.password}
                  onChange={e => {
                    setNewFreelancer(p => ({ ...p, password: e.target.value }))
                    if (createFreelancerError) setCreateFreelancerError('')
                  }}
                  className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
                <PasswordRequirements password={newFreelancer.password} />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddFreelancer(false); setCreateFreelancerError('') }}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFreelancer}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {creatingFreelancer ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {showAddAdmin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-sm p-5 shadow-[var(--shadow-modal)] space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Add Admin User</h3>
              <button onClick={() => { setShowAddAdmin(false); setCreateAdminError('') }} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-2.5 text-xs">
              {createAdminError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-600 text-[11px] p-2 rounded-[var(--radius-sm)]">
                  {createAdminError}
                </div>
              )}

              <div>
                <label className="font-semibold text-[var(--text-secondary)]">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Admin Name"
                  value={newAdmin.name}
                  onChange={e => setNewAdmin(p => ({ ...p, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[var(--text-secondary)]">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={newAdmin.email}
                  onChange={e => setNewAdmin(p => ({ ...p, email: e.target.value }))}
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
                  value={newAdmin.password}
                  onChange={e => {
                    setNewAdmin(p => ({ ...p, password: e.target.value }))
                    if (createAdminError) setCreateAdminError('')
                  }}
                  className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
                <PasswordRequirements password={newAdmin.password} />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddAdmin(false); setCreateAdminError('') }}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAdmin}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {creatingAdmin ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-sm p-5 shadow-[var(--shadow-modal)] space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <div>
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Assign Lead</h3>
                <p className="text-[10px] text-[var(--text-muted)]">{showAssign.name}</p>
              </div>
              <button onClick={() => setShowAssign(null)} className="p-1 text-[var(--text-muted)]">✕</button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="font-semibold text-[var(--text-secondary)]">Select Freelancer</label>
                <select
                  value={assignAgentId}
                  onChange={e => setAssignAgentId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="">-- Choose caller --</option>
                  {approvedFreelancers.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                  {showAssign.assignedTo && (
                    <option value="unassigned">⚠️ Unassign Lead</option>
                  )}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[var(--text-secondary)]">Instructions for Caller</label>
                <textarea
                  value={assignTopic}
                  onChange={e => setAssignTopic(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssign(null)}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={assigning}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  {assigning ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Detail Modal */}
      {showContactDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 shadow-[var(--shadow-modal)] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="font-bold text-sm text-[var(--text-primary)]">{showContactDetail.name}</h3>
                  {showContactDetail.company && <p className="text-[11px] text-[var(--text-secondary)]">{showContactDetail.company}</p>}
                </div>
                <UrgencyBadge urgency={showContactDetail.urgency} />
              </div>
              <button onClick={() => setShowContactDetail(null)} className="p-1 text-[var(--text-muted)]">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[var(--bg)] p-3 rounded-[var(--radius-sm)] border border-[var(--border)] font-mono">
                <div><span className="text-[var(--text-muted)] block text-[10px]">Primary Phone</span>{showContactDetail.phone}</div>
                <div><span className="text-[var(--text-muted)] block text-[10px]">Mobile / WA</span>{showContactDetail.phone2 || '—'}</div>
                <div><span className="text-[var(--text-muted)] block text-[10px]">Priority</span>{showContactDetail.callPriority ? `Priority ${showContactDetail.callPriority}` : '—'}</div>
                <div><span className="text-[var(--text-muted)] block text-[10px]">Status</span>{showContactDetail.status}</div>
              </div>

              {showContactDetail.topic && (
                <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--accent-subtle)] border border-[var(--accent)]/20 text-[var(--text-primary)]">
                  <span className="font-semibold text-[var(--accent)]">Topic: </span>{showContactDetail.topic}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Freelancer Confirmation Modal */}
      {deletingFreelancer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-sm p-5 shadow-[var(--shadow-modal)] space-y-3 text-xs">
            <div className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Delete Freelancer Account?</h3>
            </div>

            <p className="text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to permanently delete <strong>{deletingFreelancer.name}</strong> ({deletingFreelancer.email})?
            </p>

            {(deletingFreelancer._count?.assignedContacts ?? 0) > 0 && (
              <div className="p-2.5 rounded-[var(--radius-sm)] bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold">
                ⚠️ {deletingFreelancer._count?.assignedContacts} contacts will be unassigned and returned to the Unassigned Pool.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingFreelancer(null)}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFreelancer}
                disabled={deletingFreelancerLoading}
                className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-red-600 hover:bg-red-700 text-white font-semibold shadow-xs"
              >
                {deletingFreelancerLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

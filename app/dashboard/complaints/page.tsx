'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { AlertCircle, CheckCheck, ChevronDown, ChevronUp, Clock3, Inbox, MessageSquareText, Search, Send, UserRound, X } from 'lucide-react'

type Complaint = {
  id: number
  category?: string
  subject: string
  message: string
  status: string
  admin_read?: boolean
  adminRead?: boolean
  reply?: string | null
  createdAt?: string
  created_at?: string
  replies?: Array<{
    id: number
    message: string
    createdAt?: string
    created_at?: string
    sender?: { name?: string; role?: string }
  }>
  tenant?: {
    contactPerson?: string
    contact_person?: string
    businessName?: string
    business_name?: string
    user?: { email?: string }
  }
}

const unwrap = (response: any) => response?.data?.data ?? response?.data ?? response
const dateLabel = (value?: string) => value ? new Date(value).toLocaleString() : '—'
const statusStyle = (status: unknown) => {
  const normalized = String(status || 'pending').toLowerCase()
  if (normalized === 'resolved') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (normalized === 'in_progress') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-slate-200 bg-slate-100 text-slate-700'
}
const categoryLabel = (category?: string) => ({
  rental_space: 'Rental space',
  payments: 'Payments',
  contracts: 'Contracts',
  facilities: 'Facilities / maintenance',
  staff_service: 'Staff / service',
  other: 'Other',
}[category || 'other'] || 'Other')

export function ComplaintsPanel() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, { status: string; reply: string }>>({})
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedComplaintId, setExpandedComplaintId] = useState<number | null>(null)

  const loadComplaints = useCallback(async () => {
    try {
      const response = await apiClient.getComplaints()
      const data = unwrap(response)
      const rows = Array.isArray(data) ? data as Complaint[] : []
      setComplaints(rows)
      setDrafts(Object.fromEntries(rows.map((complaint) => [complaint.id, {
        status: complaint.status,
        reply: '',
      }])))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load complaints.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void loadComplaints() }, [loadComplaints])

  const counts = useMemo(() => ({
    all: complaints.length,
    pending: complaints.filter((complaint) => String(complaint.status).toLowerCase() === 'pending').length,
    in_progress: complaints.filter((complaint) => String(complaint.status).toLowerCase() === 'in_progress').length,
    resolved: complaints.filter((complaint) => String(complaint.status).toLowerCase() === 'resolved').length,
  }), [complaints])

  const filteredComplaints = useMemo(() => complaints.filter((complaint) => {
    const tenant = complaint.tenant || {}
    const tenantName = tenant.contactPerson || tenant.contact_person || tenant.businessName || tenant.business_name || ''
    const matchesStatus = statusFilter === 'all' || String(complaint.status).toLowerCase() === statusFilter
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [complaint.subject, complaint.message, categoryLabel(complaint.category), tenantName, tenant.user?.email].filter(Boolean).join(' ').toLowerCase().includes(query)
    return matchesStatus && matchesSearch
  }), [complaints, search, statusFilter])

  const save = async (complaint: Complaint) => {
    const draft = drafts[complaint.id]
    if (!draft) return
    setSavingId(complaint.id)
    setError('')
    try {
      await apiClient.updateComplaint(String(complaint.id), draft)
      await loadComplaints()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update this complaint.')
    } finally {
      setSavingId(null)
    }
  }

  const setFilter = (filter: string) => {
    setStatusFilter(filter)
    setExpandedComplaintId(null)
  }

  const openComplaint = async (complaint: Complaint) => {
    setExpandedComplaintId((current) => current === complaint.id ? null : complaint.id)
    if (complaint.admin_read || complaint.adminRead) return

    try {
      await apiClient.markComplaintRead(String(complaint.id))
      setComplaints((current) => current.map((item) => String(item.id) === String(complaint.id)
        ? { ...item, admin_read: true, adminRead: true }
        : item))
    } catch {
      // Keep the request open even if the read marker cannot be saved.
    }
  }

  return (
      <main className="space-y-6 pb-6">
        <header className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-100"><MessageSquareText className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Tenant support</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Complaint requests</h1>
              <p className="mt-1.5 text-sm text-slate-500">Review tenant concerns, update their progress, and send a response.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 sm:min-w-[390px]">
            {[
              { label: 'Pending', count: counts.pending, icon: AlertCircle, color: 'text-amber-700' },
              { label: 'In progress', count: counts.in_progress, icon: Clock3, color: 'text-blue-700' },
              { label: 'Resolved', count: counts.resolved, icon: CheckCheck, color: 'text-emerald-700' },
            ].map(({ label, count, icon: Icon, color }) => (
              <div key={label} className="px-3 py-3 sm:px-4">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"><Icon className={`h-3.5 w-3.5 ${color}`} />{label}</span>
                <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-900">{count}</p>
              </div>
            ))}
          </div>
        </header>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-4 border-b border-slate-200 p-4 sm:p-5">
            <label className="relative block"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setExpandedComplaintId(null) }} placeholder="Search by tenant, subject, category, or details" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-50" /></label>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter complaints by status">{[['all', 'All requests', counts.all], ['pending', 'Pending', counts.pending], ['in_progress', 'In progress', counts.in_progress], ['resolved', 'Resolved', counts.resolved]].map(([value, label, count]) => <button key={value} type="button" onClick={() => setFilter(String(value))} aria-pressed={statusFilter === value} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${statusFilter === value ? 'bg-teal-800 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800'}`}>{label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusFilter === value ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span></button>)}<span className="ml-auto text-xs text-slate-400">{filteredComplaints.length} request{filteredComplaints.length === 1 ? '' : 's'}</span></div>
          </div>

          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center">
              <div className="text-center"><div className="loading-spinner mx-auto" aria-hidden="true" /><p className="mt-4 text-sm text-slate-500">Loading support requests…</p></div>
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Inbox className="h-6 w-6" /></span>
              <h2 className="mt-4 text-base font-bold text-slate-900">{complaints.length ? 'No requests match these filters' : 'No complaints submitted'}</h2>
              <p className="mt-1 text-sm text-slate-500">{complaints.length ? 'Try another search term or status.' : 'Tenant requests will appear here.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredComplaints.map((complaint) => {
                const draft = drafts[complaint.id] || { status: complaint.status, reply: '' }
                const tenant = complaint.tenant || {}
                const tenantName = tenant.contactPerson || tenant.contact_person || tenant.businessName || tenant.business_name || 'Tenant'
                const isExpanded = expandedComplaintId === complaint.id
                const isUnread = !(complaint.admin_read || complaint.adminRead)
                const replyCount = complaint.replies?.length || (complaint.reply ? 1 : 0)
                const normalizedStatus = String(complaint.status || 'pending').toLowerCase()

                return (
                  <article key={complaint.id} className={`transition-colors ${isExpanded ? 'bg-slate-50/60' : 'bg-white hover:bg-slate-50/70'}`}>
                    <button type="button" onClick={() => void openComplaint(complaint)} aria-expanded={isExpanded} className="grid w-full gap-4 px-4 py-4 text-left sm:px-5 sm:py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                      <span className="flex min-w-0 items-start gap-3.5">
                        <span className={`relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isUnread ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-800'}`}>
                          {isUnread ? <AlertCircle className="h-5 w-5" /> : <MessageSquareText className="h-5 w-5" />}
                          {isUnread && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={`truncate text-sm text-slate-900 ${isUnread ? 'font-extrabold' : 'font-bold'}`}>{complaint.subject}</span>
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">{categoryLabel(complaint.category)}</span>
                            {isUnread && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">New</span>}
                          </span>
                          <span className="mt-1.5 block truncate text-xs leading-5 text-slate-500">{complaint.message}</span>
                          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600"><UserRound className="h-3 w-3" />{tenantName}</span>
                            {tenant.user?.email && <span className="truncate">{tenant.user.email}</span>}
                            <span>{dateLabel(complaint.createdAt || complaint.created_at)}</span>
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-3 pl-[58px] lg:justify-end lg:pl-0">
                        <span className="flex items-center gap-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${statusStyle(normalizedStatus)}`}><Clock3 className="h-3 w-3" />{normalizedStatus.replaceAll('_', ' ')}</span>
                          <span className="text-[10px] text-slate-400">{replyCount ? `${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}` : 'No replies'}</span>
                        </span>
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg border bg-white transition ${isExpanded ? 'border-teal-200 text-teal-800' : 'border-slate-200 text-slate-400'}`}>{isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/40 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpandedComplaintId(null) }}>
                        <section role="dialog" aria-modal="true" aria-labelledby={`complaint-title-${complaint.id}`} className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl">
                          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isUnread ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-800'}`}>
                              {isUnread ? <AlertCircle className="h-5 w-5" /> : <MessageSquareText className="h-5 w-5" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">{categoryLabel(complaint.category)} · {normalizedStatus.replaceAll('_', ' ')}</p>
                              <h2 id={`complaint-title-${complaint.id}`} className="truncate text-base font-bold text-slate-900">{complaint.subject}</h2>
                            </div>
                            <button type="button" onClick={() => setExpandedComplaintId(null)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100" aria-label="Close complaint details" title="Close complaint details">
                              <X className="h-4 w-4" />
                              <span className="sr-only">Close</span>
                            </button>
                          </header>
                          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold text-slate-900">Request conversation</p>
                                <p className="mt-0.5 text-[10px] text-slate-500">Submitted by {tenantName}</p>
                              </div>
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${statusStyle(normalizedStatus)}`}>
                                <Clock3 className="h-3 w-3" />{normalizedStatus.replaceAll('_', ' ')}
                              </span>
                            </div>
                            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                              <div className="flex items-start gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><UserRound className="h-4 w-4" /></span>
                                <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-slate-200 bg-slate-50 p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div><span className="text-xs font-bold text-slate-800">{tenantName}</span><span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500">{categoryLabel(complaint.category)}</span></div>
                                    <time className="text-[10px] text-slate-400">{dateLabel(complaint.createdAt || complaint.created_at)}</time>
                                  </div>
                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{complaint.message}</p>
                                </div>
                              </div>
                              {complaint.replies?.map((reply) => {
                                const fromTenant = String(reply.sender?.role || '').toLowerCase() === 'tenant'
                                return (
                                  <div key={reply.id} className={`flex ${fromTenant ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[90%] rounded-xl p-4 ${fromTenant ? 'border border-slate-200 bg-white' : 'border border-teal-100 bg-teal-50'}`}>
                                      <div className="flex flex-wrap items-center justify-between gap-3"><p className={`text-xs font-bold ${fromTenant ? 'text-slate-600' : 'text-teal-800'}`}>{fromTenant ? tenantName : 'Administration'}</p><time className="text-[10px] text-slate-400">{dateLabel(reply.createdAt || reply.created_at)}</time></div>
                                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{reply.message}</p>
                                    </div>
                                  </div>
                                )
                              })}
                              {!complaint.replies?.length && complaint.reply && (
                                <div className="flex justify-end"><div className="max-w-[90%] rounded-xl border border-teal-100 bg-teal-50 p-4"><p className="text-xs font-bold text-teal-800">Previous administration reply</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-teal-950">{complaint.reply}</p></div></div>
                              )}
                            </div>
                            {normalizedStatus === 'resolved' ? (
                              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCheck className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Request resolved</p><p className="mt-0.5 text-xs text-emerald-800">Replies are closed for both the tenant and administration.</p></div></div>
                            ) : (
                              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                                <p className="mb-4 text-xs font-bold text-slate-800">Update and reply</p>
                                <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Request status
                                    <select value={draft.status} onChange={(event) => setDrafts((current) => ({ ...current, [complaint.id]: { ...draft, status: event.target.value } }))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium normal-case text-slate-800 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-50"><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select>
                                  </label>
                                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Message to tenant
                                    <textarea value={draft.reply} onChange={(event) => setDrafts((current) => ({ ...current, [complaint.id]: { ...draft, reply: event.target.value } }))} maxLength={5000} rows={3} placeholder="Write a clear response or update…" className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal normal-case text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-50" />
                                  </label>
                                </div>
                                <div className="mt-4 flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
                                  <p className="text-[10px] text-slate-400">A reply is optional when only updating status.</p>
                                  <button type="button" onClick={() => void save(complaint)} disabled={savingId === complaint.id} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{savingId === complaint.id ? 'Saving…' : draft.reply.trim() ? 'Send response' : 'Save status'}</button>
                                </div>
                              </div>
                            )}
                          </div>
                      </section>
                    </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
  )
}

export default function ComplaintsPage() {
  return (
    <ProtectedRoute>
      <ComplaintsPanel />
    </ProtectedRoute>
  )
}

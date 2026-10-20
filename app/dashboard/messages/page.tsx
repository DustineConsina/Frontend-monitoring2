'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  X,
} from 'lucide-react'
import { ComplaintsPanel } from '../complaints/page'

type ChatUser = {
  id: string | number
  name?: string
  firstName?: string
  lastName?: string
  tenant?: {
    businessName?: string
    contactPerson?: string
  }
}

type SmsHistoryItem = {
  id: number
  message: string
  phoneNumber: string
  providerMessageId?: string
  status: string
  errorMessage?: string
  createdAt?: string
  recipientUser?: ChatUser
}

type WorkspaceTab = 'messages' | 'complaints'

const unwrap = (response: any) => response?.data?.data ?? response?.data ?? response
const getUserName = (user?: ChatUser) => {
  if (!user) return 'Unknown user'
  if ('name' in user && user.name) return user.name
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return name || 'Unknown user'
}
const isSuccessfulStatus = (status: string) => ['sent', 'delivered'].includes(status.toLowerCase())
const isFailedStatus = (status: string) => ['failed', 'rejected', 'refunded', 'unknown'].includes(status.toLowerCase())
const getReminderType = (message: string) => {
  const text = message.toLowerCase()
  if (text.includes('overdue') || text.includes('past due')) return 'Payment overdue'
  if (text.includes('renewal') || text.includes('renew')) return 'Contract renewal'
  if (text.includes('expired') || text.includes('expiration')) return 'Contract expired'
  return 'Automatic reminder'
}

export default function MessagesPage() {
  const [tab, setTab] = useState<WorkspaceTab>('messages')
  const [smsMessages, setSmsMessages] = useState<SmsHistoryItem[]>([])
  const [selectedSms, setSelectedSms] = useState<SmsHistoryItem | null>(null)
  const [isSmsLoading, setIsSmsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [refreshingSmsId, setRefreshingSmsId] = useState<number | null>(null)
  const [refreshError, setRefreshError] = useState('')

  const loadSmsMessages = useCallback(async () => {
    try {
      const response = await apiClient.getSmsMessages()
      const data = unwrap(response)
      setSmsMessages(Array.isArray(data) ? data as SmsHistoryItem[] : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load sent SMS messages.')
    } finally {
      setIsSmsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSmsMessages()
    const refreshTimer = window.setInterval(() => {
      void loadSmsMessages()
    }, 15000)

    return () => window.clearInterval(refreshTimer)
  }, [loadSmsMessages])

  const filteredSmsMessages = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return smsMessages
    return smsMessages.filter((item) => {
      const recipientName = getUserName(item.recipientUser)
      return `${recipientName} ${item.phoneNumber} ${item.message}`.toLowerCase().includes(query)
    })
  }, [search, smsMessages])

  const successfulCount = useMemo(
    () => smsMessages.filter((message) => isSuccessfulStatus(String(message.status || ''))).length,
    [smsMessages],
  )
  const attentionCount = smsMessages.length - successfulCount

  const openSmsMessage = (message: SmsHistoryItem) => {
    setSelectedSms(message)
    setRefreshError('')
  }

  const refreshSelectedSmsStatus = async () => {
    if (!selectedSms?.providerMessageId || refreshingSmsId !== null) return

    setRefreshingSmsId(selectedSms.id)
    setRefreshError('')
    try {
      const response = await apiClient.refreshSmsMessageStatus(selectedSms.id)
      const refreshedMessage = unwrap(response) as SmsHistoryItem
      setSelectedSms(refreshedMessage)
      setSmsMessages((current) => current.map((message) =>
        message.id === refreshedMessage.id ? refreshedMessage : message
      ))
    } catch (refreshFailure) {
      setRefreshError(refreshFailure instanceof Error ? refreshFailure.message : 'Unable to refresh SMS delivery status.')
    } finally {
      setRefreshingSmsId(null)
    }
  }

  const handleTabChange = (nextTab: WorkspaceTab) => {
    setTab(nextTab)
    setSelectedSms(null)
    setError('')
  }

  return (
    <ProtectedRoute>
      <main className="space-y-6 pb-8">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Communications</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Messages &amp; complaints</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Track automatic payment and contract reminders, and manage tenant support requests.</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            Automatic reminders
          </div>
        </header>

        {tab === 'messages' && <section className="grid gap-3 sm:grid-cols-3" aria-label="Reminder delivery summary">
          <article className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div><p className="text-xs font-semibold text-slate-500">Total reminders</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{smsMessages.length}</p></div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><MessageSquareText className="h-5 w-5" /></span>
          </article>
          <article className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
            <div><p className="text-xs font-semibold text-slate-500">Sent or delivered</p><p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">{successfulCount}</p></div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></span>
          </article>
          <article className="flex items-center justify-between rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
            <div><p className="text-xs font-semibold text-slate-500">Other statuses</p><p className="mt-1 text-2xl font-bold tabular-nums text-amber-800">{attentionCount}</p></div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><AlertTriangle className="h-5 w-5" /></span>
          </article>
        </section>}

        <nav className="flex w-fit gap-1 rounded-xl bg-slate-100 p-1" aria-label="Communications sections">
          <button
            type="button"
            onClick={() => handleTabChange('messages')}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${tab === 'messages' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            aria-current={tab === 'messages' ? 'page' : undefined}
          >
            <Send className="h-4 w-4" />
            Reminders
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === 'messages' ? 'bg-teal-50 text-teal-800' : 'bg-slate-200 text-slate-600'}`}>{smsMessages.length}</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('complaints')}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${tab === 'complaints' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            aria-current={tab === 'complaints' ? 'page' : undefined}
          >
            <Inbox className="h-4 w-4" />
            Complaints
          </button>
        </nav>

        {tab === 'complaints' ? <ComplaintsPanel /> : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 text-white"><Smartphone className="h-5 w-5" /></span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Automatic reminder log</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Payment overdue · Contract renewal · Contract expired</p>
                </div>
              </div>
              <label className="relative block w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reminders" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-50" />
              </label>
            </div>

            {error && <p role="alert" className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

            {isSmsLoading ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-slate-500"><LoaderCircle className="mr-2 h-4 w-4 animate-spin text-teal-700" /> Loading reminders…</div>
            ) : filteredSmsMessages.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Inbox className="h-6 w-6" /></span>
                <p className="mt-4 text-sm font-semibold text-slate-800">{smsMessages.length ? 'No matching reminders' : 'No reminders sent yet'}</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">{smsMessages.length ? 'Try another recipient, phone number, or search term.' : 'Automatic payment and contract reminders will appear here after they are sent.'}</p>
              </div>
            ) : (
              <div>
                <div className="hidden grid-cols-[minmax(170px,0.8fr)_minmax(150px,0.7fr)_minmax(240px,1.6fr)_minmax(120px,0.7fr)_auto] gap-4 border-b border-slate-100 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 md:grid">
                  <span>Recipient</span><span>Reminder type</span><span>Message</span><span>Date sent</span><span>Status</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredSmsMessages.map((message) => {
                    const successful = isSuccessfulStatus(String(message.status || ''))
                    return (
                      <button
                        key={`sms-${message.id}`}
                        type="button"
                        onClick={() => openSmsMessage(message)}
                        className="group grid w-full gap-3 px-4 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 sm:px-5 md:grid-cols-[minmax(170px,0.8fr)_minmax(150px,0.7fr)_minmax(240px,1.6fr)_minmax(120px,0.7fr)_auto] md:items-center md:gap-4"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800"><Smartphone className="h-4 w-4" /></span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-800">{message.recipientUser ? getUserName(message.recipientUser) : 'Tenant'}</span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">{message.phoneNumber}</span>
                          </span>
                        </span>
                        <span className="pl-12 text-xs font-semibold text-teal-800 md:pl-0">{getReminderType(message.message)}</span>
                        <span className="pl-12 text-xs leading-5 text-slate-500 md:pl-0 md:line-clamp-2">{message.message}</span>
                        <span className="flex items-center gap-1.5 pl-12 text-xs text-slate-500 md:pl-0"><Clock3 className="h-3.5 w-3.5 text-slate-400" />{message.createdAt ? new Date(message.createdAt).toLocaleString() : '—'}</span>
                        <span className="pl-12 md:pl-0"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${successful ? 'bg-emerald-50 text-emerald-700' : isFailedStatus(message.status) ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>{message.status}</span></span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {selectedSms && tab === 'messages' && (
          <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/40 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSms(null) }}>
            <section role="dialog" aria-modal="true" aria-labelledby="reminder-detail-title" className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
              <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><Smartphone className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">{getReminderType(selectedSms.message)}</p>
                  <h2 id="reminder-detail-title" className="truncate text-base font-bold text-slate-900">Reminder details</h2>
                </div>
                <button type="button" onClick={() => setSelectedSms(null)} className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100" aria-label="Close message details" title="Close message details">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </header>
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recipient</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedSms.recipientUser ? getUserName(selectedSms.recipientUser) : 'Tenant'}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{selectedSms.phoneNumber}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${isSuccessfulStatus(String(selectedSms.status || '')) ? 'bg-emerald-50 text-emerald-700' : isFailedStatus(String(selectedSms.status || '')) ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>{selectedSms.status}</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Message content</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedSms.message}</p>
                </div>
                {selectedSms.errorMessage && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-rose-700">Delivery issue</p><p className="mt-2 text-sm leading-5 text-rose-900">{selectedSms.errorMessage}</p></div>}
                {refreshError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{refreshError}</p>}
                <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Date sent</p><p className="mt-1.5 text-xs font-medium text-slate-700">{selectedSms.createdAt ? new Date(selectedSms.createdAt).toLocaleString() : 'Time unavailable'}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Delivery status</p><p className="mt-1.5 text-xs font-medium capitalize text-slate-700">{selectedSms.status}</p></div>
                  {selectedSms.providerMessageId && <div className="sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Provider reference</p><p className="mt-1.5 break-all text-xs font-medium text-slate-700">{selectedSms.providerMessageId}</p></div>}
                </div>
                {selectedSms.providerMessageId && !isSuccessfulStatus(selectedSms.status) && !isFailedStatus(selectedSms.status) && (
                  <button
                    type="button"
                    onClick={() => void refreshSelectedSmsStatus()}
                    disabled={refreshingSmsId === selectedSms.id}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshingSmsId === selectedSms.id ? 'animate-spin' : ''}`} />
                    {refreshingSmsId === selectedSms.id ? 'Checking status…' : 'Refresh delivery status'}
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </ProtectedRoute>
  )
}

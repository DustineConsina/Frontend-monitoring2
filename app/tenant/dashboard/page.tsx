'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { FishLoader } from '@/components/FishLoader'
import apiClient from '@/lib/api-client'
import { ArrowDown, ArrowLeft, ArrowRight, Building2, CalendarDays, CheckCircle2, Clock3, FileText, LogOut, MapPin, MessageSquareText, Send, Wallet } from 'lucide-react'

type PortalData = {
  id: number
  tenantCode?: string
  tenant_code?: string
  businessName?: string
  business_name?: string
  contactPerson?: string
  contact_person?: string
  email?: string
  status?: string
  contracts?: Array<Record<string, any>>
}

type Complaint = {
  id: number
  category?: string
  subject: string
  message: string
  status: string
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
}

const unwrap = (response: any) => response?.data?.data ?? response?.data ?? response
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString() : '—'
const currency = (value: unknown) => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const statusStyle = (status: unknown) => {
  const normalized = String(status || 'pending').toLowerCase()
  if (['active', 'paid', 'resolved', 'renewed'].includes(normalized)) return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (['overdue', 'terminated', 'rejected'].includes(normalized)) return 'border-rose-200 bg-rose-50 text-rose-800'
  if (['for_renewal', 'in_progress', 'partial'].includes(normalized)) return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-slate-200 bg-slate-100 text-slate-700'
}
const complaintCategories = [
  ['rental_space', 'Rental space'],
  ['payments', 'Payments'],
  ['contracts', 'Contracts'],
  ['facilities', 'Facilities / maintenance'],
  ['staff_service', 'Staff / service'],
  ['other', 'Other'],
] as const
const complaintCategoryLabel = (category?: string) => complaintCategories.find(([value]) => value === category)?.[1] || 'Other'

export default function TenantDashboardPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const [portal, setPortal] = useState<PortalData | null>(null)
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [subject, setSubject] = useState('Rental space')
  const [category, setCategory] = useState('rental_space')
  const [message, setMessage] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [sendingReplyId, setSendingReplyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [paymentSlide, setPaymentSlide] = useState(0)
  const [paymentTouchStart, setPaymentTouchStart] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const [portalResponse, complaintResponse] = await Promise.all([
        apiClient.getMyTenantPortal(),
        apiClient.getMyComplaints(),
      ])
      const portalData = unwrap(portalResponse)
      setPortal(portalData && typeof portalData === 'object' ? portalData as PortalData : null)
      const complaintPayload = unwrap(complaintResponse)
      setComplaints(Array.isArray(complaintPayload) ? complaintPayload : [])
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load tenant information.')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (!user) router.replace('/login')
    else if (user.role?.toUpperCase() !== 'TENANT') router.replace('/dashboard')
    else void loadData()
  }, [isLoading, loadData, router, user])

  const submitComplaint = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (subject.trim().length < 3 || subject.trim().length > 150 || message.trim().length < 10 || message.trim().length > 5000) {
      setError('Subject must be 3–150 characters and message must be 10–5000 characters.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiClient.createComplaint({ category, subject: subject.trim(), message: message.trim() })
      setSubject('Rental space')
      setCategory('rental_space')
      setMessage('')
      setNotice('Your complaint was submitted.')
      await loadData()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your complaint.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitComplaintReply = async (event: FormEvent<HTMLFormElement>, complaint: Complaint) => {
    event.preventDefault()
    const reply = (replyDrafts[complaint.id] || '').trim()
    if (reply.length < 2 || reply.length > 5000) {
      setError('Your reply must be between 2 and 5000 characters.')
      return
    }

    setError('')
    setNotice('')
    setSendingReplyId(complaint.id)
    try {
      await apiClient.replyToComplaint(String(complaint.id), reply)
      setReplyDrafts((current) => ({ ...current, [complaint.id]: '' }))
      setNotice('Your reply was sent.')
      await loadData()
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : 'Unable to send your reply.')
    } finally {
      setSendingReplyId(null)
    }
  }

  const handleLogout = async () => {
    await logout()
  }
  const allContracts = portal?.contracts || []
  const activeContracts = allContracts.filter((contract) => ['active', 'for_renewal', 'renewed', 'pending'].includes(String(contract.status || '').toLowerCase()))
  const monthlyTotal = activeContracts.reduce((sum, contract) => sum + Number(contract.monthlyRent || contract.monthlyRental || contract.monthly_rental || 0), 0)
  const allPayments = useMemo(() => allContracts.flatMap((contract, contractIndex) => {
    const space = contract.rentalSpace || contract.rental_space || {}
    const contractLabel = contract.contractNumber || contract.contract_number || `Contract ${contractIndex + 1}`
    return (Array.isArray(contract.payments) ? contract.payments : []).map((payment: any, paymentIndex: number) => ({
      ...payment,
      contractLabel,
      spaceLabel: space.spaceCode || space.space_code || space.unit_number || space.name || 'Space not assigned',
      paymentLabel: payment.paymentNumber || payment.payment_number || `Payment ${paymentIndex + 1}`,
    }))
  }).sort((a, b) => new Date(b.dueDate || b.due_date || b.createdAt || b.created_at || 0).getTime() - new Date(a.dueDate || a.due_date || a.createdAt || a.created_at || 0).getTime()), [allContracts])

  useEffect(() => {
    setPaymentSlide((current) => Math.min(current, Math.max(0, allPayments.length - 1)))
  }, [allPayments.length])
  const nextEndDate = activeContracts
    .map((contract) => contract.endDate || contract.end_date)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]

  const previousPayment = () => setPaymentSlide((current) => Math.max(0, current - 1))
  const nextPayment = () => setPaymentSlide((current) => Math.min(allPayments.length - 1, current + 1))
  const handlePaymentTouchStart = (event: React.TouchEvent<HTMLElement>) => setPaymentTouchStart(event.touches[0]?.clientX ?? null)
  const handlePaymentTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (paymentTouchStart === null) return
    const delta = paymentTouchStart - (event.changedTouches[0]?.clientX ?? paymentTouchStart)
    if (delta > 40) nextPayment()
    if (delta < -40) previousPayment()
    setPaymentTouchStart(null)
  }

  if (isLoading || !user || user.role?.toUpperCase() !== 'TENANT') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><FishLoader label="Loading your tenant portal" /></div>
  }

  return (
    <main className="min-h-screen bg-[#f3f6f6] pb-24 text-slate-900 sm:pb-8">
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-white"><Building2 className="h-4 w-4" aria-hidden="true" /></div>
            <div><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-teal-800">PFDA · Bulan</p><p className="text-xs font-semibold text-slate-900 sm:text-sm">Tenant portal</p></div>
          </div>
          <button type="button" onClick={() => void handleLogout()} aria-label="Log out" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:text-sm"><LogOut className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Log out</span></button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:space-y-7 sm:px-6 sm:py-8 lg:px-8">
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(130deg,#0d454e_0%,#0c6c70_62%,#12817b_100%)] text-white shadow-[0_16px_36px_rgba(13,69,78,0.16)]">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10" />
          <div className="absolute -right-4 -top-14 h-44 w-44 rounded-full border border-white/10" />
          <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-100">Welcome back</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{portal?.contactPerson || portal?.contact_person || user.name || 'Tenant'}</h1>
              <p className="mt-1.5 text-sm text-white/75">{portal?.businessName || portal?.business_name || 'Tenant account'} <span className="px-1 text-white/40">·</span> {portal?.tenantCode || portal?.tenant_code || user.email}</p>
            </div>
            <div className="flex items-center gap-2.5 self-start rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 backdrop-blur-sm sm:self-auto sm:px-4 sm:py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white"><CheckCircle2 className="h-4 w-4" /></span>
              <div><p className="text-[9px] font-semibold uppercase tracking-wide text-white/65">Account status</p><p className="mt-0.5 text-sm font-bold capitalize">{portal?.status || 'Active'}</p></div>
            </div>
          </div>
        </section>

        <section aria-label="Account summary" className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-1"><p className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-slate-500 sm:text-xs">Contracts</p><span className="rounded-lg bg-slate-100 p-1.5 text-slate-600 sm:p-2"><FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span></div><p className="mt-2 text-xl font-bold tracking-tight sm:mt-3 sm:text-2xl">{allContracts.length}</p><p className="mt-1 hidden text-xs text-slate-500 sm:block">{activeContracts.length} active or in progress</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-1"><p className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-slate-500 sm:text-xs">Monthly rent</p><span className="rounded-lg bg-slate-100 p-1.5 text-slate-600 sm:p-2"><Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span></div><p className="mt-2 truncate text-base font-bold tracking-tight sm:mt-3 sm:text-2xl">{currency(monthlyTotal)}</p><p className="mt-1 hidden text-xs text-slate-500 sm:block">Combined active contract rent</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-1"><p className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-slate-500 sm:text-xs">Next end date</p><span className="rounded-lg bg-slate-100 p-1.5 text-slate-600 sm:p-2"><CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span></div><p className="mt-2 truncate text-base font-bold tracking-tight sm:mt-3 sm:text-2xl">{nextEndDate ? dateLabel(nextEndDate) : '—'}</p><p className="mt-1 hidden text-xs text-slate-500 sm:block">Upcoming active contract end</p></div>
        </section>

        <section id="contracts" className="scroll-mt-24 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">Lease overview</p><h2 className="mt-1 text-xl font-bold text-slate-950">My contracts</h2><p className="mt-1 text-sm text-slate-500">Read-only contract, space, and payment information.</p></div>
            <span className="text-xs text-slate-500">{isRefreshing ? 'Updating…' : `${allContracts.length} record${allContracts.length === 1 ? '' : 's'}`}</span>
          </div>
          {!portal?.contracts?.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><FileText className="h-5 w-5" /></span><h3 className="mt-4 text-base font-bold text-slate-900">No contract details yet</h3><p className="mt-1 text-sm text-slate-500">Your assigned spaces and lease details will appear here.</p></div> : portal.contracts.map((contract, index) => {
            const space = contract.rentalSpace || contract.rental_space || {}
            const code = space.spaceCode || space.space_code || space.unit_number || space.name || 'Space not assigned'
            const status = String(contract.status || 'pending').replaceAll('_', ' ')
            return <article key={contract.id || index} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
                <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-teal-800"><FileText className="h-4 w-4" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Contract number</p><h3 className="mt-0.5 text-base font-bold text-slate-900">{contract.contractNumber || contract.contract_number || '—'}</h3></div></div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusStyle(contract.status)}`}>{status}</span>
              </div>
              <dl className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Rental space', code, Building2],
                  ['Space type', space.spaceType || space.space_type || space.type || '—', MapPin],
                  ['Area', space.sizeSqm || space.size_sqm ? `${space.sizeSqm || space.size_sqm} m²` : '—', Building2],
                  ['Start date', dateLabel(contract.startDate || contract.start_date), CalendarDays],
                  ['End date', dateLabel(contract.endDate || contract.end_date), CalendarDays],
                  ['Monthly rent', currency(contract.monthlyRent || contract.monthlyRental || contract.monthly_rental), Wallet],
                ].map(([label, value, Icon]: any) => <div key={label} className="bg-white p-4 sm:p-5"><dt className="flex items-center gap-2 text-[11px] font-medium text-slate-500"><Icon className="h-3.5 w-3.5 text-slate-400" />{label}</dt><dd className="mt-2 break-words text-sm font-semibold capitalize text-slate-900">{value}</dd></div>)}
              </dl>
            </article>
          })}
        </section>

        <section id="payments" className="scroll-mt-24 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">Billing overview</p><h2 className="mt-1 text-xl font-bold text-slate-950">Payments</h2><p className="mt-1 text-sm text-slate-500">Swipe through your billings and payment status.</p></div>
            {allPayments.length > 0 && <p className="text-xs font-medium text-slate-500">{paymentSlide + 1} of {allPayments.length}</p>}
          </div>
          {allPayments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center sm:py-10"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Wallet className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-slate-800">No payment records yet</p><p className="mt-1 text-xs text-slate-500">Payment details will appear here when they are available.</p></div> : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" onTouchStart={handlePaymentTouchStart} onTouchEnd={handlePaymentTouchEnd}>
            <div className="relative min-h-[235px] overflow-hidden bg-[linear-gradient(140deg,#0d454e_0%,#0c6c70_65%,#12817b_100%)] p-5 text-white sm:min-h-[250px] sm:p-7">
              <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full border border-white/10" />
              <div className="absolute -right-2 -top-12 h-40 w-40 rounded-full border border-white/10" />
              {allPayments.map((payment, index) => <article key={payment.id || `${payment.contractLabel}-${index}`} aria-hidden={index !== paymentSlide} className={`relative transition duration-300 ${index === paymentSlide ? 'block animate-in fade-in' : 'hidden'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">{payment.paymentLabel}</p><h3 className="mt-1 truncate text-xl font-bold sm:text-2xl">{payment.contractLabel}</h3></div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${statusStyle(payment.status)}`}>{String(payment.status || 'pending').replaceAll('_', ' ')}</span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div><p className="text-[10px] font-medium uppercase tracking-wide text-white/60">Amount due</p><p className="mt-1 text-lg font-bold sm:text-xl">{currency(payment.amountDue || payment.amount_due)}</p></div>
                  <div><p className="text-[10px] font-medium uppercase tracking-wide text-white/60">Amount paid</p><p className="mt-1 text-lg font-bold sm:text-xl">{currency(payment.amountPaid || payment.amount_paid)}</p></div>
                  <div className="col-span-2 sm:col-span-1"><p className="text-[10px] font-medium uppercase tracking-wide text-white/60">Due date</p><p className="mt-1 text-sm font-semibold sm:text-base">{dateLabel(payment.dueDate || payment.due_date)}</p></div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-3 text-xs text-white/75"><span className="truncate">{payment.spaceLabel}</span><span className="shrink-0">{paymentSlide + 1} / {allPayments.length}</span></div>
              </article>)}
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <button type="button" onClick={previousPayment} disabled={paymentSlide === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft className="h-3.5 w-3.5" />Previous</button>
              <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden" aria-label="Payment slides">
                {allPayments.map((payment, index) => <button key={payment.id || index} type="button" onClick={() => setPaymentSlide(index)} aria-label={`Show payment ${index + 1}`} aria-current={paymentSlide === index ? 'step' : undefined} className={`h-2 rounded-full transition-all ${paymentSlide === index ? 'w-6 bg-teal-700' : 'w-2 bg-slate-300 hover:bg-slate-400'}`} />)}
              </div>
              <button type="button" onClick={nextPayment} disabled={paymentSlide === allPayments.length - 1} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next<ArrowRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>}
        </section>

        <section id="support" className="scroll-mt-24 space-y-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">Support center</p><h2 className="mt-1 text-xl font-bold text-slate-950">Messages & complaints</h2><p className="mt-1 text-sm text-slate-500">Contact the administration and follow the progress of your requests.</p></div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <form onSubmit={submitComplaint} className="h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-teal-800 shadow-sm"><MessageSquareText className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-slate-900">Start a conversation</h3><p className="mt-0.5 text-xs text-slate-500">Your message is private to the administration.</p></div></div></div>
              <div className="space-y-4 p-5">
                <label className="block text-xs font-semibold text-slate-700">Subject<select value={category} onChange={(event) => { const selected = complaintCategories.find(([value]) => value === event.target.value); setCategory(event.target.value); setSubject(selected?.[1] || 'Other') }} required className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-50">{complaintCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="block text-xs font-semibold text-slate-700">Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} required minLength={10} maxLength={5000} rows={6} placeholder="Describe your concern or request…" className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-50" /><span className="mt-1 block text-right text-[10px] font-normal text-slate-400">{message.length}/5000</span></label>
                <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{isSubmitting ? 'Sending…' : 'Send message'}</button>
              </div>
            </form>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4"><div><h3 className="text-sm font-bold text-slate-900">Your requests</h3><p className="mt-0.5 text-xs text-slate-500">Updates and replies from the administration</p></div><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{complaints.length}</span></div>
              <div className="divide-y divide-slate-100">
                {complaints.length === 0 ? <div className="px-5 py-10 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><MessageSquareText className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-slate-800">No requests yet</p><p className="mt-1 text-xs text-slate-500">Messages you send will appear here.</p></div> : complaints.map((complaint) => {
                  const canReply = ['pending', 'in_progress'].includes(String(complaint.status || '').toLowerCase())
                  return <article key={complaint.id} className="border-b border-slate-100 p-4 last:border-b-0 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">{complaintCategoryLabel(complaint.category)}</span><h4 className="mt-1.5 break-words text-sm font-bold text-slate-900">{complaint.subject}</h4><p className="mt-1 text-[11px] text-slate-500">Submitted {dateLabel(complaint.createdAt || complaint.created_at)}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${statusStyle(complaint.status)}`}><Clock3 className="h-3 w-3" />{String(complaint.status || 'pending').replaceAll('_', ' ')}</span></div>
                    <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Your request</p><p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-slate-700">{complaint.message}</p></div>
                    <div className="mt-3 space-y-2">
                      {complaint.replies?.map((reply) => <div key={reply.id} className={`rounded-xl border p-3 ${String(reply.sender?.role || '').toLowerCase() === 'tenant' ? 'border-slate-200 bg-white' : 'border-teal-100 bg-teal-50/70'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2"><p className={`text-[10px] font-bold uppercase tracking-wide ${String(reply.sender?.role || '').toLowerCase() === 'tenant' ? 'text-slate-500' : 'text-teal-800'}`}>{String(reply.sender?.role || '').toLowerCase() === 'tenant' ? 'Your reply' : 'Administration reply'}</p><time className="text-[10px] text-slate-400">{dateLabel(reply.createdAt || reply.created_at)}</time></div>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-slate-800">{reply.message}</p>
                      </div>)}
                      {!complaint.replies?.length && complaint.reply && <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-teal-800">Administration reply</p><p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-teal-950">{complaint.reply}</p></div>}
                    </div>
                    {canReply ? <form onSubmit={(event) => void submitComplaintReply(event, complaint)} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="min-w-0 flex-1 text-[10px] font-semibold text-slate-600">Reply to this request<textarea value={replyDrafts[complaint.id] || ''} onChange={(event) => setReplyDrafts((current) => ({ ...current, [complaint.id]: event.target.value }))} maxLength={5000} minLength={2} rows={2} placeholder="Add more information or respond to the administration…" className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-50" /></label>
                      <button type="submit" disabled={sendingReplyId === complaint.id || (replyDrafts[complaint.id] || '').trim().length < 2} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-3.5 w-3.5" />{sendingReplyId === complaint.id ? 'Sending…' : 'Reply'}</button>
                    </form> : <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">This request is resolved. Replies are closed.</p>}
                  </article>
                })}</div>
            </section>
          </div>
        </section>
      </div>
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-3 gap-1">
          {[
            { href: '#contracts', label: 'Contracts', icon: FileText },
            { href: '#payments', label: 'Payments', icon: Wallet },
            { href: '#support', label: 'Support', icon: MessageSquareText },
          ].map(({ href, label, icon: Icon }) => <a key={href} href={href} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-semibold text-slate-500 transition active:bg-teal-50 active:text-teal-800"><Icon className="h-4 w-4" aria-hidden="true" />{label}</a>)}
        </div>
      </nav>
    </main>
  )
}

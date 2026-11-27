'use client'

import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'
import { FishLoader } from '@/components/FishLoader'
import apiClient from '@/lib/api-client'
import { ArrowLeft, ArrowRight, Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, FileText, LifeBuoy, LogOut, Mail, MapPin, MessageSquareText, Paperclip, Send, ShieldCheck, UserRound, Wallet, X } from 'lucide-react'

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
  hasImage?: boolean
  has_image?: boolean
  createdAt?: string
  created_at?: string
  replies?: Array<{
    id: number
    message: string
    hasImage?: boolean
    has_image?: boolean
    createdAt?: string
    created_at?: string
    sender?: { name?: string; role?: string }
  }>
}

type ComplaintImageState = {
  status: 'loading' | 'unavailable'
  url?: string
  message?: string
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
  const [complaintDrawerOpen, setComplaintDrawerOpen] = useState(false)
  const [selectedComplaintId, setSelectedComplaintId] = useState<number | null>(null)
  const [complaintImages, setComplaintImages] = useState<Record<string, ComplaintImageState>>({})
  const [subject, setSubject] = useState('Rental space')
  const [category, setCategory] = useState('rental_space')
  const [message, setMessage] = useState('')
  const [complaintImage, setComplaintImage] = useState<File | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [replyAttachments, setReplyAttachments] = useState<Record<number, File | null>>({})
  const [sendingReplyId, setSendingReplyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [paymentSlide, setPaymentSlide] = useState(0)
  const [paymentTouchStart, setPaymentTouchStart] = useState<number | null>(null)
  const complaintImageInput = useRef<HTMLInputElement>(null)
  const complaintButtonRef = useRef<HTMLButtonElement>(null)
  const complaintDrawerRef = useRef<HTMLElement>(null)

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
    if (complaintImage && complaintImage.size > 5 * 1024 * 1024) {
      setError('The complaint image must be 5 MB or smaller.')
      return
    }

    setIsSubmitting(true)
    try {
      if (complaintImage) {
        const formData = new FormData()
        formData.append('category', category)
        formData.append('subject', subject.trim())
        formData.append('message', message.trim())
        formData.append('image', complaintImage)
        await apiClient.createComplaint(formData)
      } else {
        await apiClient.createComplaint({ category, subject: subject.trim(), message: message.trim() })
      }
      setSubject('Rental space')
      setCategory('rental_space')
      setMessage('')
      setComplaintImage(null)
      if (complaintImageInput.current) complaintImageInput.current.value = ''
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
    const attachment = replyAttachments[complaint.id]
    if (reply.length < 2 || reply.length > 5000) {
      setError('Your reply must be between 2 and 5000 characters.')
      return
    }
    if (attachment && attachment.size > 5 * 1024 * 1024) {
      setError('The reply image must be 5 MB or smaller.')
      return
    }

    setError('')
    setNotice('')
    setSendingReplyId(complaint.id)
    try {
      if (attachment) {
        const formData = new FormData()
        formData.append('message', reply)
        formData.append('image', attachment)
        await apiClient.replyToComplaint(String(complaint.id), formData)
      } else {
        await apiClient.replyToComplaint(String(complaint.id), reply)
      }
      setReplyDrafts((current) => ({ ...current, [complaint.id]: '' }))
      setReplyAttachments((current) => ({ ...current, [complaint.id]: null }))
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
  const selectedComplaint = complaints.find((complaint) => complaint.id === selectedComplaintId) || null
  const openComplaints = (event: MouseEvent<HTMLButtonElement>) => {
    complaintButtonRef.current = event.currentTarget
    setSelectedComplaintId(null)
    setComplaintDrawerOpen(true)
  }
  const closeComplaints = useCallback(() => {
    setComplaintDrawerOpen(false)
    setSelectedComplaintId(null)
    setError('')
    setNotice('')
    complaintButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!complaintDrawerOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeComplaints()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    complaintDrawerRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [closeComplaints, complaintDrawerOpen])

  useEffect(() => {
    if (!complaintDrawerOpen || !selectedComplaint) {
      setComplaintImages({})
      return
    }

    let cancelled = false
    const createdUrls: string[] = []
    const loadImage = async (key: string, fetchImage: () => Promise<Blob>) => {
      setComplaintImages((current) => ({ ...current, [key]: { status: 'loading' } }))
      try {
        const blob = await fetchImage()
        if (!blob.type.startsWith('image/')) {
          throw new Error('The server response was not an image.')
        }
        const url = URL.createObjectURL(blob)
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        createdUrls.push(url)
        setComplaintImages((current) => ({ ...current, [key]: { status: 'loading', url } }))
      } catch (imageError) {
        if (!cancelled) {
          setComplaintImages((current) => ({
            ...current,
            [key]: {
              status: 'unavailable',
              message: imageError instanceof Error ? imageError.message : 'Unable to load image attachment.',
            },
          }))
        }
      }
    }

    if (selectedComplaint.hasImage || selectedComplaint.has_image) {
      void loadImage(
        `complaint:${selectedComplaint.id}`,
        () => apiClient.getComplaintImage(String(selectedComplaint.id)),
      )
    }

    selectedComplaint.replies?.forEach((reply) => {
      if (reply.hasImage || reply.has_image) {
        void loadImage(
          `reply:${selectedComplaint.id}:${reply.id}`,
          () => apiClient.getComplaintReplyImage(String(selectedComplaint.id), String(reply.id)),
        )
      }
    })

    return () => {
      cancelled = true
      createdUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [complaintDrawerOpen, selectedComplaint])

  const allContracts = useMemo(() => portal?.contracts || [], [portal?.contracts])
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
    <main className="min-h-screen bg-[#f2f6f5] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white px-5 py-6 lg:flex">
          <a href="#overview" className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-800 text-white shadow-lg shadow-teal-900/15"><Building2 className="h-5 w-5" /></span>
            <span><span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">PFDA · Bulan</span><span className="mt-0.5 block text-sm font-bold text-slate-900">Tenant portal</span></span>
          </a>
          <p className="mb-3 mt-10 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
          <nav aria-label="Tenant navigation" className="space-y-1">
            {[
              { href: '#overview', label: 'Overview', icon: Building2 },
              { href: '#contracts', label: 'My contracts', icon: FileText },
              { href: '#payments', label: 'Payments', icon: Wallet },
              { href: '#profile', label: 'My profile', icon: UserRound },
            ].map(({ href, label, icon: Icon }) => (
              <a key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-teal-50 hover:text-teal-900">
                <Icon className="h-[18px] w-[18px] text-slate-400" aria-hidden="true" />{label}
              </a>
            ))}
            <button type="button" onClick={openComplaints} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-teal-50 hover:text-teal-900">
              <MessageSquareText className="h-[18px] w-[18px] text-slate-400" aria-hidden="true" />
              <span className="flex-1">Complaints</span>
              {complaints.length > 0 && <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">{complaints.length}</span>}
            </button>
          </nav>
          <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-900">{(portal?.contactPerson || portal?.contact_person || user.name || 'T').slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-900">{portal?.contactPerson || portal?.contact_person || user.name || 'Tenant'}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{portal?.businessName || portal?.business_name || 'Tenant account'}</span></span>
            </div>
            <button type="button" onClick={() => void handleLogout()} className="mt-4 inline-flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"><LogOut className="h-4 w-4" />Log out</button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-24 sm:pb-8">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
            <div className="flex min-h-[72px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
              <div className="flex items-center gap-3 lg:hidden">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 text-white"><Building2 className="h-5 w-5" /></span>
                <span><span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-teal-800">PFDA · Bulan</span><span className="text-sm font-bold text-slate-900">Tenant portal</span></span>
              </div>
              <div className="hidden lg:block">
                <p className="text-xs font-medium text-slate-500">Lease and account workspace</p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">Tenant dashboard</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button ref={complaintButtonRef} type="button" onClick={openComplaints} aria-label={`Open complaints${complaints.length ? `, ${complaints.length} total` : ''}`} className="relative inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100">
                  <MessageSquareText className="h-[18px] w-[18px]" aria-hidden="true" /><span className="hidden sm:inline">Complaints</span>
                  {complaints.length > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-teal-700 px-1.5 py-0.5 text-[10px] font-bold text-white">{complaints.length}</span>}
                </button>
                <button type="button" onClick={() => void handleLogout()} aria-label="Log out" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 lg:hidden"><LogOut className="h-4 w-4" /></button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            {!complaintDrawerOpen && error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
            {!complaintDrawerOpen && notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

            <section id="overview" className="relative isolate overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,#0b3d46_0%,#0c666d_58%,#148078_100%)] text-white shadow-[0_24px_60px_rgba(13,69,78,0.16)]">
              <div className="absolute -right-12 -top-24 -z-10 h-80 w-80 rounded-full border border-white/10" />
              <div className="absolute -right-2 -top-16 -z-10 h-60 w-60 rounded-full border border-white/10" />
              <div className="relative flex flex-col gap-8 p-6 sm:p-9 lg:flex-row lg:items-end lg:justify-between lg:p-11">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-teal-50"><ShieldCheck className="h-3.5 w-3.5" />Secure tenant workspace</span>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-teal-100">Good day</p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{portal?.contactPerson || portal?.contact_person || user.name || 'Tenant'}</h1>
                  <p className="mt-2 text-sm text-white/75 sm:text-base">{portal?.businessName || portal?.business_name || 'Tenant account'} <span className="px-1.5 text-white/40">·</span> {portal?.tenantCode || portal?.tenant_code || user.email}</p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm lg:min-w-52">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><CheckCircle2 className="h-5 w-5" /></span>
                  <span><span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-white/65">Account status</span><span className="mt-1 block text-base font-bold capitalize">{portal?.status || 'Active'}</span></span>
                </div>
              </div>
            </section>

            <section aria-label="Account summary" className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(20,43,50,0.04)] sm:p-6"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">Contracts</p><span className="rounded-xl bg-teal-50 p-2.5 text-teal-800"><FileText className="h-5 w-5" /></span></div><p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{allContracts.length}</p><p className="mt-1 text-xs text-slate-500">{activeContracts.length} active or in progress</p></div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(20,43,50,0.04)] sm:p-6"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">Monthly rent</p><span className="rounded-xl bg-amber-50 p-2.5 text-amber-800"><Wallet className="h-5 w-5" /></span></div><p className="mt-4 truncate text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{currency(monthlyTotal)}</p><p className="mt-1 text-xs text-slate-500">Combined active contract rent</p></div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(20,43,50,0.04)] sm:p-6"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">Next end date</p><span className="rounded-xl bg-sky-50 p-2.5 text-sky-800"><CalendarDays className="h-5 w-5" /></span></div><p className="mt-4 truncate text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{nextEndDate ? dateLabel(nextEndDate) : '—'}</p><p className="mt-1 text-xs text-slate-500">Upcoming active contract end</p></div>
            </section>

        <section id="profile" className="scroll-mt-28 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Account</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Tenant profile</h2></div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold capitalize text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" />{portal?.status || 'Active'}</span>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/70 shadow-[0_8px_24px_rgba(20,43,50,0.04)] sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Contact person', portal?.contactPerson || portal?.contact_person || user.name || '—', UserRound],
              ['Business', portal?.businessName || portal?.business_name || '—', Building2],
              ['Tenant code', portal?.tenantCode || portal?.tenant_code || '—', ShieldCheck],
              ['Account email', portal?.email || user.email || '—', Mail],
            ].map(([label, value, Icon]: any) => <div key={label} className="min-w-0 bg-white p-4 sm:p-5">
              <p className="flex items-center gap-2 text-xs font-medium text-slate-500"><Icon className="h-4 w-4 text-teal-700" />{label}</p>
              <p className="mt-2 break-words text-sm font-bold text-slate-900">{value}</p>
            </div>)}
          </div>
        </section>

        <section id="contracts" className="scroll-mt-28 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Lease overview</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">My contracts</h2><p className="mt-1.5 text-sm text-slate-500">Your spaces, lease terms, and contract status.</p></div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">{isRefreshing ? 'Updating…' : `${allContracts.length} record${allContracts.length === 1 ? '' : 's'}`}</span>
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

        </div>
        </div>

        <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
            {[
              { href: '#contracts', label: 'Contracts', icon: FileText },
              { href: '#payments', label: 'Payments', icon: Wallet },
              { href: '#profile', label: 'Profile', icon: UserRound },
            ].map(({ href, label, icon: Icon }) => <a key={href} href={href} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-slate-500 transition active:bg-teal-50 active:text-teal-800"><Icon className="h-4 w-4" aria-hidden="true" />{label}</a>)}
            <button type="button" onClick={openComplaints} className="relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-slate-500 transition active:bg-teal-50 active:text-teal-800"><MessageSquareText className="h-4 w-4" aria-hidden="true" />Complaints{complaints.length > 0 && <span className="absolute right-5 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-teal-700 px-1 text-[9px] font-bold text-white">{complaints.length}</span>}</button>
          </div>
        </nav>

        {complaintDrawerOpen && <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Close complaints panel" onClick={closeComplaints} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <aside ref={complaintDrawerRef} role="dialog" aria-modal="true" aria-labelledby="tenant-complaints-title" tabIndex={-1} className="relative flex h-[100dvh] w-full max-w-2xl flex-col bg-[#f7faf9] shadow-2xl outline-none sm:border-l sm:border-white/60">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                {selectedComplaint && <button type="button" onClick={() => setSelectedComplaintId(null)} aria-label="Back to complaints" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"><ChevronLeft className="h-5 w-5" /></button>}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-900"><MessageSquareText className="h-5 w-5" /></span>
                <span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-teal-800">Support center</span><span id="tenant-complaints-title" className="mt-0.5 block truncate text-base font-bold text-slate-950 sm:text-lg">{selectedComplaint ? 'Complaint details' : 'Complaints & messages'}</span></span>
              </div>
              <button type="button" onClick={closeComplaints} aria-label="Close complaints" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </header>

            {error && <div role="alert" className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:mx-6">{error}</div>}
            {notice && <div role="status" className="mx-4 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:mx-6">{notice}</div>}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {selectedComplaint ? <div className="mx-auto max-w-xl space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><span className="inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800">{complaintCategoryLabel(selectedComplaint.category)}</span><h2 className="mt-3 break-words text-xl font-bold tracking-tight text-slate-950">{selectedComplaint.subject}</h2><p className="mt-1.5 text-xs text-slate-500">Submitted {selectedComplaint.createdAt || selectedComplaint.created_at ? new Date(selectedComplaint.createdAt || selectedComplaint.created_at || '').toLocaleString() : '—'}</p></div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${statusStyle(selectedComplaint.status)}`}><Clock3 className="h-3.5 w-3.5" />{String(selectedComplaint.status || 'pending').replaceAll('_', ' ')}</span>
                  </div>
                  <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Your message</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedComplaint.message}</p></div>
                  {(selectedComplaint.hasImage || selectedComplaint.has_image) && <ComplaintAttachment image={complaintImages[`complaint:${selectedComplaint.id}`]} label="Complaint attachment" />}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between gap-3"><div><h3 className="text-base font-bold text-slate-950">Conversation</h3><p className="mt-1 text-xs text-slate-500">Replies from you and the administration</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{(selectedComplaint.replies || []).length + (selectedComplaint.reply && !selectedComplaint.replies?.length ? 1 : 0)}</span></div>
                  <div className="mt-4 space-y-3">
                    {selectedComplaint.replies?.map((reply) => {
                      const isTenantReply = String(reply.sender?.role || '').toLowerCase() === 'tenant'
                      const imageKey = `reply:${selectedComplaint.id}:${reply.id}`
                      return <article key={reply.id} className={`rounded-xl border p-4 ${isTenantReply ? 'border-slate-200 bg-slate-50' : 'border-teal-100 bg-teal-50/70'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2"><p className={`text-xs font-bold ${isTenantReply ? 'text-slate-600' : 'text-teal-900'}`}>{isTenantReply ? 'Your reply' : 'Administration reply'}</p><time className="text-[11px] text-slate-500">{reply.createdAt || reply.created_at ? new Date(reply.createdAt || reply.created_at || '').toLocaleString() : '—'}</time></div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{reply.message}</p>
                        {(reply.hasImage || reply.has_image) && <ComplaintAttachment image={complaintImages[imageKey]} label="Reply attachment" />}
                      </article>
                    })}
                    {!selectedComplaint.replies?.length && selectedComplaint.reply && <article className="rounded-xl border border-teal-100 bg-teal-50/70 p-4"><p className="text-xs font-bold text-teal-900">Administration reply</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedComplaint.reply}</p></article>}
                    {!selectedComplaint.replies?.length && !selectedComplaint.reply && <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center"><p className="text-sm font-semibold text-slate-700">No replies yet</p><p className="mt-1 text-xs text-slate-500">The administration will respond here.</p></div>}
                  </div>
                </section>

                {['pending', 'in_progress'].includes(String(selectedComplaint.status || '').toLowerCase()) ? <form onSubmit={(event) => void submitComplaintReply(event, selectedComplaint)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <label htmlFor={`tenant-complaint-reply-${selectedComplaint.id}`} className="text-sm font-bold text-slate-900">Send a reply</label>
                  <textarea id={`tenant-complaint-reply-${selectedComplaint.id}`} value={replyDrafts[selectedComplaint.id] || ''} onChange={(event) => setReplyDrafts((current) => ({ ...current, [selectedComplaint.id]: event.target.value }))} maxLength={5000} minLength={2} rows={4} placeholder="Add more information or respond to the administration…" className="mt-3 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-50" />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"><Paperclip className="h-4 w-4" />{replyAttachments[selectedComplaint.id]?.name || 'Attach image'}<input key={replyAttachments[selectedComplaint.id]?.name || `empty-${selectedComplaint.id}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setReplyAttachments((current) => ({ ...current, [selectedComplaint.id]: event.target.files?.[0] || null }))} /></label>
                    <span className="ml-auto text-xs text-slate-400">{(replyDrafts[selectedComplaint.id] || '').length}/5000</span>
                    <button type="submit" disabled={sendingReplyId === selectedComplaint.id || (replyDrafts[selectedComplaint.id] || '').trim().length < 2} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{sendingReplyId === selectedComplaint.id ? 'Sending…' : 'Send reply'}</button>
                  </div>
                </form> : <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">This complaint is resolved. Replies are closed.</p>}
              </div> : <div className="mx-auto max-w-xl space-y-5">
                <section className="rounded-2xl border border-teal-100 bg-[linear-gradient(130deg,#f0faf8,#fff)] p-5 shadow-sm sm:p-6">
                  <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-900"><LifeBuoy className="h-5 w-5" /></span><div><h2 className="text-base font-bold text-slate-950">How can we help?</h2><p className="mt-1 text-sm leading-5 text-slate-600">Send a message to the administration or review updates to your existing requests.</p></div></div>
                  <details className="group mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold text-teal-900 marker:hidden">
                      <span className="inline-flex items-center gap-2"><Send className="h-4 w-4" />Create a complaint</span><ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                    </summary>
                    <form onSubmit={submitComplaint} className="space-y-4 border-t border-slate-100 p-4">
                      <label className="block text-sm font-semibold text-slate-700">Category<select value={category} onChange={(event) => { const selected = complaintCategories.find(([value]) => value === event.target.value); setCategory(event.target.value); setSubject(selected?.[1] || 'Other') }} required className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-50">{complaintCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label className="block text-sm font-semibold text-slate-700">Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} required minLength={10} maxLength={5000} rows={4} placeholder="Describe your concern or request…" className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-50" /><span className="mt-1 block text-right text-xs font-normal text-slate-400">{message.length}/5000</span></label>
                      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-3 text-sm font-semibold text-slate-600 transition hover:border-teal-300 hover:bg-teal-50/50"><Paperclip className="h-4 w-4 text-teal-800" />{complaintImage?.name || 'Attach an image (optional)'}<input ref={complaintImageInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setComplaintImage(event.target.files?.[0] || null)} /></label>
                      <p className="-mt-2 text-xs text-slate-400">JPG, PNG, or WebP up to 5 MB.</p>
                      <button type="submit" disabled={isSubmitting} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{isSubmitting ? 'Sending…' : 'Send message'}</button>
                    </form>
                  </details>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="text-base font-bold text-slate-950">Your requests</h2><p className="mt-1 text-xs text-slate-500">Select a request to view its updates and replies.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{complaints.length}</span></div>
                  {complaints.length === 0 ? <div className="px-5 py-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><MessageSquareText className="h-5 w-5" /></span><p className="mt-4 text-sm font-bold text-slate-800">No complaints yet</p><p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">Your submitted requests will appear here. You can start one above.</p></div> : <div className="divide-y divide-slate-100">
                    {complaints.map((complaint) => <button key={complaint.id} type="button" onClick={() => { setError(''); setSelectedComplaintId(complaint.id) }} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-teal-50/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-teal-100">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><MessageSquareText className="h-[18px] w-[18px]" /></span>
                      <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-bold text-slate-900">{complaint.subject}</span>{(complaint.hasImage || complaint.has_image) && <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="Attachment available" />}</span><span className="mt-1 block text-xs text-slate-500">{complaint.createdAt || complaint.created_at ? new Date(complaint.createdAt || complaint.created_at || '').toLocaleDateString() : 'Date unavailable'} · {complaintCategoryLabel(complaint.category)}</span></span>
                      <span className="flex shrink-0 items-center gap-1.5"><span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-bold capitalize ${statusStyle(complaint.status)}`}>{String(complaint.status || 'pending').replaceAll('_', ' ')}</span><ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" /></span>
                    </button>)}
                  </div>}
                </section>
              </div>}
            </div>
          </aside>
        </div>}
      </div>
    </main>
  )
}

function ComplaintAttachment({ image, label }: { image?: ComplaintImageState; label: string }) {
  return <div className="mt-4">
    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Paperclip className="h-3.5 w-3.5" />{label}</p>
    {image?.url ? <a href={image.url} target="_blank" rel="noreferrer" className="inline-block max-w-full rounded-xl border border-slate-200 bg-slate-50 p-1">
      <Image src={image.url} alt={label} width={720} height={480} unoptimized className="max-h-72 w-auto max-w-full rounded-lg object-contain" />
    </a> : <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{image?.status === 'unavailable' ? `Attachment unavailable: ${image.message || 'Unable to load image.'}` : 'Loading attachment…'}</p>}
  </div>
}

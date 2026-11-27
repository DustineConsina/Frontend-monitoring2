'use client'

import Image from 'next/image'
import { Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, FileText, LifeBuoy, Loader2, MessageSquareText, Paperclip, Send, ShieldCheck, UserRound, Wallet, X } from 'lucide-react'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RentalSpace {
  id: number
  unit_number?: string
  name?: string
  type?: string
  floor?: string | number
}

const formatDateTime = (d?: string) => {
  if (!d) return 'Date unavailable'
  const date = new Date(d)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString()
}

interface Contract {
  id: number
  contract_number: string
  status: string
  start_date: string
  end_date: string
  monthly_rental: number
  rental_space: RentalSpace | null
  payments?: Payment[]
}

interface Payment {
  id: number
  payment_number?: string
  billing_period_start?: string
  billing_period_end?: string
  due_date?: string
  amount_due?: number | string
  amount_paid?: number | string
  balance?: number | string
  status?: string
  payment_date?: string
}

interface TenantComplaint {
  id: number
  category?: string
  subject: string
  message: string
  has_image?: boolean
  hasImage?: boolean
  status: string
  reply?: string | null
  created_at?: string
  createdAt?: string
  replies?: Array<{
    id: number
    message: string
    has_image?: boolean
    hasImage?: boolean
    created_at?: string
    createdAt?: string
    sender?: { name?: string; role?: string }
  }>
}

interface TenantPublic {
  id: number
  tenant_code: string
  business_name: string
  business_type?: string
  contact_person: string
  contact_number: string
  business_address?: string
  status: string
  profile_picture_url?: string
  email?: string
  contracts: Contract[]
  complaints: TenantComplaint[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (d?: string) => {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const spaceLabel = (space: RentalSpace | null) => {
  if (!space) return 'N/A'
  const parts = [
    space.unit_number && `Unit ${space.unit_number}`,
    space.name,
    space.floor != null && `Floor ${space.floor}`,
  ].filter(Boolean)
  return parts.length ? parts.join(' - ') : 'N/A'
}

const statusColor = (s: string) => {
  const status = s?.toLowerCase().replaceAll('_', ' ')
  if (['active', 'paid', 'resolved', 'renewed'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (['for renewal', 'in progress', 'partial', 'pending'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-800'
  if (['overdue', 'expired', 'terminated', 'rejected'].includes(status)) return 'border-rose-200 bg-rose-50 text-rose-800'
  return 'border-slate-200 bg-slate-100 text-slate-700'
}

const paymentStatusColor = (s: string) => {
  switch (s?.toLowerCase()) {
    case 'paid':
      return 'bg-green-100 text-green-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'overdue':
      return 'bg-red-100 text-red-800'
    case 'partial':
      return 'bg-orange-100 text-orange-800'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

const getProfilePictureUrl = (value?: string | null) => {
  if (!value) return null

  const pictureUrl = String(value)
  const storageMarker = '/api/storage/'
  const storageIndex = pictureUrl.indexOf(storageMarker)
  if (storageIndex !== -1) {
    return `/api/profile-picture/${pictureUrl.slice(storageIndex + storageMarker.length)}`
  }

  return pictureUrl
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
      <p className="mb-1 text-sm text-slate-500">{label}</p>
      <p className="break-words text-base font-semibold text-slate-900">{value || 'N/A'}</p>
    </div>
  )
}

// ─── Content ──────────────────────────────────────────────────────────────────

function TenantScanContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const qrToken = params?.id as string
  const isAdminView = searchParams?.get('admin') === '1'

  const [tenant, setTenant] = useState<TenantPublic | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [accessCode, setAccessCode] = useState('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [paymentSlides, setPaymentSlides] = useState<Record<number, number>>({})
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [complaintCategory, setComplaintCategory] = useState('other')
  const [complaintSubject, setComplaintSubject] = useState('')
  const [complaintMessage, setComplaintMessage] = useState('')
  const [complaintImage, setComplaintImage] = useState<File | null>(null)
  const [complaintImageUrls, setComplaintImageUrls] = useState<Record<string, string>>({})
  const [complaintImageStates, setComplaintImageStates] = useState<Record<string, { status: 'loading' | 'unavailable'; message?: string }>>({})
  const [expandedComplaintId, setExpandedComplaintId] = useState<number | null>(null)
  const [complaintDrawerOpen, setComplaintDrawerOpen] = useState(false)
  const complaintImageInput = useRef<HTMLInputElement>(null)
  const complaintDrawerRef = useRef<HTMLElement>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [replyImages, setReplyImages] = useState<Record<number, File | null>>({})
  const [replyFeedback, setReplyFeedback] = useState<Record<number, { kind: 'success' | 'error'; message: string }>>({})
  const [submittingReplyId, setSubmittingReplyId] = useState<number | null>(null)
  const [complaintSuccess, setComplaintSuccess] = useState('')
  const [complaintError, setComplaintError] = useState('')
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false)

  const closeComplaintDrawer = useCallback(() => {
    setComplaintDrawerOpen(false)
    setExpandedComplaintId(null)
  }, [])

  useEffect(() => {
    if (!complaintDrawerOpen) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeComplaintDrawer()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    complaintDrawerRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [closeComplaintDrawer, complaintDrawerOpen])

  useEffect(() => {
    let cancelled = false
    const createdUrls: string[] = []
    setComplaintImageUrls({})
    setComplaintImageStates({})

    const loadImage = async (key: string, complaintId: number, replyId?: number) => {
      setComplaintImageStates((current) => ({ ...current, [key]: { status: 'loading' } }))
      try {
        const response = await fetch('/api/tenant-scan/complaints/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: qrToken,
            access_code: accessCode,
            complaint_id: complaintId,
            ...(replyId ? { reply_id: replyId } : {}),
          }),
          cache: 'no-store',
        })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.message || `Unable to load image attachment (HTTP ${response.status}).`)
        }

        const imageBlob = await response.blob()
        if (!imageBlob.type.startsWith('image/')) {
          throw new Error('The server response was not an image.')
        }
        const imageUrl = URL.createObjectURL(imageBlob)
        if (cancelled) {
          URL.revokeObjectURL(imageUrl)
          return
        }

        createdUrls.push(imageUrl)
        setComplaintImageUrls((current) => ({ ...current, [key]: imageUrl }))
        setComplaintImageStates((current) => {
          const next = { ...current }
          delete next[key]
          return next
        })
      } catch (error: unknown) {
        if (!cancelled)         setComplaintImageStates((current) => ({
          ...current,
          [key]: { status: 'unavailable', message: error instanceof Error ? error.message : 'Unable to load image attachment.' },
        }))
      }
    }

    const pendingImages = tenant?.complaints.flatMap((complaint) => [
      ...((complaint.has_image || complaint.hasImage)
        ? [loadImage(`${complaint.id}:complaint`, complaint.id)]
        : []),
      ...(complaint.replies || []).flatMap((reply) => (reply.has_image || reply.hasImage)
        ? [loadImage(`${complaint.id}:reply:${reply.id}`, complaint.id, reply.id)]
        : []),
    ]) || []

    void Promise.all(pendingImages)

    return () => {
      cancelled = true
      createdUrls.forEach((imageUrl) => URL.revokeObjectURL(imageUrl))
    }
  }, [tenant, qrToken, accessCode])

  const handleVerifyQrPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setFetchError(null)

    try {
      if (!qrToken) {
        throw new Error('This QR code is invalid or incomplete.')
      }

      const response = await fetch('/api/tenant-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: qrToken, access_code: accessCode }),
        cache: 'no-store',
      })

      const rawText = await response.text()
      let json: any = null
      if (rawText) {
        try {
          json = JSON.parse(rawText)
        } catch {
          json = null
        }
      }

      if (!response.ok) {
        throw new Error(json?.message || json?.error || `Server error ${response.status}`)
      }

      const tenantData = json?.data ?? json
      if (!tenantData || typeof tenantData !== 'object') {
        throw new Error('Tenant information was not returned.')
      }

      const contracts = Array.isArray(tenantData.contracts)
        ? tenantData.contracts.map((contract: any) => ({
            ...contract,
            contract_number: contract.contractNumber || contract.contract_number,
            start_date: contract.startDate || contract.start_date,
            end_date: contract.endDate || contract.end_date,
            monthly_rental: contract.monthlyRental || contract.monthly_rental,
            rental_space: contract.rentalSpace || contract.rental_space,
            payments: Array.isArray(contract.payments) ? contract.payments : [],
          }))
        : []

      setTenant({
        ...tenantData,
        tenant_code: tenantData.tenantCode || tenantData.tenant_code,
        business_name: tenantData.businessName || tenantData.business_name,
        contact_person: tenantData.contactPerson || tenantData.contact_person,
        contact_number: tenantData.contactNumber || tenantData.contact_number || tenantData.phone,
        business_type: tenantData.businessType || tenantData.business_type,
        business_address: tenantData.businessAddress || tenantData.business_address,
        profile_picture_url: getProfilePictureUrl(tenantData.profilePictureUrl || tenantData.profile_picture_url || tenantData.profilePicture || tenantData.profile_picture),
        contracts,
        complaints: Array.isArray(tenantData.complaints) ? tenantData.complaints : [],
      })
    } catch (error: unknown) {
      setFetchError(error instanceof Error ? error.message : 'Unable to verify this QR code.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleComplaintSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setComplaintError('')
    setComplaintSuccess('')
    setIsSubmittingComplaint(true)

    try {
      const body = new FormData()
      body.append('token', qrToken)
      body.append('access_code', accessCode)
      body.append('category', complaintCategory)
      body.append('subject', complaintSubject)
      body.append('message', complaintMessage)
      if (complaintImage) body.append('image', complaintImage)

      const response = await fetch('/api/tenant-scan/complaints', {
        method: 'POST',
        body,
      })

      const rawText = await response.text()
      let json: any = null
      if (rawText) {
        try {
          json = JSON.parse(rawText)
        } catch {
          json = null
        }
      }

      if (!response.ok) {
        const firstValidationError = Object.values(json?.errors || {}).flat()[0]
        throw new Error(
          json?.message ||
            (typeof firstValidationError === 'string' ? firstValidationError : null) ||
            `Unable to submit your message (server error ${response.status}).`,
        )
      }

      setComplaintSubject('')
      setComplaintMessage('')
      setComplaintImage(null)
      if (complaintImageInput.current) complaintImageInput.current.value = ''
      if (json?.data) {
        setTenant((current) => current
          ? { ...current, complaints: [json.data as TenantComplaint, ...current.complaints] }
          : current)
      }
      setComplaintSuccess(json?.message || 'Your message has been submitted successfully.')
    } catch (error: unknown) {
      setComplaintError(error instanceof Error ? error.message : 'Unable to submit your message.')
    } finally {
      setIsSubmittingComplaint(false)
    }
  }

  const handleTenantReplySubmit = async (event: React.FormEvent<HTMLFormElement>, complaintId: number) => {
    event.preventDefault()
    const message = (replyDrafts[complaintId] || '').trim()
    const image = replyImages[complaintId]
    if (message.length < 2) {
      setReplyFeedback((current) => ({ ...current, [complaintId]: { kind: 'error', message: 'Enter a reply of at least 2 characters.' } }))
      return
    }

    setSubmittingReplyId(complaintId)
    setReplyFeedback((current) => {
      const next = { ...current }
      delete next[complaintId]
      return next
    })

    try {
      const body = new FormData()
      body.append('token', qrToken)
      body.append('access_code', accessCode)
      body.append('complaint_id', String(complaintId))
      body.append('message', message)
      if (image) body.append('image', image)

      const response = await fetch('/api/tenant-scan/complaints/replies', {
        method: 'POST',
        body,
        cache: 'no-store',
      })
      const rawText = await response.text()
      let json: any = null
      if (rawText) {
        try {
          json = JSON.parse(rawText)
        } catch {
          json = null
        }
      }

      if (!response.ok) {
        const firstValidationError = Object.values(json?.errors || {}).flat()[0]
        throw new Error(
          json?.message ||
            (typeof firstValidationError === 'string' ? firstValidationError : null) ||
            `Unable to send your reply (server error ${response.status}).`,
        )
      }

      if (json?.data) {
        setTenant((current) => current
          ? {
              ...current,
              complaints: current.complaints.map((complaint) => complaint.id === complaintId
                ? { ...complaint, replies: [...(complaint.replies || []), json.data as NonNullable<TenantComplaint['replies']>[number]] }
                : complaint),
            }
          : current)
      }
      setReplyDrafts((current) => ({ ...current, [complaintId]: '' }))
      setReplyImages((current) => ({ ...current, [complaintId]: null }))
      setReplyFeedback((current) => ({
        ...current,
        [complaintId]: { kind: 'success', message: json?.message || 'Your reply has been submitted.' },
      }))
    } catch (error: unknown) {
      setReplyFeedback((current) => ({
        ...current,
        [complaintId]: { kind: 'error', message: error instanceof Error ? error.message : 'Unable to send your reply.' },
      }))
    } finally {
      setSubmittingReplyId(null)
    }
  }

  const setPaymentSlide = (contractId: number, slide: number) => {
    setPaymentSlides((current) => ({ ...current, [contractId]: slide }))
  }

  const totalSlides = tenant ? 1 + tenant.contracts.length : 0
  const nextSlide = () => setCurrentSlide((p) => Math.min(p + 1, totalSlides - 1))
  const prevSlide = () => setCurrentSlide((p) => Math.max(p - 1, 0))

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(e.touches[0]?.clientX ?? null)
  }
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return
    const delta = touchStartX - (e.changedTouches[0]?.clientX ?? touchStartX)
    if (delta > 45) nextSlide()
    else if (delta < -45) prevSlide()
    setTouchStartX(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="loading-spinner" aria-hidden="true" />
          <p className="mt-4 text-gray-600 font-medium">Loading tenant info...</p>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4">
        <form onSubmit={handleVerifyQrPassword} className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Enter QR password</h2>
          <p className="text-gray-600 text-sm text-center mb-6">
            Enter the 8-digit password shown on your tenant profile.
          </p>
          {fetchError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{fetchError}</p>}
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]{8}"
            maxLength={8}
            autoComplete="one-time-code"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="8-digit password"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-lg tracking-[0.3em] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            required
          />
          <button type="submit" disabled={isLoading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
            {isLoading ? <><span className="loading-spinner" aria-hidden="true" />Verifying…</> : 'Continue'}
          </button>
        </form>
      </div>
    )
  }

  const orgName = process.env.NEXT_PUBLIC_ORG_NAME || 'Philippine Fisheries Development Authority'

  return (
    <div className="min-h-screen bg-[#f3f7f6] pb-24 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-900 text-white shadow-sm">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-teal-950">{orgName}</p>
              <h1 className="mt-0.5 text-sm text-slate-500">Tenant portal</h1>
            </div>
          </div>
          <nav aria-label="Tenant navigation" className="hidden items-center gap-1 md:flex">
            <button type="button" onClick={() => setCurrentSlide(0)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <UserRound className="h-4 w-4" aria-hidden="true" /> Profile
            </button>
            <button type="button" onClick={() => setCurrentSlide(tenant.contracts.length ? 1 : 0)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <FileText className="h-4 w-4" aria-hidden="true" /> Contracts
            </button>
            <button
              type="button"
              onClick={() => { setExpandedComplaintId(null); setComplaintDrawerOpen(true) }}
              className="relative inline-flex items-center gap-2 rounded-xl bg-teal-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
              aria-label={`Open complaints${tenant.complaints.length ? `, ${tenant.complaints.length} total` : ''}`}
            >
              <MessageSquareText className="h-4 w-4" aria-hidden="true" /> Complaints
              {tenant.complaints.length > 0 && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{tenant.complaints.length}</span>}
            </button>
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => { setExpandedComplaintId(null); setComplaintDrawerOpen(true) }}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-teal-900 text-white shadow-sm transition hover:bg-teal-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
              aria-label={`Open complaints${tenant.complaints.length ? `, ${tenant.complaints.length} total` : ''}`}
            >
              <MessageSquareText className="h-5 w-5" aria-hidden="true" />
              {tenant.complaints.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-slate-950">{tenant.complaints.length}</span>}
            </button>
          </div>
          {isAdminView && (
            <button
              type="button"
              onClick={() => window.history.back()}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Back
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-9">
        <section className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-900 p-5 text-white shadow-lg sm:p-7">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-200">Tenant workspace</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{tenant.business_name || tenant.contact_person}</h2>
              <p className="mt-2 text-base text-teal-100">Your profile, contracts, payments, and support in one place.</p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                <p className="text-sm text-teal-100">Tenant code</p>
                <p className="mt-1 text-base font-semibold">{tenant.tenant_code || 'Not available'}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                <p className="text-sm text-teal-100">Contracts</p>
                <p className="mt-1 text-base font-semibold">{tenant.contracts.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="tenant-carousel" aria-label="Tenant profile and contracts" className="mx-auto max-w-5xl">
        {totalSlides > 1 && (
          <p className="mb-3 text-center text-sm text-slate-500">
            Use the arrows or swipe to browse your profile and contracts.
          </p>
        )}

        {/* Carousel */}
        <div className="overflow-hidden rounded-3xl" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {/* Slide 0 — Tenant info */}
            <div className="w-full shrink-0 px-0.5">
              <article className="min-h-[520px] rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex items-start gap-4 mb-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-3xl">
                    {tenant.profile_picture_url
                      ? <img src={tenant.profile_picture_url} alt={tenant.business_name} className="w-full h-full object-cover" />
                      : <Building2 className="h-8 w-8 text-slate-400" aria-hidden="true" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-teal-800">Tenant profile</p>
                    <h2 className="text-2xl font-bold leading-tight text-slate-950">{tenant.business_name || tenant.contact_person}</h2>
                    <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold capitalize ${statusColor(tenant.status)}`}>
                      {tenant.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoRow label="Tenant Code" value={tenant.tenant_code} />
                  <InfoRow label="Contact Person" value={tenant.contact_person} />
                  <InfoRow label="Contact Number" value={tenant.contact_number} />
                  <InfoRow label="Email" value={tenant.email} />
                  {tenant.business_type && <InfoRow label="Business Type" value={tenant.business_type} />}
                  {tenant.business_address && <InfoRow label="Address" value={tenant.business_address} />}
                  <InfoRow
                    label="Contracts"
                    value={tenant.contracts.length === 0
                      ? 'No contracts on file'
                      : `${tenant.contracts.length} contract${tenant.contracts.length > 1 ? 's' : ''}`}
                  />
                </div>
              </article>
            </div>

            {/* Slides 1+ — one per contract */}
            {tenant.contracts.map((contract, index) => (
              <div key={contract.id} className="w-full shrink-0 px-0.5">
                <article className="min-h-[520px] rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <div className="flex items-start justify-between mb-5 gap-2">
                    <div>
                      <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-indigo-800">
                        Contract {index + 1} of {tenant.contracts.length}
                      </p>
                      <h2 className="text-2xl font-bold leading-tight text-slate-950">
                        {contract.contract_number || `Contract #${contract.id}`}
                      </h2>
                    </div>
                    <span className={`mt-1 shrink-0 rounded-full border px-3 py-1 text-sm font-semibold capitalize ${statusColor(contract.status)}`}>
                      {(contract.status || '').replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoRow label="Unit / Stall" value={spaceLabel(contract.rental_space)} />
                    {contract.rental_space?.type && <InfoRow label="Space Type" value={contract.rental_space.type} />}
                    <InfoRow label="Start Date" value={formatDate(contract.start_date)} />
                    <InfoRow label="End Date" value={formatDate(contract.end_date)} />
                    <InfoRow
                      label="Monthly Rent"
                      value={`₱${Number(contract.monthly_rental || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                    />
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <h3 className="mb-3 flex items-center gap-2 text-base font-bold uppercase tracking-wider text-slate-700">
                      <Wallet className="h-4 w-4 text-teal-800" aria-hidden="true" /> Payment history
                    </h3>
                    {!contract.payments?.length ? (
                      <p className="text-sm text-slate-500">No payments recorded.</p>
                    ) : (
                      <div>
                        <div className="overflow-hidden">
                          <div
                            className="flex transition-transform duration-300 ease-out"
                            style={{ transform: `translateX(-${(paymentSlides[contract.id] || 0) * 100}%)` }}
                          >
                            {contract.payments.map((payment) => (
                              <div key={payment.id} className="w-full shrink-0">
                                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-700">
                                        {payment.payment_number || `Payment #${payment.id}`}
                                      </p>
                                      <p className="mt-1 text-sm text-slate-500">Due {formatDate(payment.due_date)}</p>
                                    </div>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${paymentStatusColor(payment.status || 'pending')}`}>
                                      {payment.status || 'pending'}
                                    </span>
                                  </div>
                                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                    <InfoRow label="Amount Due" value={`₱${Number(payment.amount_due || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
                                    <InfoRow label="Balance" value={`₱${Number(payment.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {contract.payments.length > 1 && (
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setPaymentSlide(contract.id, Math.max(0, (paymentSlides[contract.id] || 0) - 1))}
                              disabled={(paymentSlides[contract.id] || 0) === 0}
                              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
                            >
                              Previous
                            </button>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              {(paymentSlides[contract.id] || 0) + 1} / {contract.payments.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => setPaymentSlide(contract.id, Math.min(contract.payments!.length - 1, (paymentSlides[contract.id] || 0) + 1))}
                              disabled={(paymentSlides[contract.id] || 0) === contract.payments.length - 1}
                              className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>

        {/* Dots */}
        {totalSlides > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentSlide(i)}
                className={`h-2.5 rounded-full transition-all ${i === currentSlide ? 'w-7 bg-blue-600' : 'w-2.5 bg-slate-300'}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Prev / Next */}
        {totalSlides > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-base font-semibold text-slate-700 transition hover:bg-white disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
            </button>
            <span className="shrink-0 text-sm tabular-nums text-slate-500">{currentSlide + 1} / {totalSlides}</span>
            <button
              type="button"
              onClick={nextSlide}
              disabled={currentSlide === totalSlides - 1}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-900 py-3 text-base font-semibold text-white transition hover:bg-teal-950 disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        </section>

        <nav aria-label="Tenant quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
          <button type="button" onClick={() => setCurrentSlide(0)} className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-xs font-semibold text-slate-600">
            <UserRound className="h-5 w-5" aria-hidden="true" /> Profile
          </button>
          <button type="button" onClick={() => setCurrentSlide(tenant.contracts.length ? 1 : 0)} className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-xs font-semibold text-slate-600">
            <FileText className="h-5 w-5" aria-hidden="true" /> Contracts
          </button>
          <button type="button" onClick={() => { setExpandedComplaintId(null); setComplaintDrawerOpen(true) }} className="relative flex flex-col items-center gap-1 rounded-xl py-1.5 text-xs font-semibold text-teal-900">
            <MessageSquareText className="h-5 w-5" aria-hidden="true" /> Complaints
            {tenant.complaints.length > 0 && <span className="absolute left-1/2 top-0 ml-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-950">{tenant.complaints.length}</span>}
          </button>
        </nav>

        {complaintDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <button type="button" onClick={closeComplaintDrawer} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" aria-label="Close complaints panel" />
            <aside
              ref={complaintDrawerRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="complaint-drawer-title"
              tabIndex={-1}
              className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-[#f7faf9] shadow-2xl outline-none sm:border-l sm:border-slate-200"
            >
              <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  {expandedComplaintId !== null && (
                    <button type="button" onClick={() => setExpandedComplaintId(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-100" aria-label="Back to complaint list">
                      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                  )}
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-900 text-white">
                    <LifeBuoy className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 id="complaint-drawer-title" className="truncate text-lg font-bold text-slate-950 sm:text-xl">
                      {expandedComplaintId === null ? 'Complaints & support' : tenant.complaints.find((item) => item.id === expandedComplaintId)?.subject || 'Complaint details'}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {expandedComplaintId === null ? 'Your private support conversations' : 'Complaint details and replies'}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={closeComplaintDrawer} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100" aria-label="Close complaints">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
                <div className="mx-auto max-w-xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="tenant-requests-title">
          <div className="mb-4">
            <h2 id="tenant-requests-title" className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <MessageSquareText className="h-5 w-5 text-teal-800" aria-hidden="true" /> Your conversations
            </h2>
            <p className="mt-1 text-sm text-slate-600">Updates and replies from the PFDA team.</p>
          </div>
          {!tenant.complaints.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
              <p className="mt-3 text-base font-semibold text-slate-800">You are all caught up</p>
              <p className="mt-1 text-sm text-slate-500">No complaints have been submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tenant.complaints.filter((complaint) => expandedComplaintId === null || complaint.id === expandedComplaintId).map((complaint) => {
                const hasAdminReply = complaint.replies?.some((reply) => {
                  const role = String(reply.sender?.role || '').toLowerCase()
                  return role !== 'tenant'
                })

                return (
                <article key={complaint.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <button
                    type="button"
                    aria-expanded={expandedComplaintId === complaint.id}
                    aria-controls={`tenant-complaint-${complaint.id}`}
                    onClick={() => setExpandedComplaintId((current) => current === complaint.id ? null : complaint.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-teal-100"
                  >
                    <span className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 break-words text-base font-bold text-slate-900">
                          {complaint.subject}
                          {(complaint.has_image || complaint.hasImage) && <Paperclip className="h-4 w-4 shrink-0 text-slate-500" aria-label="Attachment available" />}
                        </span>
                        <time className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                          Submitted {formatDateTime(complaint.createdAt || complaint.created_at)}
                        </time>
                      </span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColor(complaint.status)}`}>
                        {(complaint.status || 'pending').replaceAll('_', ' ')}
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expandedComplaintId === complaint.id ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {expandedComplaintId === complaint.id && <div id={`tenant-complaint-${complaint.id}`} className="border-t border-slate-100 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-5 text-slate-700">{complaint.message}</p>
                  {complaintImageUrls[`${complaint.id}:complaint`] && (
                    <a href={complaintImageUrls[`${complaint.id}:complaint`]} target="_blank" rel="noreferrer" className="mt-3 block w-fit">
                      <Image src={complaintImageUrls[`${complaint.id}:complaint`]} alt="Image attached to complaint" width={720} height={480} unoptimized className="max-h-64 w-auto rounded-lg border border-slate-200 object-contain" />
                    </a>
                  )}
                  {complaintImageStates[`${complaint.id}:complaint`] && (
                    <p role="status" className="mt-3 text-xs text-slate-500">
                      {complaintImageStates[`${complaint.id}:complaint`].status === 'loading'
                        ? 'Loading complaint image…'
                        : `Complaint image unavailable: ${complaintImageStates[`${complaint.id}:complaint`].message}`}
                    </p>
                  )}
                  <div className="mt-3 space-y-2">
                    {complaint.reply && !hasAdminReply && (
                      <div className="rounded-lg border border-teal-100 bg-teal-50/70 p-3">
                        <p className="text-xs font-bold text-teal-800">Previous administration response</p>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-slate-800">{complaint.reply}</p>
                      </div>
                    )}
                    {complaint.replies?.map((reply) => (
                      <div key={reply.id} className="rounded-lg border border-teal-100 bg-teal-50/70 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-teal-800">
                            {String(reply.sender?.role || '').toLowerCase() === 'tenant' ? 'Your reply' : 'Administration response'}
                          </span>
                          <time className="text-[11px] text-slate-500">{formatDateTime(reply.createdAt || reply.created_at)}</time>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-slate-800">{reply.message}</p>
                        {complaintImageUrls[`${complaint.id}:reply:${reply.id}`] && (
                          <a href={complaintImageUrls[`${complaint.id}:reply:${reply.id}`]} target="_blank" rel="noreferrer" className="mt-3 block w-fit">
                            <Image src={complaintImageUrls[`${complaint.id}:reply:${reply.id}`]} alt="Image attached to response" width={720} height={480} unoptimized className="max-h-64 w-auto rounded-lg border border-slate-200 object-contain" />
                          </a>
                        )}
                        {complaintImageStates[`${complaint.id}:reply:${reply.id}`] && (
                          <p role="status" className="mt-3 text-xs text-slate-500">
                            {complaintImageStates[`${complaint.id}:reply:${reply.id}`].status === 'loading'
                              ? 'Loading reply image…'
                              : `Reply image unavailable: ${complaintImageStates[`${complaint.id}:reply:${reply.id}`].message}`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {String(complaint.status || '').toLowerCase() !== 'resolved' && (
                    <form onSubmit={(event) => void handleTenantReplySubmit(event, complaint.id)} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <label htmlFor={`tenant-reply-${complaint.id}`} className="mb-1.5 block text-xs font-semibold text-slate-700">Reply to this complaint</label>
                      <textarea
                        id={`tenant-reply-${complaint.id}`}
                        value={replyDrafts[complaint.id] || ''}
                        onChange={(event) => setReplyDrafts((current) => ({ ...current, [complaint.id]: event.target.value }))}
                        minLength={2}
                        maxLength={5000}
                        rows={2}
                        required
                        placeholder="Add a follow-up message"
                        className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-50"
                      />
                      <label htmlFor={`tenant-reply-image-${complaint.id}`} className="mt-3 block text-xs font-semibold text-slate-700">
                        Image attachment <span className="font-normal text-slate-500">(optional, up to 5 MB)</span>
                      </label>
                      <input
                        key={replyImages[complaint.id]?.name || `empty-${complaint.id}`}
                        id={`tenant-reply-image-${complaint.id}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null
                          if (file && file.size > 5 * 1024 * 1024) {
                            setReplyImages((current) => ({ ...current, [complaint.id]: null }))
                            setReplyFeedback((current) => ({ ...current, [complaint.id]: { kind: 'error', message: 'The image must be 5 MB or smaller.' } }))
                            event.target.value = ''
                            return
                          }
                          setReplyImages((current) => ({ ...current, [complaint.id]: file }))
                        }}
                        className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
                      />
                      {replyImages[complaint.id] && <p className="mt-1.5 text-xs text-slate-500">Selected: {replyImages[complaint.id]?.name}</p>}
                      {replyFeedback[complaint.id] && (
                        <p role={replyFeedback[complaint.id].kind === 'error' ? 'alert' : 'status'} className={`mt-2 text-xs ${replyFeedback[complaint.id].kind === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {replyFeedback[complaint.id].message}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={submittingReplyId === complaint.id}
                        className="mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submittingReplyId === complaint.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                        {submittingReplyId === complaint.id ? 'Sending…' : 'Send reply'}
                      </button>
                    </form>
                  )}
                  </div>}
                </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="tenant-complaint-title">
          <h2 id="tenant-complaint-title" className="text-lg font-bold text-slate-900">
            Send a complaint or message
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Your message will be associated with {tenant.business_name || 'this tenant'} using this validated QR code.
          </p>

          <form onSubmit={handleComplaintSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="complaint-category" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Category
              </label>
              <select
                id="complaint-category"
                value={complaintCategory}
                onChange={(event) => setComplaintCategory(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                required
              >
                <option value="rental_space">Rental space</option>
                <option value="payments">Payments</option>
                <option value="contracts">Contracts</option>
                <option value="facilities">Facilities</option>
                <option value="staff_service">Staff service</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="complaint-subject" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Subject
              </label>
              <input
                id="complaint-subject"
                value={complaintSubject}
                onChange={(event) => setComplaintSubject(event.target.value)}
                minLength={3}
                maxLength={150}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base text-slate-900 outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                placeholder="Briefly describe your concern"
              />
            </div>

            <div>
              <label htmlFor="complaint-message" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Message
              </label>
              <textarea
                id="complaint-message"
                value={complaintMessage}
                onChange={(event) => setComplaintMessage(event.target.value)}
                minLength={10}
                maxLength={5000}
                rows={5}
                required
                className="w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-base text-slate-900 outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                placeholder="Provide details so the PFDA team can assist you."
              />
            </div>

            <div>
              <label htmlFor="complaint-image" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Image attachment <span className="font-normal text-slate-500">(optional, JPG/PNG/WebP up to 5 MB)</span>
              </label>
              <input
                ref={complaintImageInput}
                id="complaint-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  if (file && file.size > 5 * 1024 * 1024) {
                    setComplaintError('The image must be 5 MB or smaller.')
                    setComplaintImage(null)
                    event.target.value = ''
                    return
                  }
                  setComplaintError('')
                  setComplaintImage(file)
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
              />
              {complaintImage && (
                <p className="mt-1.5 text-xs text-slate-500">Selected: {complaintImage.name}</p>
              )}
            </div>

            {complaintError && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {complaintError}
              </p>
            )}
            {complaintSuccess && (
              <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                {complaintSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmittingComplaint}
              className="w-full rounded-xl bg-teal-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-teal-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingComplaint ? 'Sending message…' : 'Submit message'}
            </button>
          </form>
        </section>
                </div>
              </div>
            </aside>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-slate-400">{orgName}</p>
      </main>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenantScanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-blue-50">
          <div className="loading-spinner" aria-hidden="true" />
        </div>
      }
    >
      <TenantScanContent />
    </Suspense>
  )
}
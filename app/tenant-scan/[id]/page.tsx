'use client'

import Image from 'next/image'
import { Suspense, useEffect, useRef, useState } from 'react'
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
  switch (s?.toLowerCase()) {
    case 'active':      return 'bg-green-100 text-green-800'
    case 'for renewal': return 'bg-amber-100 text-amber-800'
    case 'expired':     return 'bg-red-100 text-red-800'
    case 'terminated':  return 'bg-gray-100 text-gray-600'
    default:            return 'bg-blue-100 text-blue-800'
  }
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
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-900 break-words">{value || 'N/A'}</p>
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
  const [complaintImageError, setComplaintImageError] = useState('')
  const complaintImageInput = useRef<HTMLInputElement>(null)
  const [complaintSuccess, setComplaintSuccess] = useState('')
  const [complaintError, setComplaintError] = useState('')
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false)

  useEffect(() => {
    let cancelled = false
    const createdUrls: string[] = []
    setComplaintImageUrls({})
    setComplaintImageError('')

    const loadImage = async (key: string, complaintId: number, replyId?: number) => {
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
        if (!response.ok) throw new Error('Unable to load an image attachment.')

        const imageUrl = URL.createObjectURL(await response.blob())
        if (cancelled) {
          URL.revokeObjectURL(imageUrl)
          return
        }

        createdUrls.push(imageUrl)
        setComplaintImageUrls((current) => ({ ...current, [key]: imageUrl }))
      } catch {
        if (!cancelled) setComplaintImageError('Some complaint images could not be loaded. Please refresh and try again.')
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="flex-1 text-center">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest">{orgName}</p>
            <h1 className="text-sm text-gray-500 mt-0.5">Tenant QR Information</h1>
          </div>
          {isAdminView && (
            <button
              type="button"
              onClick={() => window.history.back()}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Back
            </button>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-3 py-5">
        {totalSlides > 1 && (
          <p className="text-center text-xs text-slate-500 mb-3">
            Swipe left / right to browse cards
          </p>
        )}

        {/* Carousel */}
        <div className="overflow-hidden rounded-2xl" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {/* Slide 0 — Tenant info */}
            <div className="w-full shrink-0 px-0.5">
              <article className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5 min-h-[70vh]">
                <div className="flex items-start gap-4 mb-5">
                  <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center text-3xl">
                    {tenant.profile_picture_url
                      ? <img src={tenant.profile_picture_url} alt={tenant.business_name} className="w-full h-full object-cover" />
                      : '🏢'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-widest text-blue-700 font-semibold mb-0.5">Tenant</p>
                    <h2 className="text-xl font-bold text-gray-900 leading-tight">{tenant.business_name || tenant.contact_person}</h2>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor(tenant.status)}`}>
                      {tenant.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm">
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
                <article className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5 min-h-[70vh]">
                  <div className="flex items-start justify-between mb-5 gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-indigo-700 font-semibold mb-0.5">
                        Contract {index + 1} of {tenant.contracts.length}
                      </p>
                      <h2 className="text-xl font-bold text-gray-900 leading-tight">
                        {contract.contract_number || `Contract #${contract.id}`}
                      </h2>
                    </div>
                    <span className={`shrink-0 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor(contract.status)}`}>
                      {(contract.status || '').replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm">
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
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-700">Payment History</h3>
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
                                      <p className="text-xs font-semibold text-slate-700">
                                        {payment.payment_number || `Payment #${payment.id}`}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-500">Due {formatDate(payment.due_date)}</p>
                                    </div>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${paymentStatusColor(payment.status || 'pending')}`}>
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
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium disabled:opacity-40 active:scale-95 transition"
            >
              ← Previous
            </button>
            <span className="text-xs text-slate-500 tabular-nums shrink-0">{currentSlide + 1} / {totalSlides}</span>
            <button
              type="button"
              onClick={nextSlide}
              disabled={currentSlide === totalSlides - 1}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40 active:scale-95 transition"
            >
              Next →
            </button>
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-lg" aria-labelledby="tenant-requests-title">
          <div className="mb-4">
            <h2 id="tenant-requests-title" className="text-lg font-bold text-slate-900">Your complaints and responses</h2>
            <p className="mt-1 text-sm text-slate-600">Private to this tenant QR code and its access password.</p>
          </div>
          {!tenant.complaints.length ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No complaints have been submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {tenant.complaints.map((complaint) => (
                <article key={complaint.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-bold text-slate-900">{complaint.subject}</h3>
                      <time className="mt-1 block text-xs text-slate-500">
                        Submitted {formatDateTime(complaint.createdAt || complaint.created_at)}
                      </time>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColor(complaint.status)}`}>
                      {(complaint.status || 'pending').replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-slate-700">{complaint.message}</p>
                  {complaintImageUrls[`${complaint.id}:complaint`] && (
                    <a href={complaintImageUrls[`${complaint.id}:complaint`]} target="_blank" rel="noreferrer" className="mt-3 block w-fit">
                      <Image src={complaintImageUrls[`${complaint.id}:complaint`]} alt="Image attached to complaint" width={720} height={480} unoptimized className="max-h-64 w-auto rounded-lg border border-slate-200 object-contain" />
                    </a>
                  )}
                  <div className="mt-3 space-y-2">
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
                      </div>
                    ))}
                    {!complaint.replies?.length && complaint.reply && (
                      <div className="rounded-lg border border-teal-100 bg-teal-50/70 p-3">
                        <p className="text-xs font-bold text-teal-800">Administration response</p>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-slate-800">{complaint.reply}</p>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-lg" aria-labelledby="tenant-complaint-title">
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
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
              {complaintImageError && (
                <p role="status" className="mt-1.5 text-xs text-amber-700">{complaintImageError}</p>
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
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingComplaint ? 'Sending message…' : 'Submit message'}
            </button>
          </form>
        </section>

        <p className="text-center text-xs text-slate-400 mt-6">{orgName}</p>
      </div>
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
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RentalSpace {
  id: number
  unit_number?: string
  name?: string
  type?: string
  floor?: string | number
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
  const tenantId = params?.id as string
  const isAdminView = searchParams?.get('admin') === '1'

  const [tenant, setTenant] = useState<TenantPublic | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [accessCode, setAccessCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [paymentSlides, setPaymentSlides] = useState<Record<number, number>>({})
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  const loadTenant = async (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault()
    }

    if (!tenantId) {
      setFetchError('Tenant not found.')
      return
    }

    if (!isAdminView && !/^\d{8}$/.test(accessCode)) {
      setFetchError('Enter the 8-digit tenant QR password.')
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setIsVerifying(true)
    setFetchError(null)

    try {
      const endpoint = `/api/tenant-scan/${encodeURIComponent(tenantId)}`
      const payload = isAdminView
        ? { admin_bypass: true }
        : {
            access_code: accessCode,
            qr_access_code: accessCode,
          }

      const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }

      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`
      } else if (isAdminView) {
        throw new Error('Your admin session has expired. Please log in again.')
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify(payload),
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

      const responseBody = json?.data ?? json
      if (!responseBody) {
        throw new Error('Tenant not found')
      }

      const tenantData = isAdminView ? responseBody : responseBody
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
      })
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        const isNetworkError = err instanceof TypeError && /fetch|network|failed/i.test(err.message || '')
        setFetchError(
          isNetworkError
            ? 'Unable to connect to the backend from this device. Start the backend on 0.0.0.0:8000 and allow port 8000 through Windows Firewall.'
            : err?.message || 'Unable to load tenant information',
        )
      }
    } finally {
      setIsLoading(false)
      setIsVerifying(false)
      controller.abort()
    }
  }

  const setPaymentSlide = (contractId: number, slide: number) => {
    setPaymentSlides((current) => ({ ...current, [contractId]: slide }))
  }

  useEffect(() => {
    if (isAdminView) {
      void loadTenant()
    }
  }, [isAdminView, tenantId])

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
    if (isAdminView) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
            <div className="loading-spinner" aria-hidden="true" />
            <p className="mt-4 text-gray-600 font-medium">Loading tenant info...</p>
            {fetchError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{fetchError}</p>}
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4">
        <form onSubmit={loadTenant} className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Enter QR Password</h2>
          <p className="text-gray-500 text-sm text-center mb-6">Enter the 8-digit password provided by the PFDA administrator.</p>
          {fetchError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{fetchError}</p>}
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]{8}"
            maxLength={8}
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="8-digit password"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-lg tracking-[0.3em] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            required
          />
          <button type="submit" disabled={isVerifying} className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
            {isVerifying ? 'Verifying...' : 'View Tenant Information'}
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
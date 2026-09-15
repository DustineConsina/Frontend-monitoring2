'use client'

import { Suspense, useEffect, useMemo, useState, type ReactNode, type TouchEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { Contract } from '@/types'

type TenantRecord = {
  id?: string | number
  tenant_code?: string
  business_name?: string
  businessName?: string
  contact_person?: string
  contactPerson?: string
  email?: string
  address?: string
  business_address?: string
  contact_number?: string
  user?: {
    name?: string
    email?: string
    phone?: string
  }
}

type ApiContract = Partial<Contract> & {
  id?: string | number
  tenant?: { id?: string | number }
}

type TenantWithContracts = {
  tenantId: string
  tenant: TenantRecord
  tenantQrCode?: string
  qrTargetUrl: string
  contracts: Contract[]
}

type PaperSizeOption = 'letter' | 'long' | 'legal' | 'a4'

const PAPER_SIZES: Record<PaperSizeOption, { label: string; pageCss: string; previewWidth: string }> = {
  letter: {
    label: 'Short Bond / Letter (8.5" × 11")',
    pageCss: '8.5in 11in',
    previewWidth: '215.9mm',
  },
  long: {
    label: 'Long Bond / Folio (8.5" × 13")',
    pageCss: '8.5in 13in',
    previewWidth: '215.9mm',
  },
  legal: {
    label: 'Legal (8.5" × 14")',
    pageCss: '8.5in 14in',
    previewWidth: '215.9mm',
  },
  a4: {
    label: 'A4 (8.27" × 11.69")',
    pageCss: 'A4',
    previewWidth: '210mm',
  },
}

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

const parseUrlSafe = (value: string): URL | null => {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

const isLocalHostName = (hostname: string) => LOCALHOST_HOSTNAMES.has(hostname.toLowerCase())

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const getTenantName = (tenant: TenantRecord) =>
  tenant.contact_person ||
  tenant.contactPerson ||
  tenant.user?.name ||
  tenant.business_name ||
  tenant.businessName ||
  'Tenant'

const getTenantEmail = (tenant: TenantRecord) => tenant.user?.email || tenant.email || 'N/A'

const getTenantContact = (tenant: TenantRecord) => tenant.contact_number || tenant.user?.phone || 'N/A'

const getSpaceLabel = (contract: Contract) => {
  const rentalSpace = contract.rentalSpace || contract.rental_space
  return rentalSpace?.spaceCode || rentalSpace?.space_code || rentalSpace?.name || rentalSpace?.spaceNumber || 'N/A'
}

const formatDate = (dateInput?: string) => {
  if (!dateInput) return 'N/A'
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return 'N/A'
  return date.toLocaleDateString()
}

const normalizeContract = (contract: ApiContract): Contract => ({
  ...contract,
  id: String(contract.id || ''),
  contractNumber: contract.contractNumber || contract.contract_number || `Contract ${contract.id || ''}`,
  tenantId: String(contract.tenantId || contract.tenant_id || contract.tenant?.id || ''),
  rentalSpace: contract.rentalSpace || contract.rental_space,
  startDate: contract.startDate || contract.start_date,
  endDate: contract.endDate || contract.end_date,
  monthlyRent: parseFloat(String(contract.monthlyRent || contract.monthlyRental || contract.monthly_rental || 0)),
  status: contract.status || 'PENDING',
})

const unwrapApiData = (response: unknown): unknown => {
  if (!response || typeof response !== 'object') return response

  const topLevelData = (response as { data?: unknown }).data
  if (topLevelData === undefined) return response

  if (topLevelData && typeof topLevelData === 'object' && 'data' in (topLevelData as object)) {
    return (topLevelData as { data?: unknown }).data
  }

  return topLevelData
}

const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

const buildOriginFromIp = (protocol: string, ipAddress: string, port: string) =>
  `${protocol}//${ipAddress}${port ? `:${port}` : ''}`

const getQrTargetUrl = (tenantId: string, baseUrl: string) => {
  return `${stripTrailingSlash(baseUrl)}/tenant-scan/${encodeURIComponent(tenantId)}`
}

function TenantBulkQRPrintPageContent() {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tenantGroups, setTenantGroups] = useState<TenantWithContracts[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [qrBaseUrl, setQrBaseUrl] = useState('')

  // Print customization options
  const [paperSize, setPaperSize] = useState<PaperSizeOption>('letter')
  const [columns, setColumns] = useState<number>(3)
  const [cardBorder, setCardBorder] = useState<'dashed' | 'solid' | 'none'>('dashed')

  const tenantIdsParam = searchParams.get('tenantIds') || ''
  const viewMode = searchParams.get('view') || ''

  const tenantIds = useMemo(() => {
    const parsedIds = tenantIdsParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
    return Array.from(new Set(parsedIds))
  }, [tenantIdsParam])

  const isScanMode = viewMode === 'scan' && tenantIds.length === 1
  const isQrOnlyMode = viewMode === 'qr' && tenantIds.length === 1
  const scanGroup = isScanMode ? tenantGroups[0] : null
  const scanSlides = useMemo(() => {
    if (!scanGroup) return []
    return [
      { type: 'tenant' as const },
      ...scanGroup.contracts.map((contract) => ({ type: 'contract' as const, contract })),
    ]
  }, [scanGroup])

  useEffect(() => {
    setCurrentSlide(0)
  }, [tenantIdsParam, viewMode])

  useEffect(() => {
    const resolveBaseUrl = async () => {
      if (typeof window === 'undefined') {
        return
      }

      const protocol = window.location.protocol
      const windowPort = window.location.port
      const configuredPort = process.env.NEXT_PUBLIC_LOCAL_NETWORK_PORT || windowPort
      const configuredBaseUrl = process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || ''

      if (!isLocalHostName(window.location.hostname)) {
        setQrBaseUrl(window.location.origin)
        return
      }

      try {
        const response = await fetch('/api/network-ip', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Failed to resolve local IP (HTTP ${response.status})`)
        }

        const payload = (await response.json()) as { ipAddress?: string }
        if (!payload.ipAddress) {
          throw new Error('No local IP returned by /api/network-ip')
        }

        setQrBaseUrl(buildOriginFromIp(protocol, payload.ipAddress, configuredPort))
        return
      } catch (resolveError) {
        console.error('Could not resolve current local IP for QR base URL:', resolveError)
      }

      if (configuredBaseUrl) {
        const parsedBaseUrl = parseUrlSafe(configuredBaseUrl)
        if (parsedBaseUrl) {
          setQrBaseUrl(parsedBaseUrl.origin)
          return
        }
      }

      setQrBaseUrl(window.location.origin)
    }

    resolveBaseUrl()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      if (!qrBaseUrl) {
        return
      }

      if (tenantIds.length === 0) {
        setError('No tenant selected for QR view.')
        setTenantGroups([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const [contractsResponse, tenantResponses] = await Promise.all([
          apiClient.getContracts(),
          Promise.all(tenantIds.map((tenantId) => apiClient.getTenant(tenantId))),
        ])

        const rawContracts = unwrapApiData(contractsResponse)
        const allContracts = Array.isArray(rawContracts)
          ? rawContracts.map((contract) => normalizeContract(contract as ApiContract))
          : []

        const tenantMap = new Map<string, TenantRecord>()
        tenantResponses.forEach((response, index) => {
          const tenantRecord = unwrapApiData(response)
          if (tenantRecord && typeof tenantRecord === 'object') {
            tenantMap.set(tenantIds[index], tenantRecord as TenantRecord)
          }
        })

        const contractsByTenant = new Map<string, Contract[]>()
        const selectedTenantIds = new Set(tenantIds)

        allContracts.forEach((contract) => {
          const contractTenantId = String(contract.tenantId || '')
          if (!selectedTenantIds.has(contractTenantId)) return

          if (!contractsByTenant.has(contractTenantId)) {
            contractsByTenant.set(contractTenantId, [])
          }
          contractsByTenant.get(contractTenantId)?.push(contract)
        })

        const groups: (TenantWithContracts | null)[] = await Promise.all(
          tenantIds.map(async (tenantId) => {
            const tenant = tenantMap.get(tenantId)
            if (!tenant) {
              return null
            }

            const qrTargetUrl = getQrTargetUrl(tenantId, qrBaseUrl)
            // Generate crisp high-resolution QR code
            const tenantQrCode = isScanMode
              ? undefined
              : await QRCode.toDataURL(qrTargetUrl, {
                  width: 360,
                  margin: 1,
                  errorCorrectionLevel: 'M',
                })

            return {
              tenantId,
              tenant,
              tenantQrCode,
              qrTargetUrl,
              contracts: contractsByTenant.get(tenantId) || [],
            }
          })
        )

        const validGroups = groups.filter((group): group is TenantWithContracts => group !== null)
        if (validGroups.length === 0) {
          setError('No tenant data found for the selected tenant IDs.')
          setTenantGroups([])
          return
        }

        setTenantGroups(validGroups)
      } catch (fetchError: unknown) {
        console.error('Failed to load tenant QR data:', fetchError)
        setError(getErrorMessage(fetchError, 'Failed to load tenant QR data.'))
        setTenantGroups([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [tenantIds, tenantIdsParam, isScanMode, qrBaseUrl])

  const wrap = (content: ReactNode) => (isScanMode ? <>{content}</> : <ProtectedRoute>{content}</ProtectedRoute>)

  const nextSlide = () => {
    if (scanSlides.length === 0) return
    setCurrentSlide((prev) => Math.min(prev + 1, scanSlides.length - 1))
  }

  const prevSlide = () => {
    if (scanSlides.length === 0) return
    setCurrentSlide((prev) => Math.max(prev - 1, 0))
  }

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null)
  }

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return
    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX
    const delta = touchStartX - touchEndX
    const threshold = 45

    if (delta > threshold) {
      nextSlide()
    } else if (delta < -threshold) {
      prevSlide()
    }

    setTouchStartX(null)
  }

  if (isLoading) {
    return wrap(
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="loading-spinner" aria-hidden="true" />
          <p className="mt-4 text-gray-600">Loading tenant QR codes...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return wrap(
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        {!isScanMode && (
          <Link href="/dashboard/tenants" className="back-action mt-4">
            Back to Tenants
          </Link>
        )}
      </div>
    )
  }

  // Scan Mode (Mobile Swipe View when scanned from camera)
  if (isScanMode && scanGroup) {
    const primaryStall = scanGroup.contracts[0] ? getSpaceLabel(scanGroup.contracts[0]) : 'N/A'
    const totalSlides = scanSlides.length

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-3 py-6">
        <div className="max-w-md mx-auto">
          <div className="mb-4 text-center">
            <h1 className="text-xl font-bold text-gray-900">Tenant QR Details</h1>
            <p className="text-sm text-gray-600">Swipe left or right to browse cards</p>
          </div>

          <div
            className="overflow-hidden rounded-2xl"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="flex transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              <div className="w-full shrink-0 px-1">
                <article className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5 min-h-[72vh]">
                  <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold mb-2">Tenant Information</p>
                  <h2 className="text-2xl font-bold text-gray-900">{getTenantName(scanGroup.tenant)}</h2>
                  <p className="text-sm text-gray-500 mt-1">Tenant Code: {scanGroup.tenant.tenant_code || 'N/A'}</p>

                  <div className="mt-6 grid grid-cols-1 gap-4 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <p className="text-gray-500">Unit / Stall</p>
                      <p className="text-base font-semibold text-gray-900">{primaryStall}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <p className="text-gray-500">Email</p>
                      <p className="text-base font-semibold text-gray-900 break-words">{getTenantEmail(scanGroup.tenant)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <p className="text-gray-500">Contact Number</p>
                      <p className="text-base font-semibold text-gray-900">{getTenantContact(scanGroup.tenant)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <p className="text-gray-500">Address</p>
                      <p className="text-base font-semibold text-gray-900">{scanGroup.tenant.address || scanGroup.tenant.business_address || 'N/A'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <p className="text-gray-500">Contracts</p>
                      <p className="text-base font-semibold text-gray-900">{scanGroup.contracts.length}</p>
                    </div>
                  </div>
                </article>
              </div>

              {scanGroup.contracts.map((contract, index) => (
                <div key={contract.id || `contract-${index}`} className="w-full shrink-0 px-1">
                  <article className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5 min-h-[72vh]">
                    <p className="text-xs uppercase tracking-wide text-indigo-700 font-semibold mb-2">
                      Contract {index + 1} of {scanGroup.contracts.length}
                    </p>
                    <h2 className="text-xl font-bold text-gray-900">{contract.contractNumber || contract.contract_number || 'N/A'}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Status: {(contract.status || 'PENDING').toString().toUpperCase().replace('_', ' ')}
                    </p>

                    <div className="mt-6 grid grid-cols-1 gap-4 text-sm">
                      <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                        <p className="text-gray-500">Unit / Stall</p>
                        <p className="text-base font-semibold text-gray-900">{getSpaceLabel(contract)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                        <p className="text-gray-500">Period</p>
                        <p className="text-base font-semibold text-gray-900">
                          {formatDate(contract.startDate)} to {formatDate(contract.endDate)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                        <p className="text-gray-500">Monthly Rent</p>
                        <p className="text-base font-semibold text-gray-900">₱{(contract.monthlyRent || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <button
                key={`dot-${idx}`}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className={`h-2.5 rounded-full transition-all ${currentSlide === idx ? 'w-7 bg-blue-600' : 'w-2.5 bg-slate-300'}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <p className="text-sm text-slate-600">
              {currentSlide + 1} / {totalSlides}
            </p>
            <button
              type="button"
              onClick={nextSlide}
              disabled={currentSlide === totalSlides - 1}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isQrOnlyMode && tenantGroups[0]) {
    const group = tenantGroups[0]
    const tenantName = getTenantName(group.tenant)

    return (
      <ProtectedRoute>
        <div className="flex min-h-screen items-center justify-center bg-white p-6">
          {group.tenantQrCode ? (
            <img
              src={group.tenantQrCode}
              alt={`QR Code for ${tenantName}`}
              className="h-auto w-full max-w-md object-contain"
            />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center bg-gray-100 text-sm text-gray-400">
              Generating QR...
            </div>
          )}
        </div>
      </ProtectedRoute>
    )
  }

  // Grid columns class based on selection
  const gridColsClass =
    columns === 2
      ? 'grid-cols-2'
      : columns === 4
      ? 'grid-cols-4'
      : 'grid-cols-3'

  const borderClass =
    cardBorder === 'dashed'
      ? 'border border-dashed border-gray-400'
      : cardBorder === 'solid'
      ? 'border border-gray-300'
      : 'border-0'

  return (
    <ProtectedRoute>
      <div className="space-y-6 print:space-y-0">
        {/* Print Toolbar / Controls - Hidden when printing */}
        <div className="no-print bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <Link href="/dashboard/tenants" className="back-action mb-3">
                Back to Tenants
              </Link>
              <h2 className="text-2xl font-bold text-gray-900">Tenant QR Code Grid Print</h2>
              <p className="text-sm text-gray-600">
                {tenantGroups.length} tenant{tenantGroups.length > 1 ? 's' : ''} ready to print on bond paper grid.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="action-primary inline-flex items-center justify-center gap-2 rounded-lg border px-6 py-2.5 font-semibold shadow-sm transition active:scale-95"
              >
                Print QR Codes
              </button>
            </div>
          </div>

          {/* Configuration Controls */}
          <div className="pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <label className="block font-medium text-gray-700 mb-1">Paper Size</label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as PaperSizeOption)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {Object.entries(PAPER_SIZES).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-1">Grid Columns</label>
              <select
                value={columns}
                onChange={(e) => setColumns(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={2}>2 Columns (4–6 per page)</option>
                <option value={3}>3 Columns (6–9 per page - Recommended)</option>
                <option value={4}>4 Columns (8–12 per page - Compact)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-1">Card Cutting Guide</label>
              <select
                value={cardBorder}
                onChange={(e) => setCardBorder(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="dashed">Dashed Cut Guidelines (✂️)</option>
                <option value="solid">Solid Border</option>
                <option value="none">No Border / Clean</option>
              </select>
            </div>
          </div>
        </div>

        {/* Paper Sheet Preview / Print Container */}
        <div className="print-area mx-auto max-w-5xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 shadow-sm print:p-0 print:border-0 print:shadow-none">
            <div className={`grid ${gridColsClass} qr-grid gap-4 sm:gap-6 print:gap-3`}>
              {tenantGroups.map((group) => {
                const tenantName = getTenantName(group.tenant)

                return (
                  <div
                    key={group.tenantId}
                    className={`qr-card ${borderClass} bg-white rounded-lg p-4 flex flex-col items-center justify-between text-center transition-all`}
                  >
                    {/* QR Code Graphic */}
                    <div className="w-full flex items-center justify-center p-1">
                      {group.tenantQrCode ? (
                        <img
                          src={group.tenantQrCode}
                          alt={`QR Code for ${tenantName}`}
                          className="w-40 h-40 sm:w-44 sm:h-44 md:w-48 md:h-48 object-contain print:w-36 print:h-36"
                        />
                      ) : (
                        <div className="w-40 h-40 bg-gray-100 flex items-center justify-center rounded text-gray-400 text-xs">
                          Generating QR...
                        </div>
                      )}
                    </div>

                    {/* ONLY Tenant Name (No other tenant details) */}
                    <div className="mt-2 w-full px-1">
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight break-words uppercase tracking-wide">
                        {tenantName}
                      </h3>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Print-specific CSS */}
      <style jsx global>{`
        @page {
          size: ${PAPER_SIZES[paperSize].pageCss};
          margin: 8mm 10mm;
        }

        @media print {
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide everything not meant for printing */
          .no-print,
          header,
          nav,
          aside,
          footer {
            display: none !important;
          }

          .print-area {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .qr-grid {
            display: grid !important;
            grid-template-columns: repeat(${columns}, minmax(0, 1fr)) !important;
            gap: 4mm !important;
            width: 100% !important;
          }

          .qr-card {
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            padding: 3mm !important;
            background: #ffffff !important;
          }

          .qr-card img {
            max-width: 100% !important;
            height: auto !important;
            max-height: 42mm !important;
          }

          .qr-card h3 {
            font-size: 11pt !important;
            color: #000000 !important;
            margin-top: 2mm !important;
            line-height: 1.2 !important;
          }
        }
      `}</style>
    </ProtectedRoute>
  )
}

export default function TenantBulkQRPrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-600">Loading QR print page...</div>}>
      <TenantBulkQRPrintPageContent />
    </Suspense>
  )
}

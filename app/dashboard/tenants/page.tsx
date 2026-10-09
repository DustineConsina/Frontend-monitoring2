'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient, { resolveApiBaseUrl } from '@/lib/api-client'
import Pagination from '@/components/Pagination'
import { ArrowUpRight, Building2, Mail, Phone, Printer, QrCode, Search, UserPlus, UserRound, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

type TenantQRRecord = {
  id: string | number
  businessName?: string
  business_name?: string
  contactPerson?: string
  contact_person?: string
  user?: {
    name?: string
  }
}

const getRuntimeApiBaseUrl = () => {
  try {
    const apiUrl = new URL(resolveApiBaseUrl())
    if (
      typeof window !== 'undefined' &&
      /^(localhost|127\.0\.0\.1|::1)$/i.test(apiUrl.hostname) &&
      !/^(localhost|127\.0\.0\.1|::1)$/i.test(window.location.hostname)
    ) {
      apiUrl.hostname = window.location.hostname
    }
    return apiUrl.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

const getProfilePictureProxyUrl = (url: string) => {
  const storageMarker = '/api/storage/'
  const storageIndex = url.indexOf(storageMarker)
  if (storageIndex === -1) return null
  return `/api/profile-picture/${url.slice(storageIndex + storageMarker.length)}`
}

const getProfilePictureUrl = (tenant: any) => {
  const runtimeApiBaseUrl = getRuntimeApiBaseUrl()
  // Use the URL returned by the backend (already fully resolved)
  const url = tenant.profilePictureUrl || tenant.profilePicture || tenant.profile_picture_url || tenant.profile_picture || tenant.user?.profilePictureUrl || tenant.user?.profile_picture_url
  if (url) {
    // If it's already a full URL, return it directly
    if (/^https?:\/\//i.test(url)) {
      try {
        const parsedUrl = new URL(url)
        if (!runtimeApiBaseUrl) return url
        const apiUrl = new URL(runtimeApiBaseUrl)
        if (/^(localhost|127\.0\.0\.1|::1)$/i.test(parsedUrl.hostname)) {
          parsedUrl.protocol = apiUrl.protocol
          parsedUrl.host = apiUrl.host
        }
        return getProfilePictureProxyUrl(parsedUrl.toString()) || parsedUrl.toString()
      } catch {
        return url
      }
    }
    if (String(url).startsWith('/api/')) {
      try {
        return getProfilePictureProxyUrl(`${new URL(runtimeApiBaseUrl).origin}${url}`) || `${new URL(runtimeApiBaseUrl).origin}${url}`
      } catch {
        return url
      }
    }
    if (String(url).startsWith('/')) {
      return runtimeApiBaseUrl ? `${runtimeApiBaseUrl}${url}` : '/loginbg.png'
    }
    if (!runtimeApiBaseUrl) return '/loginbg.png'
    return `${runtimeApiBaseUrl}/storage/${String(url).replace(/^\/+/, '')}`
  }

  // Fallback: construct URL from path if URL is not available
  const path = tenant.profilePicturePath || tenant.profile_picture_path
  if (path) {
    if (/^https?:\/\//i.test(path)) return path
    return `/api/profile-picture/${String(path).replace(/^\/+/, '').replace(/^storage\//, '')}`
  }

  return null
}

const FIXED_BUSINESS_ADDRESS = 'Pier 2, Zone 4, Bulan Sorsogon'
const TENANT_API_PAGE_SIZE = 100

const formatBusinessPermitNumber = (value: string) => {
  const digitsOnly = value.replace(/\D/g, '').slice(0, 12)
  return digitsOnly.match(/.{1,4}/g)?.join('-') || ''
}

export default function TenantsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [tenants, setTenants] = useState<any[]>([])
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [qrModalTenant, setQrModalTenant] = useState<TenantQRRecord | null>(null)
  const [qrModalCode, setQrModalCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [createdQrAccessCode, setCreatedQrAccessCode] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    email: '',
    contactNumber: '',
    address: '',
    businessName: '',
    businessAddress: FIXED_BUSINESS_ADDRESS,
    businessPermitNumber: '',
    profilePicture: null as File | null,
  })

  useEffect(() => {
    fetchTenants()
  }, [])

  const fetchTenants = async () => {
    try {
      const tenantList: any[] = []
      let page = 1

      while (true) {
        const response = await apiClient.getTenants({ per_page: TENANT_API_PAGE_SIZE, page })
        const pageData = response.data?.data ?? response.data

        if (Array.isArray(pageData)) {
          tenantList.push(...pageData)
          break
        }

        if (!Array.isArray(pageData?.data)) {
          throw new Error('The server returned an invalid tenant list.')
        }

        tenantList.push(...pageData.data)

        const lastPage = Number(pageData.lastPage ?? pageData.last_page)
        if (Number.isFinite(lastPage) && lastPage > 0) {
          if (page >= lastPage) break
        } else if (pageData.data.length < TENANT_API_PAGE_SIZE) {
          break
        }

        page += 1
      }

      setTenants(tenantList)
      setCurrentPage(1)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load tenants')
      setTenants([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name } = e.target
    
    // Handle file input separately
    if (e.target instanceof HTMLInputElement && e.target.type === 'file') {
      setFormData((prev) => ({ 
        ...prev, 
        [name]: (e.target as HTMLInputElement).files?.[0] || null 
      }))
    } else {
      const rawValue = e.target.value
      const value = name === 'contactNumber'
        ? rawValue.replace(/\D/g, '').slice(0, 11)
        : name === 'businessPermitNumber'
          ? formatBusinessPermitNumber(rawValue)
          : name === 'businessAddress'
            ? FIXED_BUSINESS_ADDRESS
            : rawValue
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSuccessMessage(null)
    setCreatedQrAccessCode(null)

    const requiredFields = {
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email Address',
      contactNumber: 'Contact Number',
      address: 'Residential Address',
      businessName: 'Business Name',
      businessAddress: 'Business Address',
      businessPermitNumber: 'Business Permit Number',
    }
    const missingFields = Object.entries(requiredFields)
      .filter(([key]) => !String(formData[key as keyof typeof formData]).trim())
      .map(([, label]) => label)

    if (missingFields.length > 0) {
      setFormError(`Please fill in the following required fields: ${missingFields.join(', ')}`)
      return
    }

    if (!/^09\d{9}$/.test(formData.contactNumber)) {
      setFormError('Contact number must start with 09 and contain exactly 11 digits.')
      return
    }

    setIsSubmitting(true)

    try {
      const fullName = [formData.firstName, formData.middleName, formData.lastName, formData.suffix].filter(Boolean).join(' ').trim()
      const response = await apiClient.createTenant({
        first_name: formData.firstName,
        middle_name: formData.middleName,
        last_name: formData.lastName,
        email: formData.email,
        contact_number: formData.contactNumber,
        contact_person: fullName,
        address: formData.address,
        business_name: formData.businessName,
        business_address: FIXED_BUSINESS_ADDRESS,
        business_permit_number: formatBusinessPermitNumber(formData.businessPermitNumber),
      })

      // Upload profile picture if provided
      if (formData.profilePicture && response.data?.id) {
        try {
          await apiClient.uploadTenantProfilePicture(String(response.data.id), formData.profilePicture)
        } catch (uploadErr: any) {
          console.error('Failed to upload profile picture:', uploadErr)
          console.log('Upload error details:', uploadErr.message)
        }
      }

      const returnedQrAccessCode = response.data?.temporaryPassword || response.data?.temporary_password
      setCreatedQrAccessCode(returnedQrAccessCode || null)
      setSuccessMessage(
        returnedQrAccessCode
          ? 'Tenant added successfully! Share this one-time login password with the tenant.'
          : 'Tenant added successfully!'
      )
      setTimeout(() => setSuccessMessage(null), 3000)
      setFormData({
        firstName: '',
        middleName: '',
        lastName: '',
        suffix: '',
        email: '',
        contactNumber: '',
        address: '',
        businessName: '',
        businessAddress: FIXED_BUSINESS_ADDRESS,
        businessPermitNumber: '',
        profilePicture: null,
      })

      // Refresh tenants list
      await fetchTenants()

    } catch (err: any) {
      const validationErrors = err.errors && typeof err.errors === 'object'
        ? Object.values(err.errors).flat().join(' ')
        : ''
      const statusMessage = err.status ? ` (HTTP ${err.status})` : ''
      setFormError(validationErrors || `${err.message || 'Failed to create tenant. Please try again.'}${statusMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeModal = () => {
    if (!isSubmitting) {
      setShowModal(false)
      setFormError(null)
      setSuccessMessage(null)
      setCreatedQrAccessCode(null)
      setFormData({
        firstName: '',
        middleName: '',
        lastName: '',
        suffix: '',
        email: '',
        contactNumber: '',
        address: '',
        businessName: '',
        businessAddress: FIXED_BUSINESS_ADDRESS,
        businessPermitNumber: '',
        profilePicture: null,
      })
    }
  }

  const filteredTenants = Array.isArray(tenants) ? tenants.filter((tenant) => {
    const searchLower = searchTerm.trim().toLowerCase()
    const searchableValues = [
      tenant.contactPerson,
      tenant.contact_person,
      tenant.user?.name,
      tenant.user?.email,
      tenant.email,
      tenant.businessName,
      tenant.business_name,
      tenant.tenantCode,
      tenant.tenant_code,
      tenant.contactNumber,
      tenant.contact_number,
      tenant.user?.phone,
    ]
    return searchableValues.some((value) => String(value || '').toLowerCase().includes(searchLower))
  }) : []

  const filteredTenantIds = filteredTenants
    .map((tenant) => tenant.id)
    .filter((id) => id !== null && id !== undefined)
    .map((id) => String(id))

  const paginatedTenants = filteredTenants.slice((currentPage - 1) * 10, currentPage * 10)
  const activeTenantCount = tenants.filter((tenant) => String(tenant.status || 'active').toLowerCase() === 'active').length

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const allFilteredSelected = filteredTenantIds.length > 0 && filteredTenantIds.every((id) => selectedTenantIds.includes(id))

  const toggleTenantSelection = (tenantId: string) => {
    setSelectedTenantIds((prev) =>
      prev.includes(tenantId)
        ? prev.filter((id) => id !== tenantId)
        : [...prev, tenantId]
    )
  }

  const handleToggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedTenantIds((prev) => prev.filter((id) => !filteredTenantIds.includes(id)))
      return
    }

    setSelectedTenantIds((prev) => {
      const unique = new Set(prev)
      filteredTenantIds.forEach((id) => unique.add(id))
      return Array.from(unique)
    })
  }

  const handlePrintSelectedQRCodes = () => {
    if (selectedTenantIds.length === 0) {
      setError('Please select at least one tenant before printing QR codes.')
      return
    }

    setError(null)
    const params = new URLSearchParams({
      tenantIds: selectedTenantIds.join(','),
    })
    router.push(`/dashboard/tenants/qr-print?${params.toString()}`)
  }

  const handleShowTenantQR = async (tenant: TenantQRRecord) => {
    setQrModalTenant(tenant)
    setQrModalCode('')

    try {
      let qrOrigin = window.location.origin
      if (['localhost', '127.0.0.1', '::1'].includes(window.location.hostname.toLowerCase())) {
        try {
          const response = await fetch('/api/network-ip', { cache: 'no-store' })
          const payload = (await response.json()) as { ipAddress?: string }
          if (response.ok && payload.ipAddress) {
            qrOrigin = `${window.location.protocol}//${payload.ipAddress}${window.location.port ? `:${window.location.port}` : ''}`
          }
        } catch {
          // Keep the current origin if the local network address cannot be resolved.
        }
      }

      const qrTargetUrl = `${qrOrigin}/tenant-scan/${encodeURIComponent(tenant.id)}`
      const qrCode = await QRCode.toDataURL(qrTargetUrl, {
        width: 420,
        margin: 1,
        errorCorrectionLevel: 'M',
      })
      setQrModalCode(qrCode)
    } catch (qrError) {
      console.error('Failed to generate tenant QR code:', qrError)
      setQrModalTenant(null)
      setError('Failed to generate tenant QR code.')
    }
  }

  const closeQrModal = () => {
    setQrModalTenant(null)
    setQrModalCode('')
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6 pb-8">
        <header className="relative overflow-hidden rounded-3xl bg-[linear-gradient(118deg,#102f36_0%,#0b5963_58%,#12817f_100%)] p-5 text-white shadow-[0_18px_42px_rgba(13,76,83,0.14)] sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-40 right-28 h-72 w-72 rounded-full border border-white/10" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-100/80">Tenant directory</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Tenants</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Manage tenant profiles, business information, and access QR codes.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePrintSelectedQRCodes}
                  disabled={selectedTenantIds.length === 0}
                  title="Print Selected QR Codes"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Printer className="h-4 w-4" />
                  Print selected QR{selectedTenantIds.length > 0 ? ` (${selectedTenantIds.length})` : ''}
                </button>
                {user?.role?.toUpperCase() === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    title="Add Tenant"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-teal-900 shadow-sm transition hover:bg-teal-50"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add tenant
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[280px]">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/70"><Users className="h-3.5 w-3.5" /> Total tenants</span>
                <p className="mt-2 text-3xl font-bold tabular-nums">{tenants.length}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/70"><UserRound className="h-3.5 w-3.5" /> Active</span>
                <p className="mt-2 text-3xl font-bold tabular-nums">{activeTenantCount}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Error Message */}
        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Tenant search and selection">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search tenants"
                placeholder="Search by tenant name, business, email, or code"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-50"
              />
            </div>
            <button
              type="button"
              onClick={handleToggleSelectAllFiltered}
              disabled={filteredTenantIds.length === 0}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Users className="h-4 w-4" />
              {allFilteredSelected ? 'Clear filtered selection' : 'Select filtered'}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs">
            <p className="text-slate-500">Showing <span className="font-bold text-slate-800">{filteredTenants.length}</span> matching tenant{filteredTenants.length === 1 ? '' : 's'}</p>
            <p className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 font-semibold text-teal-800"><QrCode className="h-3.5 w-3.5" aria-hidden="true" />{selectedTenantIds.length} selected for QR printing</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Tenant directory results">
          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center">
              <div className="text-center">
                <div className="loading-spinner mx-auto" aria-hidden="true" />
                <p className="mt-4 text-sm font-medium text-slate-600">Loading tenant directory…</p>
              </div>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Users className="h-6 w-6" /></span>
              <p className="mt-4 text-sm font-semibold text-slate-800">No tenants found</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">{searchTerm ? 'Try a different search term or clear your search.' : 'New tenant records will appear here.'}</p>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(240px,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(100px,0.6fr)_minmax(230px,1.2fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 xl:grid">
                <span>Tenant / business</span><span>Email</span><span>Phone</span><span>Status</span><span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-slate-100">
                {paginatedTenants.map((tenant) => {
                  const profilePictureUrl = getProfilePictureUrl(tenant)
                  const tenantName = tenant.contactPerson || tenant.contact_person || tenant.user?.name || 'Unnamed tenant'
                  const businessName = tenant.businessName || tenant.business_name
                  const email = tenant.user?.email || tenant.email
                  const phone = tenant.contactNumber || tenant.contact_number || tenant.user?.phone
                  const isActive = String(tenant.status || 'active').toLowerCase() === 'active'
                  const isSelected = selectedTenantIds.includes(String(tenant.id))

                  return (
                    <article key={tenant.id} className={`group grid gap-4 px-4 py-4 transition sm:px-5 xl:grid-cols-[minmax(240px,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(100px,0.6fr)_minmax(230px,1.2fr)] xl:items-center ${isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50/80'}`}>
                      <div className="flex min-w-0 items-center gap-3">
                        <label className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-teal-100/70" aria-label={`Select ${tenantName} for QR printing`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTenantSelection(String(tenant.id))}
                            className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-2 focus:ring-teal-600 focus:ring-offset-1"
                          />
                        </label>
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-teal-50 text-base font-bold text-teal-800">
                          <span>{tenantName[0]?.toUpperCase() || '?'}</span>
                          {profilePictureUrl && <img
                            src={`${profilePictureUrl}${profilePictureUrl.includes('?') ? '&' : '?'}t=${Date.now()}`}
                            alt={tenantName}
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(event) => { event.currentTarget.style.display = 'none' }}
                          />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-slate-900">{tenantName}</h3>
                            <span className={`hidden shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold capitalize sm:inline-flex xl:hidden ${isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{tenant.status || 'Active'}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs font-medium text-slate-600">{businessName || 'Business name not provided'}</p>
                          <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            <Building2 className="h-3 w-3" />{tenant.tenantCode || tenant.tenant_code || `Tenant #${tenant.id}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex min-w-0 items-center gap-2 pl-[3.25rem] xl:pl-0">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        {email ? <a href={`mailto:${email}`} className="truncate text-xs font-medium text-slate-600 hover:text-teal-800 hover:underline">{email}</a> : <span className="text-xs text-slate-400">Email not provided</span>}
                      </div>

                      <div className="flex min-w-0 items-center gap-2 pl-[3.25rem] xl:pl-0">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        {phone ? <a href={`tel:${phone}`} className="truncate text-xs font-medium text-slate-600 hover:text-teal-800 hover:underline">{phone}</a> : <span className="text-xs text-slate-400">Phone not provided</span>}
                      </div>

                      <div className="hidden xl:block">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{tenant.status || 'Active'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 border-t border-slate-100 pt-3 pl-[3.25rem] xl:justify-end xl:border-0 xl:pt-0 xl:pl-0">
                        <button
                          type="button"
                          onClick={() => handleShowTenantQR(tenant)}
                          title="Show tenant QR code"
                          aria-label={`Show QR code for ${tenantName}`}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                        >
                          <QrCode className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <Link href={`/dashboard/tenants/${tenant.id}`} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-teal-800 px-3 text-xs font-bold text-white transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 sm:flex-none">
                          Profile<ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                        <Link href={`/dashboard/contracts?tenantId=${tenant.id}`} className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 sm:flex-none">Contracts</Link>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </section>

        {!isLoading && filteredTenants.length > 0 && (
                    <Pagination currentPage={currentPage} totalItems={filteredTenants.length} onPageChange={setCurrentPage} />
                  )}

      </div>

      {qrModalTenant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#28334b]/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tenant-qr-modal-title"
          onClick={closeQrModal}
        >
          <div
            className="modal-shell w-full max-w-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header flex items-center justify-between">
              <div>
                <h3 id="tenant-qr-modal-title" className="text-xl font-bold text-gray-900">Tenant QR Code</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {qrModalTenant.businessName || qrModalTenant.business_name || qrModalTenant.contactPerson || qrModalTenant.contact_person || qrModalTenant.user?.name || 'Tenant'}
                </p>
              </div>
            </div>
            <div className="modal-body flex min-h-80 items-center justify-center">
              {qrModalCode ? (
                <img
                  src={qrModalCode}
                  alt="Tenant QR Code"
                  className="h-auto w-full max-w-xs object-contain"
                />
              ) : (
                <div className="text-center text-sm text-gray-500">
                  <div className="loading-spinner mx-auto" aria-hidden="true" />
                  <p className="mt-3">Generating QR code...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Tenant Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 z-40 bg-[#28334b]/35 backdrop-blur-sm" onClick={closeModal} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="modal-shell max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="modal-header sticky top-0 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Add New Tenant</h3>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSubmit} className="modal-body space-y-6">
              {/* Success Message */}
              {successMessage && (
                <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">✅</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-700">{successMessage}</p>
                      {createdQrAccessCode && (
                        <div className="mt-3 rounded-lg border border-green-200 bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">One-time login & QR password</p>
                          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.25em] text-gray-900">{createdQrAccessCode}</p>
                          <p className="mt-1 text-xs text-gray-500">This same 8-digit password works for login and QR scans. Share it now; it will not be available later.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {formError && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{formError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Personal Information Section */}
              <div className="form-section">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="John"
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Middle Name / Initial
                    </label>
                    <input
                      type="text"
                      name="middleName"
                      value={formData.middleName}
                      onChange={handleChange}
                      placeholder="A."
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Doe"
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Suffix</label>
                    <select
                      name="suffix"
                      value={formData.suffix}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    >
                      <option value="">None</option>
                      <option value="Jr.">Jr.</option>
                      <option value="Sr.">Sr.</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                      <option value="IV">IV</option>
                      <option value="V">V</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="form-section">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="john@example.com"
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleChange}
                      placeholder="09123456789"
                      maxLength={11}
                      pattern="09[0-9]{9}"
                      inputMode="numeric"
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                    <p className="mt-1 text-xs text-gray-500">Enter 11 digits starting with 09.</p>
                  </div>
                </div>
              </div>

              {/* Address Information Section */}
              <div className="form-section">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Address Information</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Residential Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Street, City, Province, Postal Code"
                      rows={3}
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Business Information Section */}
              <div className="form-section">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      placeholder="Your Business Name"
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Permit Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="businessPermitNumber"
                      value={formData.businessPermitNumber}
                      onChange={handleChange}
                      placeholder="1234-5678-9012"
                      required
                      inputMode="numeric"
                      maxLength={14}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="businessAddress"
                      value={formData.businessAddress}
                      onChange={handleChange}
                      placeholder="Pier 2, Zone 4, Bulan Sorsogon"
                      rows={3}
                      required
                      readOnly
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-gray-50 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Profile Picture Section */}
              <div className="form-section">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture (Optional)</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Photo
                    </label>
                    <input
                      type="file"
                      name="profilePicture"
                      accept="image/*"
                      onChange={handleChange}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional. Accepts all image formats. Max file size: 50MB</p>
                    {formData.profilePicture && (
                      <p className="text-xs text-green-600 mt-1">✓ File selected: {formData.profilePicture.name}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  title="Cancel"
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  title="Create Tenant"
                  className="flex items-center justify-center rounded-md bg-[#5148e5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4038c7] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creating...' : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </>
      )}

    </ProtectedRoute>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient, { resolveApiBaseUrl } from '@/lib/api-client'
import { User, Contract } from '@/types'
import { Building2, CalendarDays, FileText, KeyRound, Pencil, Wallet } from 'lucide-react'
import { formatCalendarDate } from '@/lib/date-format'
import { statusColorClass } from '@/lib/status-colors'
import { useAuth } from '@/contexts/AuthContext'

const FIXED_BUSINESS_ADDRESS = 'Pier 2, Zone 4, Bulan Sorsogon'

const formatBusinessPermitNumber = (value: string) => {
  const digitsOnly = value.replace(/\D/g, '').slice(0, 12)
  return digitsOnly.match(/.{1,4}/g)?.join('-') || ''
}

export default function TenantDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const tenantId = parseInt(params.id as string)

  const [tenant, setTenant] = useState<any | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profilePictureFailed, setProfilePictureFailed] = useState(false)
  const [showQrAccessCode, setShowQrAccessCode] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [passwordResetError, setPasswordResetError] = useState<string | null>(null)
  const [passwordResetMessage, setPasswordResetMessage] = useState<string | null>(null)

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    email: '',
    contactNumber: '',
    address: '',
    status: 'active',
    businessName: '',
    businessAddress: FIXED_BUSINESS_ADDRESS,
    businessPermitNumber: '',
    profilePicture: null as File | null,
  })

  useEffect(() => {
    fetchTenantData()
  }, [tenantId])

  const fetchTenantData = async () => {
    try {
      const response = await apiClient.getTenant(tenantId.toString())
      const tenantData = response.data || response

      if (!tenantData || !tenantData.id) {
        throw new Error('Invalid tenant data or not found')
      }

      const fullName = tenantData.contactPerson || tenantData.contact_person || tenantData.user?.name || tenantData.name || ''
      const nameParts = fullName.trim().split(/\s+/)
      const suffixOptions = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V']
      const existingSuffix = suffixOptions.find((option) => option.toLowerCase() === nameParts[nameParts.length - 1]?.toLowerCase())
      const suffix = tenantData.suffix || tenantData.user?.suffix || existingSuffix || ''
      if (existingSuffix && !tenantData.suffix && !tenantData.user?.suffix) nameParts.pop()
      const firstName = nameParts[0] || ''
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] || '' : ''

      const mappedTenant: any = {
        id: tenantData.id,
        name: fullName,
        firstName: firstName,
        middleName: tenantData.middleName || tenantData.middle_name || middleName,
        lastName: lastName,
        suffix,
        email: tenantData.email || tenantData.user?.email || '',
        phone: tenantData.phone || tenantData.contactNumber || tenantData.contact_number || tenantData.user?.phone || '',
        contactNumber: tenantData.contactNumber || tenantData.contact_number || tenantData.user?.phone || '',
        address: tenantData.address || tenantData.user?.address || '',
        role: tenantData.role || tenantData.user?.role || 'TENANT',
        businessName: tenantData.businessName || tenantData.business_name || '',
        businessAddress: tenantData.businessAddress || tenantData.business_address || FIXED_BUSINESS_ADDRESS,
        contactPerson: tenantData.contactPerson || tenantData.contact_person || '',
        businessPermitNumber: formatBusinessPermitNumber(tenantData.businessPermitNumber || tenantData.business_permit_number || tenantData.tin || ''),
        tenantCode: tenantData.tenantCode || tenantData.tenant_code || '',
        status: (tenantData.status || tenantData.status || 'active'),
        // FIX: apiClient converts snake_case to camelCase, so profile_picture_url becomes profilePictureUrl
        profilePictureUrl: tenantData.profilePictureUrl || tenantData.profilePicture_url || tenantData.user?.profilePictureUrl || tenantData.user?.profile_picture_url,
        profilePicturePath: tenantData.profilePicturePath || tenantData.profile_picture_path || tenantData.user?.profilePicturePath || tenantData.user?.profile_picture_path,
        profilePicture: tenantData.profilePictureUrl || tenantData.profilePicture || tenantData.profilePicture_url || tenantData.user?.profilePictureUrl || tenantData.user?.profile_picture_url,
        profile_picture: tenantData.profilePictureUrl || tenantData.profilePicture || tenantData.profile_picture || tenantData.user?.profilePictureUrl || tenantData.user?.profile_picture,
        contact_person: tenantData.contact_person || tenantData.contactPerson || '',
        business_name: tenantData.business_name || tenantData.businessName || '',
        business_address: tenantData.business_address || tenantData.businessAddress || FIXED_BUSINESS_ADDRESS,
        tenant_code: tenantData.tenant_code || tenantData.tenantCode || '',
        qrAccessCode: tenantData.qrAccessCode || tenantData.qr_access_code || tenantData.qrPassword || tenantData.qr_password || tenantData.accessCode || tenantData.access_code || '',
        user: tenantData.user,
        createdAt: tenantData.createdAt || tenantData.created_at,
      }

      setTenant(mappedTenant)
      setProfilePictureFailed(false)

      let contractsList = []
      if (tenantData.contracts && Array.isArray(tenantData.contracts)) {
        contractsList = tenantData.contracts.map((contract: any) => ({
          ...contract,
          contract_number: contract.contract_number || contract.contractNumber,
          contractNumber: contract.contractNumber || contract.contract_number,
          start_date: contract.start_date || contract.startDate,
          startDate: contract.startDate || contract.start_date,
          end_date: contract.end_date || contract.endDate,
          endDate: contract.endDate || contract.end_date,
          monthly_rental: contract.monthly_rental || contract.monthlyRental,
          monthlyRental: contract.monthlyRental || contract.monthly_rental,
          monthlyRent: contract.monthlyRental || contract.monthly_rental,
        }))
      }
      setContracts(contractsList)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load tenant data')
    } finally {
      setIsLoading(false)
    }
  }

  const resetSharedPassword = async () => {
    if (!tenant || !window.confirm('Reset this tenant password? The new password will be used for both login and QR access, and their current sessions will end.')) return

    setIsResettingPassword(true)
    setPasswordResetError(null)
    setPasswordResetMessage(null)
    try {
      const response = await apiClient.resetTenantPassword(String(tenant.id))
      const password = response.temporaryPassword || response.temporary_password || response.qrAccessCode || response.qr_access_code
      if (!password) throw new Error('The server did not return the new password.')

      setTenant((current: any) => ({ ...current, qrAccessCode: String(password), qr_access_code: String(password) }))
      setShowQrAccessCode(true)
      setPasswordResetMessage('The shared login and QR password was updated. Give this value to the tenant now.')
    } catch (resetError) {
      setPasswordResetError(resetError instanceof Error ? resetError.message : 'Unable to reset the tenant password.')
    } finally {
      setIsResettingPassword(false)
    }
  }

  const openEditModal = async () => {
    if (!tenant) return
    setEditFormData({
      firstName: tenant.firstName,
      middleName: tenant.middleName || '',
      lastName: tenant.lastName,
      suffix: tenant.suffix || '',
      email: tenant.email,
      contactNumber: tenant.contactNumber,
      address: tenant.address,
      status: String(tenant.status || 'active').toLowerCase(),
      businessName: tenant.businessName,
      businessAddress: tenant.businessAddress || FIXED_BUSINESS_ADDRESS,
      businessPermitNumber: tenant.businessPermitNumber,
      profilePicture: null,
    })
    setEditError(null)
    setEditSuccess(null)
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    if (!isSubmitting) {
      setShowEditModal(false)
      setEditError(null)
      setEditSuccess(null)
    }
  }

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name } = e.target

    if (e.target instanceof HTMLInputElement && e.target.type === 'file') {
      setEditFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).files?.[0] || null,
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
      setEditFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setEditError(null)
    setEditSuccess(null)

    try {
      const contactPerson = [editFormData.firstName, editFormData.middleName, editFormData.lastName, editFormData.suffix].filter(Boolean).join(' ').trim()
      const updatePayload = {
        first_name: editFormData.firstName,
        middle_name: editFormData.middleName,
        last_name: editFormData.lastName,
        suffix: editFormData.suffix,
        email: editFormData.email,
        contact_number: editFormData.contactNumber,
        address: editFormData.address,
        status: editFormData.status,
        contact_person: contactPerson,
        business_name: editFormData.businessName,
        business_address: FIXED_BUSINESS_ADDRESS,
        business_permit_number: formatBusinessPermitNumber(editFormData.businessPermitNumber),
      }

      await apiClient.updateTenant(tenantId.toString(), updatePayload)

      if (editFormData.profilePicture) {
        await apiClient.uploadTenantProfilePicture(tenantId.toString(), editFormData.profilePicture)
      }

      await fetchTenantData()
      setTenant((current: any) => ({
        ...current,
        name: contactPerson,
        firstName: editFormData.firstName,
        middleName: editFormData.middleName,
        lastName: editFormData.lastName,
        suffix: editFormData.suffix,
        email: editFormData.email,
        phone: editFormData.contactNumber,
        contactNumber: editFormData.contactNumber,
        address: editFormData.address,
        status: editFormData.status,
        businessName: editFormData.businessName,
        businessAddress: FIXED_BUSINESS_ADDRESS,
        contactPerson,
        businessPermitNumber: formatBusinessPermitNumber(editFormData.businessPermitNumber),
        contact_person: contactPerson,
        business_name: editFormData.businessName,
        business_address: FIXED_BUSINESS_ADDRESS,
        business_permit_number: formatBusinessPermitNumber(editFormData.businessPermitNumber),
      }))
      setShowEditModal(false)
      setEditSuccess(null)
    } catch (err: any) {
      setEditError(err.message || 'Failed to update tenant')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getProfilePictureUrl = () => {
    // Use the URL returned by the backend (already fully resolved)
    const url = tenant?.profilePictureUrl || tenant?.profilePicture || tenant?.profile_picture || tenant?.profile_picture_url
    if (url) {
      // Backend already returns full URL, just use it directly with cache busting
      console.log('Profile picture URL found:', url)
      let resolvedUrl = String(url)
      if (/^https?:\/\//i.test(resolvedUrl)) {
        const parsedUrl = new URL(resolvedUrl)
        const apiUrl = new URL(resolveApiBaseUrl())
        if (/^(localhost|127\.0\.0\.1|::1)$/i.test(parsedUrl.hostname)) {
          parsedUrl.protocol = apiUrl.protocol
          parsedUrl.host = apiUrl.host
        }
        resolvedUrl = parsedUrl.toString()
      } else {
        const apiUrl = resolveApiBaseUrl()
        resolvedUrl = resolvedUrl.startsWith('/api/')
          ? `${new URL(apiUrl).origin}${resolvedUrl}`
          : `${apiUrl.replace(/\/$/, '')}${resolvedUrl.startsWith('/') ? resolvedUrl : `/storage/${resolvedUrl.replace(/^\/+/, '')}`}`
      }
      const storageMarker = '/api/storage/'
      const storageIndex = resolvedUrl.indexOf(storageMarker)
      if (storageIndex !== -1) {
        resolvedUrl = `/api/profile-picture/${resolvedUrl.slice(storageIndex + storageMarker.length)}`
      }
      return `${resolvedUrl}${resolvedUrl.includes('?') ? '&' : '?'}t=${Date.now()}`
    }

    // Fallback: construct URL from path if URL is not available
    const path = tenant?.profilePicturePath || tenant?.profile_picture_path
    if (path) {
      const constructedUrl = `/api/profile-picture/${String(path).replace(/^\/+/, '').replace(/^storage\//, '')}`
      console.log('Constructed profile picture URL from path:', constructedUrl)
      return constructedUrl
    }

    console.log('No profile picture URL found in tenant:', { 
      profilePicture: tenant?.profilePicture, 
      profilePictureUrl: tenant?.profilePictureUrl,
      profile_picture: tenant?.profile_picture 
    })
    return null
  }

  const getStatusBadge = (status: string) => {
    return statusColorClass(status)
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="loading-spinner" aria-hidden="true" />
            <p className="mt-4 text-gray-600">Loading tenant details...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error || !tenant) {
    return (
      <ProtectedRoute>
        <div className="space-y-6">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-sm text-red-700">{error || 'Tenant not found'}</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/tenants')}
            className="back-action"
          >
            Back to Tenants
          </button>
        </div>
      </ProtectedRoute>
    )
  }

  const profilePictureUrl = getProfilePictureUrl()
  const qrAccessCode = tenant.qrAccessCode || tenant.qr_access_code || ''
  const activeContracts = contracts.filter((contract) => ['active', 'for_renewal', 'renewed', 'pending'].includes(String(contract.status || '').toLowerCase()))
  const monthlyRentTotal = activeContracts.reduce((sum, contract) => sum + Number(contract.monthlyRent || contract.monthlyRental || contract.monthly_rental || 0), 0)
  const memberSince = tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <button onClick={() => router.push('/dashboard/tenants')} className="transition hover:text-teal-800">Tenants</button>
            <span aria-hidden="true">/</span>
            <span className="text-slate-800">Tenant profile</span>
          </div>
          <button type="button" onClick={openEditModal} title="Edit Tenant" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800">
            <Pencil className="h-4 w-4" aria-hidden="true" /> Edit profile
          </button>
        </div>

        {/* Tenant Information */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-white px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-xl font-bold text-slate-700 sm:h-[72px] sm:w-[72px]">
                {profilePictureUrl && !profilePictureFailed ? (
                  <img
                    key={profilePictureUrl}
                    src={profilePictureUrl}
                    alt={tenant.firstName || 'Tenant'}
                    className="h-full w-full object-cover"
                    onError={() => setProfilePictureFailed(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    {tenant.firstName?.[0]}{tenant.lastName?.[0]}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{tenant.firstName} {tenant.middleName ? `${tenant.middleName} ` : ''}{tenant.lastName} {tenant.suffix}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${getStatusBadge(tenant.status)}`}>{tenant.status || 'ACTIVE'}</span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-600">{tenant.businessName || 'Business name not provided'}</p>
                <p className="mt-2 font-mono text-[10px] font-semibold tracking-[0.12em] text-slate-500">TENANT ID · {tenant.tenantCode || tenant.tenant_code || `ID-${tenant.id}`}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600"><CalendarDays className="h-3.5 w-3.5 text-slate-400" /> Member since {memberSince}</span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600"><FileText className="h-3.5 w-3.5 text-slate-400" /> {contracts.length} contract{contracts.length === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:p-6">
            <div className="min-w-0">
              <div className="mb-4 border-b border-slate-100 pb-3">
                <h4 className="text-base font-bold text-slate-900">Personal information</h4>
                <p className="mt-1 text-xs text-slate-500">Contact and account details</p>
              </div>
              <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <div className="border-b border-slate-100 py-3">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Full Name
                  </label>
                  <p className="break-words text-sm font-semibold text-slate-900">
                    {tenant.firstName} {tenant.middleName ? `${tenant.middleName} ` : ''}{tenant.lastName} {tenant.suffix}
                  </p>
                </div>

                <div className="border-b border-slate-100 py-3">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Email Address
                  </label>
                  <p className="break-words text-sm font-semibold text-slate-900">{tenant.email || 'N/A'}</p>
                </div>

                <div className="border-b border-slate-100 py-3">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Phone Number
                  </label>
                  <p className="break-words text-sm font-semibold text-slate-900">{tenant.contactNumber || 'N/A'}</p>
                </div>

                <div className="border-b border-slate-100 py-3">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Role
                  </label>
                  <p className="break-words text-sm font-semibold capitalize text-slate-900">{tenant.role || 'Tenant'}</p>
                </div>

                <div className="border-b border-slate-100 py-3 sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Address
                  </label>
                  <p className="break-words text-sm font-semibold text-slate-900">{tenant.address || 'N/A'}</p>
                </div>

                <div className="py-3">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Member Since
                  </label>
                  <p className="text-sm font-semibold text-slate-900">
                    {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <aside className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-800"><KeyRound className="h-4 w-4" aria-hidden="true" /></span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Login & QR password</h4>
                  <p className="text-[11px] text-slate-500">Shared tenant credential</p>
                </div>
              </div>
              {user?.role?.toUpperCase() === 'ADMIN' ? <>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type={showQrAccessCode ? 'text' : 'password'}
                    value={qrAccessCode || 'Not set'}
                    readOnly
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm font-semibold tracking-[0.15em] text-slate-800"
                    aria-label="Tenant shared login and QR password"
                  />
                  <button type="button" onClick={() => setShowQrAccessCode((visible) => !visible)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">{showQrAccessCode ? 'Hide' : 'Show'}</button>
                </div>
                {passwordResetError && <p className="mt-3 text-xs text-red-700" role="alert">{passwordResetError}</p>}
                {passwordResetMessage && <p className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800" role="status">{passwordResetMessage}</p>}
                <button type="button" onClick={() => void resetSharedPassword()} disabled={isResettingPassword} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60">
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />{isResettingPassword ? 'Resetting…' : 'Reset shared password'}
                </button>
                <p className="mt-2 text-[10px] leading-4 text-slate-500">Resetting changes the tenant’s login and QR password together and signs out existing sessions.</p>
              </> : <p className="mt-3 text-xs text-slate-500">Credential management is available to administrators.</p>}
            </aside>
          </div>
        </section>

        <section aria-label="Tenant summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total contracts</p><span className="rounded-lg bg-slate-100 p-2 text-slate-600"><FileText className="h-4 w-4" /></span></div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{contracts.length}</p>
            <p className="mt-1 text-xs text-slate-500">{activeContracts.length} active or in progress</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned spaces</p><span className="rounded-lg bg-slate-100 p-2 text-slate-600"><Building2 className="h-4 w-4" /></span></div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{new Set(contracts.map((contract) => String(contract.rentalSpaceId || contract.rental_space_id || contract.rentalSpace?.id || contract.rental_space?.id || '')).filter(Boolean)).size}</p>
            <p className="mt-1 text-xs text-slate-500">Linked rental units</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly rent</p><span className="rounded-lg bg-slate-100 p-2 text-slate-600"><Wallet className="h-4 w-4" /></span></div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">₱{monthlyRentTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="mt-1 text-xs text-slate-500">From active tenant contracts</p>
          </div>
        </section>

        {/* Business Information */}
        {(tenant.businessName || tenant.businessAddress || tenant.businessPermitNumber) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">Organization profile</p>
            <h3 className="mb-5 mt-1 text-lg font-bold text-slate-900">Business Information</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Business Name
                </label>
                <p className="break-words text-sm font-semibold text-slate-900">{tenant.businessName || 'N/A'}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Business Address
                </label>
                <p className="break-words text-sm font-semibold text-slate-900">{tenant.businessAddress || 'N/A'}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Business Permit Number
                </label>
                <p className="break-words text-sm font-semibold text-slate-900">{tenant.businessPermitNumber || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {contracts.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Stall Blueprint</h3>
                <p className="text-sm text-slate-500">Schematic location of this tenant&apos;s contracted stalls</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-blue-600" />Active</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-slate-200" />Other</span>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-5">
              <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>Fish Port Stall Layout</span>
                <span>{contracts.length} assigned</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {contracts.map((contract: any, index: number) => {
                  const space = contract.rentalSpace || contract.rental_space || {}
                  const spaceLabel = space.spaceCode || space.space_code || space.unit_number || space.name || `Stall ${index + 1}`
                  const isActive = String(contract.status || '').toLowerCase() === 'active'

                  return (
                    <div
                      key={`blueprint-${contract.id || index}`}
                      className={`relative min-h-24 rounded-xl border p-3 transition ${isActive ? 'border-teal-700 bg-teal-700 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700'}`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-75">Bay {index + 1}</span>
                      <p className="mt-2 break-words text-sm font-bold">{spaceLabel}</p>
                      {space.name && space.name !== spaceLabel && <p className="mt-1 truncate text-[10px] opacity-75">{space.name}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Contracts Section */}
        {contracts.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="mb-4 text-lg font-bold text-slate-900">Contracts ({contracts.length})</h3>
            <div className="grid grid-cols-1 gap-4">
              {contracts.map((contract: any) => (
                <Link
                  key={contract.id}
                  href={`/dashboard/contracts/${contract.id}`}
                  className="group block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-teal-200 hover:bg-teal-50/40"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">{contract.contractNumber || contract.contract_number}</p>
                      <p className="text-sm text-gray-600">
                        {formatCalendarDate(contract.startDate)} - {formatCalendarDate(contract.endDate)}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusBadge(contract.status || 'pending')}`}>
                      {(contract.status || 'PENDING').toUpperCase().replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Tenant Modal */}
      {showEditModal && (
        <>
          <div className="fixed inset-0 z-40 bg-[#28334b]/35 backdrop-blur-sm" onClick={closeEditModal} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="modal-shell max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="modal-header sticky top-0 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Edit Tenant</h3>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleEditSubmit} className="modal-body space-y-6">
              {/* Success Message */}
              {editSuccess && (
                <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
                  <p className="text-sm text-green-700">{editSuccess}</p>
                </div>
              )}

              {/* Error Message */}
              {editError && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                  <p className="text-sm text-red-700">❌ {editError}</p>
                </div>
              )}

              {/* Personal Information Section */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={editFormData.firstName}
                      onChange={handleEditFormChange}
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
                      value={editFormData.middleName}
                      onChange={handleEditFormChange}
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
                      value={editFormData.lastName}
                      onChange={handleEditFormChange}
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Suffix</label>
                    <select
                      name="suffix"
                      value={editFormData.suffix}
                      onChange={handleEditFormChange}
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
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={editFormData.email}
                      onChange={handleEditFormChange}
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Number
                    </label>
                    <input
                      type="tel"
                      name="contactNumber"
                      value={editFormData.contactNumber}
                      onChange={handleEditFormChange}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tenant Status
                    </label>
                    <select
                      name="status"
                      value={editFormData.status}
                      onChange={handleEditFormChange}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="blacklisted">Blacklisted</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Address Information Section */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Address Information</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Residential Address
                    </label>
                    <textarea
                      name="address"
                      value={editFormData.address}
                      onChange={handleEditFormChange}
                      rows={3}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Business Information Section */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Name
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      value={editFormData.businessName}
                      onChange={handleEditFormChange}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Address
                    </label>
                    <textarea
                      name="businessAddress"
                      value={editFormData.businessAddress}
                      onChange={handleEditFormChange}
                      rows={3}
                      readOnly
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-gray-50 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Permit Number
                    </label>
                    <input
                      type="text"
                      name="businessPermitNumber"
                      value={editFormData.businessPermitNumber}
                      onChange={handleEditFormChange}
                      placeholder="1234-5678-9012"
                      inputMode="numeric"
                      maxLength={14}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Profile Picture Section */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload New Photo (Optional)
                  </label>
                  <input
                    type="file"
                    name="profilePicture"
                    onChange={handleEditFormChange}
                    accept="image/*"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG or GIF (max. 5MB)</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isSubmitting}
                  className="action-secondary rounded-lg border px-4 py-2 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="action-primary rounded-lg border px-4 py-2 font-medium disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
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

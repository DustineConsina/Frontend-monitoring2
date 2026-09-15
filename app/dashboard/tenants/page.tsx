'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import Pagination from '@/components/Pagination'

type TenantQRRecord = {
  id: string | number
  business_name?: string
  contact_person?: string
  user?: {
    name?: string
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

const getRuntimeApiBaseUrl = () => {
  if (typeof window === 'undefined') return API_BASE_URL

  try {
    const apiUrl = new URL(API_BASE_URL)
    if (/^(localhost|127\.0\.0\.1|::1)$/i.test(apiUrl.hostname) && !/^(localhost|127\.0\.0\.1|::1)$/i.test(window.location.hostname)) {
      apiUrl.hostname = window.location.hostname
    }
    return apiUrl.toString().replace(/\/$/, '')
  } catch {
    return API_BASE_URL
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
      return `${runtimeApiBaseUrl}${url}`
    }
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

export default function TenantsPage() {
  const router = useRouter()
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
    lastName: '',
    email: '',
    contactNumber: '',
    address: '',
    businessName: '',
    businessType: '',
    businessAddress: '',
    businessPermitNumber: '',
    profilePicture: null as File | null,
  })

  useEffect(() => {
    fetchTenants()
  }, [])

  const fetchTenants = async () => {
    try {
      const response = await apiClient.getTenants()
      // Handle paginated response from API - response.data contains pagination info with data.data being the array
      const tenantList = response.data?.data || response.data || []
      setTenants(tenantList)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load tenants')
      setTenants([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name } = e.target
    
    // Handle file input separately
    if (e.target instanceof HTMLInputElement && e.target.type === 'file') {
      setFormData((prev) => ({ 
        ...prev, 
        [name]: (e.target as HTMLInputElement).files?.[0] || null 
      }))
    } else {
      const value = name === 'contactNumber'
        ? e.target.value.replace(/\D/g, '').slice(0, 11)
        : e.target.value
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
      businessType: 'Business Type',
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
      const qrAccessCode = String(Math.floor(10000000 + Math.random() * 90000000))
      const response = await apiClient.createTenant({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        contact_number: formData.contactNumber,
        contact_person: `${formData.firstName} ${formData.lastName}`.trim(),
        address: formData.address,
        business_name: formData.businessName,
        business_type: formData.businessType,
        business_address: formData.businessAddress,
        business_permit_number: formData.businessPermitNumber,
        qr_access_code: qrAccessCode,
        role: 'TENANT',
      })

      // Upload profile picture if provided
      if (formData.profilePicture && response.data?.id) {
        try {
          const profileFormData = new FormData()
          profileFormData.append('profile_picture', formData.profilePicture)
          
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://contractmonitoringbackend-production.up.railway.app/api'
          const pictureResponse = await fetch(`${apiUrl}/tenants/${response.data.id}/upload-picture`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            },
            body: profileFormData,
          })
          
          if (!pictureResponse.ok) {
            const errorData = await pictureResponse.text()
            console.error('Picture upload failed:', errorData)
          }
        } catch (uploadErr: any) {
          console.error('Failed to upload profile picture:', uploadErr)
          console.log('Upload error details:', uploadErr.message)
        }
      }

      const returnedQrAccessCode = response.data?.qrAccessCode
      setCreatedQrAccessCode(returnedQrAccessCode || null)
      setSuccessMessage(
        returnedQrAccessCode
          ? `Tenant added successfully! QR password: ${returnedQrAccessCode}`
          : 'Tenant added successfully!'
      )
      setTimeout(() => setSuccessMessage(null), 3000)
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        contactNumber: '',
        address: '',
        businessName: '',
        businessType: '',
        businessAddress: '',
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
        lastName: '',
        email: '',
        contactNumber: '',
        address: '',
        businessName: '',
        businessType: '',
        businessAddress: '',
        businessPermitNumber: '',
        profilePicture: null,
      })
    }
  }

  const filteredTenants = Array.isArray(tenants) ? tenants.filter((tenant) => {
    const searchLower = searchTerm.toLowerCase()
    const contactPerson = tenant.contact_person || tenant.user?.name || ''
    const email = tenant.user?.email || tenant.email || ''
    const businessName = tenant.business_name || ''
    return (
      contactPerson.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      businessName.toLowerCase().includes(searchLower)
    )
  }) : []

  const filteredTenantIds = filteredTenants
    .map((tenant) => tenant.id)
    .filter((id) => id !== null && id !== undefined)
    .map((id) => String(id))

  const paginatedTenants = filteredTenants.slice((currentPage - 1) * 15, currentPage * 15)

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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Tenants</h2>
            <p className="text-gray-600">Manage tenant information</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handlePrintSelectedQRCodes}
              disabled={selectedTenantIds.length === 0}
              title="Print Selected QR Codes"
              className="action-success inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2"
            >
              Print Selected QR
            </button>
            <button
              onClick={() => setShowModal(true)}
              title="Add Tenant"
              className="action-primary inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2"
            >
              + Add Tenant
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              type="button"
              onClick={handleToggleSelectAllFiltered}
              disabled={filteredTenantIds.length === 0}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {allFilteredSelected ? 'Unselect Filtered' : 'Select Filtered'}
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Selected tenants: <span className="font-semibold text-gray-900">{selectedTenantIds.length}</span>
          </p>
        </div>

        {/* Tenants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center h-64">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 items-center justify-center">
                  <div className="loading-spinner" aria-hidden="true"></div>
                </div>
                <p className="mt-4 text-gray-600 font-medium">Loading tenants...</p>
              </div>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">No tenants found</p>
            </div>
          ) : (
            paginatedTenants.map((tenant) => {
              const profilePictureUrl = getProfilePictureUrl(tenant)

              return (
                <div
                  key={tenant.id}
                  className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow p-6 border-l-4 border-blue-600"
                >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <span className="text-lg font-bold text-white">
                        {tenant.contact_person?.[0]?.toUpperCase() || tenant.user?.name?.[0]?.toUpperCase() || '?'}
                      </span>
                      {profilePictureUrl && (
                        <img
                          src={`${profilePictureUrl}${profilePictureUrl.includes('?') ? '&' : '?'}t=${Date.now()}`}
                          alt={tenant.contact_person || 'Tenant'}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(event) => {
                            console.warn('Tenant profile image could not be loaded:', profilePictureUrl)
                            event.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {tenant.contact_person || tenant.user?.name || 'N/A'}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">{tenant.business_name}</p>
                      <p className="text-xs text-gray-400 mt-1 font-mono">{tenant.tenant_code}</p>
                    </div>
                  </div>
                  {tenant.id !== undefined && tenant.id !== null && (
                    <label className="ml-2 flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedTenantIds.includes(String(tenant.id))}
                        onChange={() => toggleTenantSelection(String(tenant.id))}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Select for QR print
                    </label>
                  )}
                </div>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="text-gray-400">📧</span>
                    <span className="truncate">{tenant.user?.email || 'N/A'}</span>
                  </div>
                  {(tenant.contact_number || tenant.user?.phone) && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="text-gray-400">📱</span>
                      <span>{tenant.contact_number || tenant.user?.phone}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t flex gap-2">
                  <Link
                    href={`/dashboard/tenants/${tenant.id}`}
                    title="View Tenant Details"
                    aria-label="View Tenant Details"
                    className="action-primary flex flex-1 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium"
                  >
                    View Details
                  </Link>
                  <Link
                    href={`/dashboard/contracts?tenantId=${tenant.id}`}
                    className="action-edit flex flex-1 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium"
                  >
                    Contracts
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleShowTenantQR(tenant)}
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-green-600 text-green-600 hover:bg-green-50 transition flex items-center justify-center gap-1"
                  >
                    QR
                  </button>
                </div>
                </div>
              )
            })
          )}
        </div>

        {!isLoading && filteredTenants.length > 0 && (
                    <Pagination currentPage={currentPage} totalItems={filteredTenants.length} onPageChange={setCurrentPage} />
                  )}

                  {!isLoading && filteredTenants.length > 0 && (
          <div className="text-sm text-gray-600">
            Showing {filteredTenants.length} of {tenants.length} tenants
          </div>
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
                  {qrModalTenant.business_name || qrModalTenant.contact_person || qrModalTenant.user?.name || 'Tenant'}
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
                          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">QR Password</p>
                          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.25em] text-gray-900">{createdQrAccessCode}</p>
                          <p className="mt-1 text-xs text-gray-500">Give this 8-digit password to the tenant. It is required after scanning the QR code.</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      Business Type <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="businessType"
                      value={formData.businessType}
                      onChange={handleChange}
                      placeholder="e.g., Retail, Manufacturing, Services"
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
                      placeholder="000-000-000-000"
                      required
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
                      placeholder="Street, City, Province, Postal Code"
                      rows={3}
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none disabled:bg-gray-100"
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

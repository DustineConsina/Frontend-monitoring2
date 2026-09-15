'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { User, Contract } from '@/types'
import { Pencil } from 'lucide-react'

export default function TenantDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = parseInt(params.id as string)

  const [tenant, setTenant] = useState<any | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQrAccessCode, setShowQrAccessCode] = useState(false)
  const [profilePictureFailed, setProfilePictureFailed] = useState(false)

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editFormData, setEditFormData] = useState({
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
    fetchTenantData()
  }, [tenantId])

  const fetchTenantData = async () => {
    try {
      const response = await apiClient.getTenant(tenantId.toString())
      let tenantData = response.data || response

      if (!tenantData || !tenantData.id) {
        throw new Error('Invalid tenant data or not found')
      }

      const fullName = tenantData.contactPerson || tenantData.contact_person || tenantData.user?.name || tenantData.name || ''
      const nameParts = fullName.trim().split(/\s+/)
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      const mappedTenant: any = {
        id: tenantData.id,
        name: fullName,
        firstName: firstName,
        lastName: lastName,
        email: tenantData.email || tenantData.user?.email || '',
        phone: tenantData.phone || tenantData.contactNumber || tenantData.contact_number || tenantData.user?.phone || '',
        contactNumber: tenantData.contactNumber || tenantData.contact_number || tenantData.user?.phone || '',
        address: tenantData.address || tenantData.user?.address || '',
        role: tenantData.role || tenantData.user?.role || 'TENANT',
        businessName: tenantData.businessName || tenantData.business_name || '',
        businessType: tenantData.businessType || tenantData.business_type || '',
        businessAddress: tenantData.businessAddress || tenantData.business_address || '',
        contactPerson: tenantData.contactPerson || tenantData.contact_person || '',
        businessPermitNumber: tenantData.businessPermitNumber || tenantData.business_permit_number || tenantData.tin || '',
        tenantCode: tenantData.tenantCode || tenantData.tenant_code || '',
        status: (tenantData.status || tenantData.status || 'active'),
        // FIX: apiClient converts snake_case to camelCase, so profile_picture_url becomes profilePictureUrl
        profilePictureUrl: tenantData.profilePictureUrl || tenantData.profilePicture_url || tenantData.user?.profilePictureUrl || tenantData.user?.profile_picture_url,
        profilePicturePath: tenantData.profilePicturePath || tenantData.profile_picture_path || tenantData.user?.profilePicturePath || tenantData.user?.profile_picture_path,
        profilePicture: tenantData.profilePictureUrl || tenantData.profilePicture || tenantData.profilePicture_url || tenantData.user?.profilePictureUrl || tenantData.user?.profile_picture_url,
        profile_picture: tenantData.profilePictureUrl || tenantData.profilePicture || tenantData.profile_picture || tenantData.user?.profilePictureUrl || tenantData.user?.profile_picture,
        contact_person: tenantData.contact_person || tenantData.contactPerson || '',
        business_name: tenantData.business_name || tenantData.businessName || '',
        business_type: tenantData.business_type || tenantData.businessType || '',
        business_address: tenantData.business_address || tenantData.businessAddress || '',
        tenant_code: tenantData.tenant_code || tenantData.tenantCode || '',
        qrAccessCode: tenantData.qrAccessCode || tenantData.qr_access_code || '',
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

  const openEditModal = async () => {
    if (!tenant) return
    setEditFormData({
      firstName: tenant.firstName,
      lastName: tenant.lastName,
      email: tenant.email,
      contactNumber: tenant.contactNumber,
      address: tenant.address,
      businessName: tenant.businessName,
      businessType: tenant.businessType,
      businessAddress: tenant.businessAddress,
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

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name } = e.target

    if (e.target instanceof HTMLInputElement && e.target.type === 'file') {
      setEditFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).files?.[0] || null,
      }))
    } else {
      const { value } = e.target
      setEditFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setEditError(null)
    setEditSuccess(null)

    try {
      // Combine all user and tenant data into single payload for updateTenant endpoint
      const updatePayload = {
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        email: editFormData.email,
        phone: editFormData.contactNumber,
        address: editFormData.address,
        contactPerson: editFormData.firstName + ' ' + editFormData.lastName,
        businessName: editFormData.businessName,
        businessType: editFormData.businessType,
        businessAddress: editFormData.businessAddress,
        business_permit_number: editFormData.businessPermitNumber,
      }

      // Update tenant (which also updates associated user data)
      const tenantResult = await apiClient.updateTenant(tenantId.toString(), updatePayload)
      console.log('Tenant update result:', tenantResult)

      // Handle profile picture upload
      if (editFormData.profilePicture) {
        const formData = new FormData()
        formData.append('profile_picture', editFormData.profilePicture)

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://contractmonitoringbackend-production.up.railway.app/api'
        const response = await fetch(`${apiUrl}/tenants/${tenantId}/upload-picture`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Failed to upload profile picture')
        }
      }

      setEditSuccess('✅ Tenant updated successfully!')
      setTimeout(() => setEditSuccess(null), 3000)

      // Refresh data after short delay
      setTimeout(async () => {
        await fetchTenantData()
        closeEditModal()
      }, 1500)
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
        const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || 'https://contractmonitoringbackend-production.up.railway.app/api')
        if (/^(localhost|127\.0\.0\.1|::1)$/i.test(parsedUrl.hostname)) {
          parsedUrl.protocol = apiUrl.protocol
          parsedUrl.host = apiUrl.host
        }
        resolvedUrl = parsedUrl.toString()
      } else {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://contractmonitoringbackend-production.up.railway.app/api'
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
    const normalizedStatus = (status || '').toUpperCase()
    const colors = {
      ACTIVE: 'bg-green-100 text-green-800',
      FOR_RENEWAL: 'bg-indigo-100 text-indigo-800 font-bold',
      EXPIRED: 'bg-yellow-100 text-yellow-800',
      TERMINATED: 'bg-red-100 text-red-800',
      PENDING: 'bg-blue-100 text-blue-800',
      RENEWED: 'bg-indigo-100 text-indigo-800',
    }
    return colors[normalizedStatus as keyof typeof colors] || 'bg-gray-100 text-gray-800'
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

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {tenant.firstName} {tenant.lastName}
            </h2>
            <p className="text-gray-600">Tenant Details</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/dashboard/tenants')}
              title="Back to Tenants"
              className="back-action"
            >
              Back
            </button>
            <button
              onClick={openEditModal}
              title="Edit Tenant"
              aria-label="Edit Tenant"
              className="action-edit inline-flex h-10 w-10 items-center justify-center rounded-lg border"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Tenant Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Details - 2 Columns */}
            <div className="md:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">QR Access Password</h3>
                  <div className="flex max-w-sm items-center gap-3">
                    <input
                      type={showQrAccessCode ? 'text' : 'password'}
                      value={tenant.qrAccessCode || 'Not available'}
                      readOnly
                      className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 font-mono tracking-[0.25em]"
                      aria-label="Tenant QR access password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowQrAccessCode((visible) => !visible)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {showQrAccessCode ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Full Name
                  </label>
                  <p className="text-gray-900">
                    {tenant.firstName} {tenant.lastName}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Email Address
                  </label>
                  <p className="text-gray-900">{tenant.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Phone Number
                  </label>
                  <p className="text-gray-900">{tenant.contactNumber || 'N/A'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Role
                  </label>
                  <p className="text-gray-900">{tenant.role}</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Address
                  </label>
                  <p className="text-gray-900">{tenant.address || 'N/A'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Member Since
                  </label>
                  <p className="text-gray-900">
                    {new Date(tenant.createdAt || '').toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Picture - Right Side */}
            <div className="flex justify-center md:justify-end">
              <div className="w-40 h-40 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden shadow">
                {profilePictureUrl && !profilePictureFailed ? (
                  <img
                    key={profilePictureUrl}
                    src={profilePictureUrl}
                    alt={tenant.firstName || 'Tenant'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.warn('Image failed to load:', profilePictureUrl)
                      setProfilePictureFailed(true)
                    }}
                  />
                ) : (
                  <div className="text-4xl font-bold text-white text-center">
                    {tenant.firstName?.[0]}{tenant.lastName?.[0]}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Business Information */}
        {(tenant.businessName || tenant.businessType || tenant.businessAddress || tenant.businessPermitNumber) && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Business Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Business Name
                </label>
                <p className="text-gray-900">{tenant.businessName || 'N/A'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Business Type
                </label>
                <p className="text-gray-900">{tenant.businessType || 'N/A'}</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Business Address
                </label>
                <p className="text-gray-900">{tenant.businessAddress || 'N/A'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Business Permit Number
                </label>
                <p className="text-gray-900">{tenant.businessPermitNumber || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tenant Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Status</h3>
          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(tenant.status)}`}>
            {(tenant.status || 'active').toUpperCase()}
          </span>
        </div>

        {contracts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Stall Blueprint</h3>
                <p className="text-sm text-gray-500">Schematic location of this tenant&apos;s contracted stalls</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-blue-600" />Active</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-slate-200" />Other</span>
              </div>
            </div>
            <div className="mt-5 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-3 sm:p-5">
              <div className="mb-3 flex items-center justify-between border-b border-blue-100 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-500">
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
                      className={`relative min-h-24 rounded-lg border-2 p-3 ${isActive ? 'border-blue-600 bg-blue-600 text-white shadow-md' : 'border-slate-200 bg-slate-100 text-slate-700'}`}
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
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Contracts ({contracts.length})</h3>
            <div className="grid grid-cols-1 gap-4">
              {contracts.map((contract: any) => (
                <Link
                  key={contract.id}
                  href={`/dashboard/contracts/${contract.id}`}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition block"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">{contract.contractNumber || contract.contract_number}</p>
                      <p className="text-sm text-gray-600">
                        {contract.startDate ? new Date(contract.startDate || '').toLocaleDateString() : 'N/A'} -{' '}
                        {contract.endDate ? new Date(contract.endDate || '').toLocaleDateString() : 'N/A'}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Type
                    </label>
                    <input
                      type="text"
                      name="businessType"
                      value={editFormData.businessType}
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
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none disabled:bg-gray-100"
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

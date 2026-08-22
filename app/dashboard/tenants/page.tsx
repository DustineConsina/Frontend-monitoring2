'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { User } from '@/types'

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    contactNumber: '',
    address: '',
    businessName: '',
    businessType: '',
    businessAddress: '',
    tin: '',
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

    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.email) {
      setFormError('Please fill in all required fields')
      return
    }

    if (formData.contactNumber && !/^09\d{9}$/.test(formData.contactNumber)) {
      setFormError('Contact number must start with 09 and contain exactly 11 digits.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await apiClient.createTenant({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        contact_number: formData.contactNumber,
        address: formData.address,
        business_name: formData.businessName,
        business_type: formData.businessType,
        business_address: formData.businessAddress,
        tin: formData.tin,
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

      setSuccessMessage('Tenant added successfully! 🎉')
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        contactNumber: '',
        address: '',
        businessName: '',
        businessType: '',
        businessAddress: '',
        tin: '',
        profilePicture: null,
      })

      // Refresh tenants list
      await fetchTenants()

      // Close modal after a short delay
      setTimeout(() => {
        setShowModal(false)
        setSuccessMessage(null)
      }, 1500)
    } catch (err: any) {
      setFormError(err.message || 'Failed to create tenant. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeModal = () => {
    if (!isSubmitting) {
      setShowModal(false)
      setFormError(null)
      setSuccessMessage(null)
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        contactNumber: '',
        address: '',
        businessName: '',
        businessType: '',
        businessAddress: '',
        tin: '',
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

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Tenants</h2>
            <p className="text-gray-600">Manage tenant information</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            title="Add Tenant"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Add Tenant
          </button>
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
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Tenants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center h-64">
              <div className="text-center">
                <div className="relative w-12 h-12 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-600 animate-spin"></div>
                </div>
                <p className="mt-4 text-gray-600 font-medium">Loading tenants...</p>
              </div>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">No tenants found</p>
            </div>
          ) : (
            filteredTenants.map((tenant) => (
              <div
                key={tenant.id}
                className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow p-6 border-l-4 border-blue-600"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {tenant.profilePicture || tenant.profile_picture_url || tenant.profile_picture ? (
                        <img
                          src={
                            // Use the pre-constructed URL from backend, add cache busting
                            (tenant.profilePicture || tenant.profile_picture_url) + `${(tenant.profilePicture || tenant.profile_picture_url)?.includes('?') ? '&' : '?'}t=${Date.now()}`
                          }
                          alt={tenant.contact_person || 'Tenant'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('Failed to load image:', e)
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <span className="text-lg font-bold text-white">
                          {tenant.contact_person?.[0]?.toUpperCase() || tenant.user?.name?.[0]?.toUpperCase() || '?'}
                        </span>
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
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center gap-1"
                  >
                    View Details
                  </Link>
                  <Link
                    href={`/dashboard/contracts?tenantId=${tenant.id}`}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-blue-600 text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-1"
                  >
                    Contracts
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {!isLoading && filteredTenants.length > 0 && (
          <div className="text-sm text-gray-600">
            Showing {filteredTenants.length} of {tenants.length} tenants
          </div>
        )}
      </div>

      {/* Add Tenant Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 z-40 bg-[#28334b]/35 backdrop-blur-sm" onClick={closeModal} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="modal-shell max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="modal-header sticky top-0 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Add New Tenant</h3>
              <button
                onClick={closeModal}
                disabled={isSubmitting}
                className="text-gray-500 hover:text-gray-700 text-2xl disabled:opacity-50"
              >
                ✕
              </button>
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
                      Contact Number
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
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                    <p className="mt-1 text-xs text-gray-500">Optional. Enter 11 digits starting with 09.</p>
                  </div>
                </div>
              </div>

              {/* Address Information Section */}
              <div className="form-section">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Address Information</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Residential Address
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Street, City, Province, Postal Code"
                      rows={3}
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
                      Business Name
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      placeholder="Your Business Name"
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
                      value={formData.businessType}
                      onChange={handleChange}
                      placeholder="e.g., Retail, Manufacturing, Services"
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      TIN (Tax Identification Number)
                    </label>
                    <input
                      type="text"
                      name="tin"
                      value={formData.tin}
                      onChange={handleChange}
                      placeholder="000-000-000-000"
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Address
                    </label>
                    <textarea
                      name="businessAddress"
                      value={formData.businessAddress}
                      onChange={handleChange}
                      placeholder="Street, City, Province, Postal Code"
                      rows={3}
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
                    <p className="text-xs text-gray-500 mt-1">Accepts all image formats. Max file size: 50MB</p>
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
                  className="w-10 h-10 flex items-center justify-center border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✕
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

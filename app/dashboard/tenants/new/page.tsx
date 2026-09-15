'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'

export default function NewTenantPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    contactNumber: '',
    address: '',
    businessName: '',
    contactPerson: '',
    businessType: '',
    businessAddress: '',
    businessPermitNumber: '',
  })
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Client-side validation
    const requiredFields = {
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email Address',
      contactNumber: 'Contact Number',
      contactPerson: 'Contact Person',
      businessName: 'Business Name',
      businessType: 'Business Type',
      businessAddress: 'Business Address',
      address: 'Residential Address',
      businessPermitNumber: 'Business Permit Number',
    }
    
    const missingFields = Object.entries(requiredFields)
      .filter(([key]) => !String(formData[key as keyof typeof formData]).trim())
      .map(([_, label]) => label)
    
    if (missingFields.length > 0) {
      alert(`Please fill in the following required fields:\n\n${missingFields.join('\n')}`)
      return
    }

    if (!/^09\d{9}$/.test(formData.contactNumber)) {
      alert('Contact number must start with 09 and contain exactly 11 digits.')
      return
    }
    
    setIsLoading(true)

    try {
      const qrAccessCode = String(Math.floor(10000000 + Math.random() * 90000000))
      const { businessPermitNumber, ...tenantFormData } = formData
      const response = await apiClient.createTenant({
        ...tenantFormData,
        business_permit_number: businessPermitNumber,
        qr_access_code: qrAccessCode,
        role: 'TENANT',
      })
      
      console.log('Tenant created successfully:', response)
      setSuccessMessage(null)
      setIsLoading(false)
      window.location.replace('/dashboard/tenants')
      return
    } catch (err: any) {
      console.error('Error creating tenant:', err)
      const errorMsg = err.message || 'Failed to create tenant'
      const debugDetails = err.debug ? `\n\nDebug Info:\n${err.debug.join('\n')}` : ''
      setDebugInfo(errorMsg + debugDetails)
      alert(errorMsg + debugDetails)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.name === 'contactNumber'
      ? e.target.value.replace(/\D/g, '').slice(0, 11)
      : e.target.value

    setFormData({
      ...formData,
      [e.target.name]: value,
    })
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">New Tenant</h2>
            <p className="text-gray-600">Add a new tenant to the system</p>
          </div>
          <Link
            href="/dashboard/tenants"
            title="Back"
            className="back-action"
          >
            Back
          </Link>
        </div>

        {/* Form */}
        <div className="form-shell p-6 lg:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="form-section">
              <h3 className="form-section-title">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Juan"
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
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Dela Cruz"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="form-section">
              <h3 className="form-section-title">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="juan@example.com"
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
                    maxLength={11}
                    pattern="09[0-9]{9}"
                    inputMode="numeric"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="09123456789"
                  />
                  <p className="mt-1 text-xs text-gray-500">Enter 11 digits starting with 09.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Person <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Full name of contact person"
                  />
                </div>
              </div>
            </div>

            {/* Business Information */}
            <div className="form-section">
              <h3 className="form-section-title">Business Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Your business name"
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
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="e.g., Retail, Wholesale, Service"
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
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Enter business permit number"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="form-section grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Residential Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  placeholder="Your residential address..."
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
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  placeholder="Your business address..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="form-actions flex gap-2 justify-end">
              <Link
                href="/dashboard/tenants"
                title="Cancel"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-400 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                title="Create Tenant"
                className="flex items-center justify-center rounded-md bg-[#5148e5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4038c7] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Tenant'}
              </button>
            </div>
          </form>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg shadow-lg max-w-sm">
              {successMessage}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

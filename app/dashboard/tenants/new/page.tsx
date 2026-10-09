'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'

const FIXED_BUSINESS_ADDRESS = 'Pier 2, Zone 4, Bulan Sorsogon'

const formatBusinessPermitNumber = (value: string) => {
  const digitsOnly = value.replace(/\D/g, '').slice(0, 12)
  return digitsOnly.match(/.{1,4}/g)?.join('-') || ''
}

export default function NewTenantPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    email: '',
    contactNumber: '',
    address: '',
    businessName: '',
    contactPerson: '',
    businessAddress: FIXED_BUSINESS_ADDRESS,
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
      const contactPerson = [formData.firstName, formData.middleName, formData.lastName, formData.suffix].filter(Boolean).join(' ').trim()
      const response = await apiClient.createTenant({
        first_name: formData.firstName,
        middle_name: formData.middleName,
        last_name: formData.lastName,
        email: formData.email,
        contact_number: formData.contactNumber,
        address: formData.address,
        business_name: formData.businessName,
        contact_person: contactPerson,
        business_address: FIXED_BUSINESS_ADDRESS,
        business_permit_number: formatBusinessPermitNumber(formData.businessPermitNumber),
      })
      
      setSuccessMessage('Tenant created successfully. This password works for login and QR scans; share it now because it will not be shown again.')
      setTemporaryPassword(response.data?.temporaryPassword || response.data?.temporary_password || null)
      setIsLoading(false)
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target

    let nextValue = value
    if (name === 'contactNumber') {
      nextValue = value.replace(/\D/g, '').slice(0, 11)
    } else if (name === 'businessPermitNumber') {
      nextValue = formatBusinessPermitNumber(value)
    } else if (name === 'businessAddress') {
      nextValue = FIXED_BUSINESS_ADDRESS
    }

    setFormData({
      ...formData,
      [name]: nextValue,
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                    Middle Name / Initial
                  </label>
                  <input
                    type="text"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="e.g., A."
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Suffix
                  </label>
                  <select
                    name="suffix"
                    value={formData.suffix}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                    Business Permit Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessPermitNumber"
                    value={formData.businessPermitNumber}
                    onChange={handleChange}
                    required
                    inputMode="numeric"
                    maxLength={14}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="1234-5678-9012"
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
                  readOnly
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-gray-50"
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
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-slate-900/40 p-4">
            <div className="w-full max-w-sm rounded-xl border border-green-200 bg-white p-6 text-center text-green-800 shadow-xl">
              <p>{successMessage}</p>
              {temporaryPassword && <p className="my-4 rounded-lg bg-slate-100 p-4 font-mono text-3xl font-bold tracking-[0.25em] text-slate-900">{temporaryPassword}</p>}
              <Link href="/dashboard/tenants" className="inline-flex rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Done</Link>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

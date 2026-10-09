'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient, { resolveApiBaseUrl } from '@/lib/api-client'

const TENANT_SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V']

export default function EditTenantPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [tenant, setTenant] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(true)

  const [formData, setFormData] = useState({
    contactPerson: '',
    suffix: '',
    businessName: '',
    contactNumber: '',
    profilePicture: null as File | null,
  })

  useEffect(() => {
    fetchTenant()
  }, [params.id])

  const fetchTenant = async () => {
    try {
      const response = await apiClient.getTenant(params.id)
      const data = response.data || response
      setTenant(data)
      const nameParts = (data.contact_person || '').trim().split(/\s+/)
      const suffix = TENANT_SUFFIXES.find((option) => option.toLowerCase() === nameParts[nameParts.length - 1]?.toLowerCase()) || ''
      if (suffix) nameParts.pop()
      setFormData({
        contactPerson: nameParts.join(' '),
        suffix,
        businessName: data.business_name || '',
        contactNumber: data.contact_number || '',
        profilePicture: null,
      })
    } catch (err: any) {
      alert(err.message || 'Failed to load tenant')
      router.push('/dashboard/tenants')
    } finally {
      setLoadingData(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'file') {
      setFormData({
        ...formData,
        profilePicture: e.target.files?.[0] || null,
      })
      return
    }

    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await apiClient.updateTenant(params.id, {
        contact_person: [formData.contactPerson, formData.suffix].filter(Boolean).join(' '),
        business_name: formData.businessName,
        contact_number: formData.contactNumber,
      })

      if (formData.profilePicture) {
        const uploadFormData = new FormData()
        uploadFormData.append('profile_picture', formData.profilePicture)

        const apiUrl = resolveApiBaseUrl()
        const uploadResponse = await fetch(`${apiUrl}/tenants/${params.id}/upload-picture`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: uploadFormData,
        })

        if (!uploadResponse.ok) {
          const message = await uploadResponse.text()
          throw new Error(message || 'Failed to upload profile picture')
        }
      }

      alert('✅ Tenant updated successfully!')
      router.push('/dashboard/tenants')
    } catch (err: any) {
      alert(err.message || 'Failed to update tenant')
    } finally {
      setIsLoading(false)
    }
  }

  if (loadingData) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="loading-spinner mx-auto mb-4" aria-hidden="true"></div>
              <p className="text-gray-600">Loading tenant...</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Edit Tenant</h2>
            <p className="text-gray-600">Update tenant information</p>
          </div>
          <Link
            href="/dashboard/tenants"
            className="back-action"
          >
            Back
          </Link>
        </div>

        <div className="form-shell p-6 lg:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-section">
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
              />
            </div>

            <div className="form-section">
              <label className="block text-sm font-medium text-gray-700 mb-2">Suffix</label>
              <select
                name="suffix"
                value={formData.suffix}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">None</option>
                {TENANT_SUFFIXES.map((suffix) => <option key={suffix} value={suffix}>{suffix}</option>)}
              </select>
            </div>

            <div className="form-section">
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
              />
            </div>

            <div className="form-section">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="form-section">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Picture
              </label>
              <input
                type="file"
                name="profilePicture"
                accept="image/*"
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
              />
              {formData.profilePicture && (
                <p className="text-xs text-green-600 mt-1">Selected: {formData.profilePicture.name}</p>
              )}
            </div>

            <div className="form-actions flex gap-3 justify-end">
              <Link
                href="/dashboard/tenants"
                className="action-secondary rounded-lg border px-4 py-2 font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                className="action-primary rounded-lg border px-5 py-2.5 font-medium disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  )
}

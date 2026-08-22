'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'

export default function EditTenantPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [tenant, setTenant] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(true)

  const [formData, setFormData] = useState({
    contactPerson: '',
    businessName: '',
    contactNumber: '',
  })

  useEffect(() => {
    fetchTenant()
  }, [params.id])

  const fetchTenant = async () => {
    try {
      const response = await apiClient.getTenant(params.id)
      const data = response.data || response
      setTenant(data)
      setFormData({
        contactPerson: data.contact_person || '',
        businessName: data.business_name || '',
        contactNumber: data.contact_number || '',
      })
    } catch (err: any) {
      alert(err.message || 'Failed to load tenant')
      router.push('/dashboard/tenants')
    } finally {
      setLoadingData(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
        contact_person: formData.contactPerson,
        business_name: formData.businessName,
        contact_number: formData.contactNumber,
      })
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            ← Back
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

            <div className="form-actions flex gap-3 justify-end">
              <Link
                href="/dashboard/tenants"
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 bg-[#5148e5] text-white rounded-md hover:bg-[#4038c7] transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { User, RentalSpace } from '@/types'
import SearchableRentalSpaceSelect from '@/components/SearchableRentalSpaceSelect'
import SearchableTenantSelect from '@/components/SearchableTenantSelect'

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export default function NewContractPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [tenants, setTenants] = useState<User[]>([])
  const [spaces, setSpaces] = useState<RentalSpace[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [formData, setFormData] = useState({
    tenantId: '',
    rentalSpaceId: '',
    startDate: '',
    endDate: '',
    monthlyRent: '',
    securityDeposit: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      console.log('[FETCH START] Getting tenant and available rental spaces...')
      const [tenantsData, spacesData] = await Promise.all([
        apiClient.getAllTenants(),
        apiClient.getAvailableRentalSpaces({ per_page: 1000 }), // Fetch ONLY available spaces
      ])
      
      console.log('[API RESPONSE] Received spacesData:', spacesData)
      
      // Handle paginated responses - extract actual arrays from nested structure
      const availableSpaces = ((spacesData.data?.data || spacesData.data || []) as RentalSpace[]).filter((space) => {
        const fields = space as RentalSpace & { occupancyStatus?: string; occupancy_status?: string; active_contracts_count?: number; activeContractsCount?: number }
        const status = String(space.status || '').toLowerCase()
        const occupancyStatus = String(fields.occupancyStatus || fields.occupancy_status || '').toLowerCase()
        const activeContractCount = Number(fields.active_contracts_count ?? fields.activeContractsCount ?? 0)
        const blockedStates = new Set(['occupied', 'maintenance', 'inactive', 'reserved', 'rented', 'terminated', 'unavailable'])

        const isAvailableStatus = status === 'available' || status === '' || status === 'null' || status === 'undefined'
        const isNotBlocked = !blockedStates.has(status) && !blockedStates.has(occupancyStatus)

        return isAvailableStatus && isNotBlocked && activeContractCount === 0
      })
      
      console.log('[EXTRACTED] availableSpaces has', availableSpaces.length, 'spaces')
      
      if (availableSpaces.length > 0) {
        console.log('[FIRST SPACE] Keys:', Object.keys(availableSpaces[0]))
      }
      
      console.log('✅ Setting spaces state to:', availableSpaces.length, 'available spaces')
      
      setTenants(tenantsData)
      setSpaces(availableSpaces)
    } catch (err: unknown) {
      console.error('❌ Error fetching data:', err)
      alert(getErrorMessage(err, 'Failed to load data'))
    } finally {
      console.log('[FETCH END] loadingData set to false')
      setLoadingData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.tenantId) {
      alert('Please select a tenant.')
      return
    }

    if (!formData.rentalSpaceId) {
      alert('Please select a rental space.')
      return
    }

    const todayStr = new Date().toISOString().split('T')[0]
    if (formData.startDate < todayStr) {
      alert('Validation Error:\nStart date cannot be in the past.')
      return
    }

    if (formData.endDate && formData.endDate <= formData.startDate) {
      alert('Validation Error:\nEnd date must be after the start date.')
      return
    }

    setIsLoading(true)

    try {
      await apiClient.createContract({
        ...formData,
        monthlyRent: parseFloat(formData.monthlyRent),
        securityDeposit: parseFloat(formData.securityDeposit),
      })
      setSuccessMessage('✅ Contract created successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
      setTimeout(() => {
        router.push('/dashboard/contracts')
      }, 2000)
    } catch (err: unknown) {
      // Check if error is validation error with multiple field errors
      const failure = err && typeof err === 'object' ? err as { errors?: unknown; message?: string } : {}
      if (failure.errors && typeof failure.errors === 'object') {
        const errorMessages = Object.entries(failure.errors)
          .map(([field, messages]) => {
            const msg = Array.isArray(messages) ? messages[0] : messages
            return `${field}: ${String(msg)}`
          })
          .join('\n')
        alert(`Validation Error:\n${errorMessages}`)
      } else {
        alert(failure.message || getErrorMessage(err, 'Failed to create contract'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleRentalSpaceSelect = (spaceId: string) => {
    const selectedSpace = spaces.find((space) => String(space.id) === spaceId)
    const baseRate = selectedSpace?.base_rental_rate || selectedSpace?.baseRentalRate
    setFormData((previous) => ({
      ...previous,
      rentalSpaceId: spaceId,
      monthlyRent: baseRate ? String(baseRate) : previous.monthlyRent,
    }))
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">New Contract</h2>
            <p className="text-gray-600">Create a new rental contract</p>
          </div>
          <Link
            href="/dashboard/contracts"
            className="back-action"
          >
            Back
          </Link>
        </div>

        {/* Form */}
        <div className="form-shell p-6 lg:p-8">
          {loadingData ? (
            <div className="text-center py-12">
              <div className="loading-spinner" aria-hidden="true" />
              <p className="mt-4 text-gray-600">Loading form data...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tenant Selection */}
              <div className="form-section" style={{ position: 'relative', zIndex: 10 }}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tenant <span className="text-red-500">*</span>
                </label>
                <SearchableTenantSelect
                  tenants={tenants}
                  value={formData.tenantId}
                  onChange={(tenantId) => setFormData((previous) => ({ ...previous, tenantId }))}
                />
              </div>

              {/* Rental Space Selection - Custom Dropdown */}
              <div className="form-section" style={{ position: 'relative', zIndex: 50 }}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rental Space <span className="text-red-500">*</span>
                  {/* Debug: Show count */}
                  <span className="text-xs text-blue-600 ml-2">
                    ({spaces.length} available spaces)
                  </span>
                </label>
                
                {/* Hidden input for form submission */}
                <input
                  type="hidden"
                  name="rentalSpaceId"
                  value={formData.rentalSpaceId}
                />
                
                <SearchableRentalSpaceSelect
                  spaces={spaces}
                  value={formData.rentalSpaceId}
                  onChange={handleRentalSpaceSelect}
                />
                
                {spaces.length === 0 && !loadingData && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                    ℹ️ No available rental spaces. All spaces are currently occupied or under maintenance.
                  </div>
                )}
              </div>

              {/* Date Range - moved down to give space for dropdowns above */}
              <div className="form-section grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Financial Details */}
              <div className="form-section grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Rent (₱) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="monthlyRent"
                    value={formData.monthlyRent}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Automatically filled from the selected space. You can adjust the amount if needed.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Security Deposit (₱)
                  </label>
                  <input
                    type="number"
                    name="securityDeposit"
                    value={formData.securityDeposit}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="form-actions flex gap-2 justify-end">
                <Link
                  href="/dashboard/contracts"
                  title="Cancel"
                  className="px-4 py-2 flex items-center justify-center border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isLoading}
                  title="Create Contract"
                  className="px-5 py-2.5 flex items-center justify-center bg-[#5148e5] text-white rounded-md hover:bg-[#4038c7] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="rounded-xl border border-[#b9e5cc] bg-[#effbf3] px-6 py-4 text-[#2e8757] shadow-lg max-w-sm">
              {successMessage}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

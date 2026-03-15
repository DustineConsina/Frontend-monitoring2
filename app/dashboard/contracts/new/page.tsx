'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { User, RentalSpace } from '@/types'

export default function NewContractPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [tenants, setTenants] = useState<User[]>([])
  const [spaces, setSpaces] = useState<RentalSpace[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showSpaceDropdown, setShowSpaceDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    tenantId: '',
    rentalSpaceId: '',
    startDate: '',
    endDate: '',
    monthlyRent: '',
    securityDeposit: '',
    terms: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSpaceDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchData = async () => {
    try {
      const [tenantsData, spacesData] = await Promise.all([
        apiClient.getTenants(),
        apiClient.getRentalSpaces(), // Get all spaces
      ])
      // Handle paginated responses - extract actual arrays from nested structure
      const tenantsArray = tenantsData.data?.data || tenantsData.data || []
      const allSpacesArray = spacesData.data?.data || spacesData.data || []
      
      // Filter to only spaces WITHOUT active contracts
      // Check activeContractsCount to determine if space is occupied
      const availableSpaces = allSpacesArray.filter((space: any) => {
        const hasActiveContract = space.activeContractsCount > 0 || space.active_contracts_count > 0
        return !hasActiveContract
      })
      
      console.log('✅ Total spaces we got:', allSpacesArray.length)
      console.log('✅ Available spaces after filtering:', availableSpaces.length)
      console.log('✅ Occupied spaces:', allSpacesArray.length - availableSpaces.length)
      
      setTenants(tenantsArray)
      setSpaces(availableSpaces)
    } catch (err: any) {
      console.error('❌ Error fetching data:', err)
      alert(err.message || 'Failed to load data')
    } finally {
      setLoadingData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await apiClient.createContract({
        ...formData,
        monthlyRent: parseFloat(formData.monthlyRent),
        securityDeposit: parseFloat(formData.securityDeposit),
      })
      setSuccessMessage('✅ Contract created successfully!')
      setTimeout(() => {
        router.push('/dashboard/contracts')
      }, 2000)
    } catch (err: any) {
      // Check if error is validation error with multiple field errors
      if (err.errors && typeof err.errors === 'object') {
        const errorMessages = Object.entries(err.errors)
          .map(([field, messages]: [string, any]) => {
            const msg = Array.isArray(messages) ? messages[0] : messages;
            return `${field}: ${msg}`;
          })
          .join('\n');
        alert(`Validation Error:\n${errorMessages}`);
      } else {
        alert(err.message || 'Failed to create contract');
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
    // Find the selected space
    const selectedSpace = spaces.find((s: any) => s.id == spaceId)
    
    // Auto-populate monthly rent from the rental space's base rental rate
    let newMonthlyRent = formData.monthlyRent
    if (selectedSpace && (selectedSpace.base_rental_rate || selectedSpace.baseRentalRate)) {
      const baseRate = selectedSpace.base_rental_rate || selectedSpace.baseRentalRate
      newMonthlyRent = String(baseRate)
      console.log(`✅ Auto-populated monthly rent: ₱${baseRate} from space ${selectedSpace.space_code}`)
    }
    
    setFormData({
      ...formData,
      rentalSpaceId: spaceId,
      monthlyRent: newMonthlyRent,
    })
    setShowSpaceDropdown(false)
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
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            ← Back
          </Link>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          {loadingData ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
              <p className="mt-4 text-gray-600">Loading form data...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tenant Selection */}
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tenant <span className="text-red-500">*</span>
                </label>
                <select
                  name="tenantId"
                  value={formData.tenantId}
                  onChange={handleChange}
                  required
                  style={{ position: 'relative', zIndex: 10 }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Select a tenant</option>
                  {tenants.map((tenant: any) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.contact_person} - {tenant.user?.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rental Space Selection - Custom Dropdown */}
              <div ref={dropdownRef} style={{ position: 'relative', zIndex: 50 }}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rental Space <span className="text-red-500">*</span>
                </label>
                
                {/* Hidden input for form submission */}
                <input
                  type="hidden"
                  name="rentalSpaceId"
                  value={formData.rentalSpaceId}
                />
                
                {/* Custom Dropdown Button */}
                <button
                  type="button"
                  onClick={() => setShowSpaceDropdown(!showSpaceDropdown)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-left bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  style={{ textAlign: 'left' }}
                >
                  {formData.rentalSpaceId
                    ? spaces.find((s: any) => s.id == formData.rentalSpaceId)
                      ? `${spaces.find((s: any) => s.id == formData.rentalSpaceId)?.spaceCode || spaces.find((s: any) => s.id == formData.rentalSpaceId)?.spaceNumber || 'N/A'} - ${spaces.find((s: any) => s.id == formData.rentalSpaceId)?.name || 'N/A'}`
                      : 'Select a rental space'
                    : 'Select a rental space'}
                  <span className="float-right">▼</span>
                </button>
                
                {/* Custom Dropdown List - Opens Downward */}
                {showSpaceDropdown && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50"
                    style={{
                      maxHeight: '300px',
                      overflowY: 'auto',
                      marginTop: '4px',
                    }}
                  >
                    <div
                      className="px-4 py-2 text-gray-500 text-sm cursor-pointer hover:bg-gray-100"
                      onClick={() => {
                        setFormData({ ...formData, rentalSpaceId: '' })
                        setShowSpaceDropdown(false)
                      }}
                    >
                      Select a rental space
                    </div>
                    {spaces.map((space: any) => (
                      <div
                        key={space.id}
                        className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-100 border-b border-gray-100"
                        onClick={() => {
                          handleRentalSpaceSelect(space.id)
                        }}
                      >
                        <div className="font-medium">{space.space_code} - {space.name}</div>
                        <div className="text-gray-500 text-xs">
                          {space.size_sqm} sqm • {space.status}
                          {(space.base_rental_rate || space.baseRentalRate) && (
                            <> • ₱{(space.base_rental_rate || space.baseRentalRate).toLocaleString()}/month</>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {spaces.length === 0 && !loadingData && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                    ℹ️ No available rental spaces. All spaces are currently occupied or under maintenance.
                  </div>
                )}
              </div>

              {/* Date Range - moved down to give space for dropdowns above */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
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
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Financial Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <p className="text-xs text-gray-500 mt-1">💡 Automatically filled from the selected rental space rate</p>
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

              {/* Terms and Conditions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Terms and Conditions
                </label>
                <textarea
                  name="terms"
                  value={formData.terms}
                  onChange={handleChange}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  placeholder="Enter contract terms and conditions..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-4 border-t">
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
                  className="px-4 py-2 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '⏳ Creating...' : 'Create'}
                </button>
              </div>
            </form>
          )}
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

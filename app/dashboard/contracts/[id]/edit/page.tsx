'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { User, RentalSpace } from '@/types'
import { dateForInput } from '@/lib/date-format'
import SearchableRentalSpaceSelect from '@/components/SearchableRentalSpaceSelect'
import SearchableTenantSelect from '@/components/SearchableTenantSelect'

function unwrapContractResponse(response: any) {
  return response?.data?.data || response?.data || response
}

export default function EditContractPage() {
  const params = useParams()
  const router = useRouter()
  const contractId = parseInt(params.id as string)

  const [formData, setFormData] = useState({
    tenantId: '',
    rentalSpaceId: '',
    startDate: '',
    endDate: '',
    monthlyRent: '',
    securityDeposit: '',
  })

  const [tenants, setTenants] = useState<User[]>([])
  const [spaces, setSpaces] = useState<RentalSpace[]>([])
  const [originalStartDate, setOriginalStartDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [contractId])

  const fetchData = async () => {
    try {
      // Fetch contract data
      const contractResponse = await apiClient.getContract(contractId.toString())
      const contract = unwrapContractResponse(contractResponse)
      const startDate = dateForInput(contract.startDate || contract.start_date)
      const endDate = dateForInput(contract.endDate || contract.end_date)
      const rentalSpaceId = String(
        contract.rentalSpaceId || contract.rental_space_id || contract.rentalSpace?.id || contract.rental_space?.id || ''
      )
      setOriginalStartDate(startDate)
      setFormData((prev) => ({
        ...prev,
        rentalSpaceId: rentalSpaceId,
      }))
      
      // NOTE: apiClient converts ALL response keys from snake_case to camelCase
      // So contract.tenant_id becomes contract.tenantId, etc.
      setFormData({
        tenantId: contract.tenantId?.toString() || contract.tenant?.id?.toString() || '',
        rentalSpaceId,
        startDate,
        endDate,
        monthlyRent: (contract.monthlyRental || contract.monthly_rental || contract.monthlyRent || contract.monthly_rent)?.toString() || '',
        securityDeposit: (contract.depositAmount || contract.deposit_amount || contract.securityDeposit || contract.security_deposit)?.toString() || '',
      })

      // Fetch tenants and spaces for dropdowns
      const tenantsResponse = await apiClient.getTenants()
      const spacesResponse = await apiClient.getRentalSpaces()
      
      // Handle paginated responses from Laravel
      const tenantsArray = Array.isArray(tenantsResponse) 
        ? tenantsResponse 
        : (tenantsResponse.data?.data || tenantsResponse.data || [])
      
      const spacesArray = Array.isArray(spacesResponse) 
        ? spacesResponse 
        : (spacesResponse.data?.data || spacesResponse.data || [])

      console.log('🏢 SPACES LOADED:')
      spacesArray.slice(0, 3).forEach((space: any) => {
        console.log(`  Space ${space.id}:`, {
          spaceCode: space.spaceCode || space.space_code,
          baseRentalRate: space.baseRentalRate,
          base_rental_rate: space.base_rental_rate,
          allRateFields: {
            baseRentalRate: space.baseRentalRate,
            base_rental_rate: space.base_rental_rate,
            rentalAmount: space.rentalAmount,
            rental_amount: space.rental_amount,
          }
        })
      })

      const currentSpace = contract.rentalSpace || contract.rental_space
      const hasCurrentSpace = spacesArray.some((space: any) => String(space.id) === rentalSpaceId)
      const spacesWithCurrent = !hasCurrentSpace && rentalSpaceId
        ? [{ ...(currentSpace || {}), id: rentalSpaceId }, ...spacesArray]
        : spacesArray

      setTenants(tenantsArray)
      setSpaces(spacesWithCurrent)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load contract data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    console.log(`🔄 CHANGE EVENT: ${name} = ${value}`)
    
    // Special handling for rental space selection to auto-populate monthly rent
    if (name === 'rentalSpaceId') {
      console.log(`  🔍 Looking for space ID ${value} in ${spaces.length} spaces`)
      const selectedSpace = spaces.find((s: any) => s.id == value)
      let newMonthlyRent = formData.monthlyRent
      
      if (selectedSpace) {
        console.log(`  ✅ Found space:`, {
          id: selectedSpace.id,
          code: selectedSpace.spaceCode || selectedSpace.space_code,
          baseRentalRate: selectedSpace.baseRentalRate,
          base_rental_rate: selectedSpace.base_rental_rate,
        })
        
        const baseRate = selectedSpace.baseRentalRate || selectedSpace.base_rental_rate
        
        if (baseRate) {
          newMonthlyRent = String(baseRate)
          console.log(`  💰 Setting monthly rent to: ${newMonthlyRent} (from baseRate: ${baseRate})`)
        } else {
          console.warn(`  ⚠️ No base rental rate found for space`, {
            baseRentalRate: selectedSpace.baseRentalRate,
            base_rental_rate: selectedSpace.base_rental_rate,
          })
        }
      } else {
        console.warn(`  ❌ Space with ID ${value} not found in spaces list`)
        console.log(`     Available spaces:`, spaces.map((s: any) => ({ id: s.id, code: s.spaceCode || s.space_code })))
      }
      
      setFormData((previous) => ({
        ...previous,
        [name]: value,
        monthlyRent: newMonthlyRent,
      }))
    } else {
      setFormData((previous) => ({
        ...previous,
        [name]: value,
      }))
    }
  }

  const handleRentalSpaceSelect = (spaceId: string) => {
    const selectedSpace = spaces.find((space) => String(space.id) === spaceId)
    const baseRate = selectedSpace?.baseRentalRate || selectedSpace?.base_rental_rate
    setFormData((previous) => ({
      ...previous,
      rentalSpaceId: spaceId,
      monthlyRent: baseRate ? String(baseRate) : previous.monthlyRent,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!formData.tenantId) {
      setError('Please select a tenant.')
      return
    }

    if (!formData.rentalSpaceId) {
      setError('Please select a rental space.')
      return
    }

    const todayStr = new Date().toISOString().split('T')[0]
    if (formData.startDate < todayStr && formData.startDate !== originalStartDate) {
      setError('Start date cannot be set to a past date.')
      return
    }

    if (formData.endDate && formData.endDate <= formData.startDate) {
      setError('End date must be after the start date.')
      return
    }

    setIsSubmitting(true)

    try {
      const monthlyRentValue = parseFloat(formData.monthlyRent)
      const securityDepositValue = parseFloat(formData.securityDeposit)
      
      const updatePayload = {
        tenantId: parseInt(formData.tenantId),
        rentalSpaceId: parseInt(formData.rentalSpaceId),
        startDate: formData.startDate,
        endDate: formData.endDate,
        monthlyRent: monthlyRentValue,
        securityDeposit: securityDepositValue,
      }

      await apiClient.updateContract(contractId.toString(), updatePayload)
      const refreshedContract = unwrapContractResponse(await apiClient.getContract(contractId.toString()))
      const updatedContract = refreshedContract
      const updatedStartDate = dateForInput(updatedContract?.startDate || updatedContract?.start_date)
      const updatedEndDate = dateForInput(updatedContract?.endDate || updatedContract?.end_date)

      if (updatedStartDate !== formData.startDate || updatedEndDate !== formData.endDate) {
        throw new Error('The backend did not return the updated rental period. Please try again.')
      }

      if (updatedStartDate || updatedEndDate) {
        setFormData((previous) => ({
          ...previous,
          startDate: updatedStartDate || previous.startDate,
          endDate: updatedEndDate || previous.endDate,
        }))
      }
      
      setSuccessMessage('✅ Contract updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
      
      // Redirect after showing success for 2 seconds
      setTimeout(() => {
        router.push(`/dashboard/contracts/${contractId}`)
      }, 2000)
    } catch (err: any) {
      console.error('❌ Error updating contract:', err)
      setError(err.message || 'Failed to update contract')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="loading-spinner" aria-hidden="true" />
            <p className="mt-4 text-gray-600">Loading contract...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      {/* Modal Overlay with Blurred Background */}
      <div className="fixed inset-0 z-40 bg-[#28334b]/40 backdrop-blur-sm" onClick={() => router.push(`/dashboard/contracts/${contractId}`)} />
      
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-1/4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in">
          <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg p-4">
            <p className="text-green-700 font-medium">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Modal Content */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="form-shell w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
          {/* Modal Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Edit Contract</h2>
                <p className="text-gray-600 text-sm mt-1">Update contract details</p>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded mb-6">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="loading-spinner" aria-hidden="true" />
                  <p className="mt-4 text-gray-600">Loading contract...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Tenant Selection */}
                <div className="form-section">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tenant <span className="text-red-500">*</span>
                  </label>
                  <SearchableTenantSelect
                    tenants={tenants}
                    value={formData.tenantId}
                    onChange={(tenantId) => setFormData((previous) => ({ ...previous, tenantId }))}
                  />
                </div>

                {/* Rental Space Selection */}
                <div className="form-section">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rental Space <span className="text-red-500">*</span>
                  </label>
                  <SearchableRentalSpaceSelect
                    spaces={spaces.filter((space) => {
                      const fields = space as RentalSpace & { activeContractsCount?: number; active_contracts_count?: number }
                      const activeContractCount = fields.activeContractsCount || fields.active_contracts_count || 0
                      return activeContractCount === 0 || String(space.id) === String(formData.rentalSpaceId)
                    })}
                    value={formData.rentalSpaceId}
                    onChange={handleRentalSpaceSelect}
                  />
                </div>

                {/* Date Range */}
                <div className="form-section grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      required
                      min={originalStartDate && originalStartDate < new Date().toISOString().split('T')[0] ? originalStartDate : new Date().toISOString().split('T')[0]}
                      value={formData.startDate}
                      onChange={handleChange}
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
                      required
                      min={formData.startDate || new Date().toISOString().split('T')[0]}
                      value={formData.endDate}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {/* Financial Details */}
                <div className="form-section grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Rent (₱) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="monthlyRent"
                      required
                      step="0.01"
                      min="0"
                      value={formData.monthlyRent}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 Automatically filled from the selected rental space rate</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Security Deposit (₱) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="securityDeposit"
                      required
                      step="0.01"
                      min="0"
                      value={formData.securityDeposit}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

          {/* Actions */}
          <div className="form-actions flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/contracts/${contractId}`)}
              className="action-secondary rounded-lg border px-4 py-2 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="action-primary rounded-lg border px-5 py-2.5 font-medium disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

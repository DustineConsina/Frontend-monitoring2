'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { Contract } from '@/types'
import Pagination from '@/components/Pagination'
import { Eye } from 'lucide-react'

function ContractsPageContent() {
  const searchParams = useSearchParams()
  const tenantId = searchParams.get('tenantId') || ''
  const [contracts, setContracts] = useState<Contract[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [contractToDelete, setContractToDelete] = useState<any | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Modal state for add/edit contract
  const [showModal, setShowModal] = useState(false)
  const [editingContractId, setEditingContractId] = useState<number | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalSuccess, setModalSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tenants, setTenants] = useState<any[]>([])
  const [spaces, setSpaces] = useState<any[]>([])
  const [originalStartDate, setOriginalStartDate] = useState<string>('')
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
    fetchContracts()
  }, [statusFilter, tenantId])

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, searchTerm, tenantId])

  const fetchContracts = async () => {
    try {
      const params: any = {}
      if (statusFilter !== 'all') {
        params.status = statusFilter.toLowerCase()
      }
      if (tenantId) {
        params.tenant_id = tenantId
      }
      const response = await apiClient.getContracts(params)
      
      // The API returns: { success: true, data: { data: [...], pagination_info } }
      // OR for direct responses: { success: true, data: [...] }
      // OR just: [...]
      
      let contractList: any[] = []
      
      // Check if response has data property
      if (response && response.data) {
        // If data is an array, use it
        if (Array.isArray(response.data)) {
          contractList = response.data
        }
        // If data has a data property (paginated), extract it
        else if (response.data.data && Array.isArray(response.data.data)) {
          contractList = response.data.data
        }
      }
      // If response is directly an array
      else if (Array.isArray(response)) {
        contractList = response
      }
      
      console.log('Fetched contracts:', contractList)
      console.log('First contract sample:', contractList[0])
      
      // Log the numeric fields from the first contract
      if (contractList.length > 0) {
        const first = contractList[0]
        console.log('🔍 FIRST CONTRACT - RAW NUMERIC FIELDS:', {
          monthlyRental: first.monthlyRental,
          depositAmount: first.depositAmount,
          interestRate: first.interestRate,
        })
      }
      
      // Map numeric fields to ensure they're properly parsed
      const mappedContracts = contractList.map((c: any) => {
        const monthlyRentValue = parseFloat(String(c.monthlyRental || 0))
        const securityDepositValue = parseFloat(String(c.depositAmount || 0))
        
        return {
          ...c,
          monthlyRent: monthlyRentValue,
          securityDeposit: securityDepositValue,
          interestRate: parseFloat(String(c.interestRate || 0)),
          startDate: c.startDate || c.start_date,
          endDate: c.endDate || c.end_date,
        }
      })
      
      console.log('✅ First contract AFTER mapping:', mappedContracts[0])
      
      setContracts(mappedContracts)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load contracts')
      setContracts([])
    } finally {
      setIsLoading(false)
    }
  }

  const filteredContracts = Array.isArray(contracts) ? contracts.filter((contract) => {
    const searchLower = searchTerm.toLowerCase()
    const tenantName = (contract.tenant?.contactPerson || contract.tenant?.user?.name || '').toLowerCase()
    const spaceName = (contract.rentalSpace?.spaceCode || contract.rentalSpace?.name || '').toLowerCase()
    return (
      (contract.contractNumber || '').toLowerCase().includes(searchLower) ||
      tenantName.includes(searchLower) ||
      spaceName.includes(searchLower)
    )
  }) : []
  const paginatedContracts = filteredContracts.slice((currentPage - 1) * 15, currentPage * 15)

  const getStatusBadge = (status: string) => {
    const colors = {
      ACTIVE: 'bg-emerald-100 text-emerald-800',
      EXPIRED: 'bg-amber-100 text-amber-800',
      TERMINATED: 'bg-rose-100 text-rose-800',
      RENEWED: 'bg-indigo-100 text-indigo-800',
      PENDING: 'bg-blue-100 text-blue-800',
      FOR_RENEWAL: 'bg-indigo-100 text-indigo-800 font-bold',
    }
    return colors[status as keyof typeof colors] || 'bg-slate-100 text-slate-800'
  }

  const handleDeleteContract = async (contract: any) => {
    const status = String(contract.status || '').toLowerCase()
    if (!['terminated', 'expired'].includes(status)) {
      setError('Only terminated or expired contracts can be deleted.')
      return
    }
    setContractToDelete(contract)
  }

  const confirmDeleteContract = async () => {
    if (!contractToDelete) return

    setDeletingId(Number(contractToDelete.id))
    try {
      await apiClient.deleteContract(String(contractToDelete.id))
      setContracts((current) => current.filter((item) => String(item.id) !== String(contractToDelete.id)))
      setContractToDelete(null)
      setSuccessMessage('Contract deleted successfully.')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete contract')
    } finally {
      setDeletingId(null)
    }
  }

  const fetchModalData = async () => {
    try {
      const [tenantsRes, spacesRes] = await Promise.all([
        apiClient.getTenants(),
        apiClient.getRentalSpaces(),
      ])
      
      const tenantsArray = tenantsRes.data?.data || tenantsRes.data || []
      const spacesArray = spacesRes.data?.data || spacesRes.data || []
      
      setTenants(tenantsArray)
      setSpaces(spacesArray)
    } catch (err: any) {
      setModalError('Failed to load form data')
    }
  }

  const openAddModal = async () => {
    setEditingContractId(null)
    setOriginalStartDate('')
    setFormData({
      tenantId: '',
      rentalSpaceId: '',
      startDate: '',
      endDate: '',
      monthlyRent: '',
      securityDeposit: '',
      terms: '',
    })
    setModalError(null)
    setModalSuccess(null)
    setModalLoading(true)
    setShowModal(true)
    await fetchModalData()
    setModalLoading(false)
  }

  const openEditModal = async (contract: any) => {
    const startStr = contract.startDate ? new Date(contract.startDate).toISOString().split('T')[0] : ''
    setEditingContractId(contract.id)
    setOriginalStartDate(startStr)
    setFormData({
      tenantId: contract.tenantId?.toString() || contract.tenant?.id?.toString() || '',
      rentalSpaceId: contract.rentalSpaceId?.toString() || contract.rentalSpace?.id?.toString() || '',
      startDate: startStr,
      endDate: contract.endDate ? new Date(contract.endDate).toISOString().split('T')[0] : '',
      monthlyRent: contract.monthlyRental?.toString() || contract.monthlyRent?.toString() || '',
      securityDeposit: contract.depositAmount?.toString() || contract.securityDeposit?.toString() || '',
      terms: contract.termsConditions || contract.terms || '',
    })
    setModalError(null)
    setModalSuccess(null)
    setModalLoading(true)
    setShowModal(true)
    await fetchModalData()
    setModalLoading(false)
  }

  const closeModal = () => {
    if (!isSubmitting) {
      setShowModal(false)
      setEditingContractId(null)
      setOriginalStartDate('')
      setModalError(null)
      setModalSuccess(null)
    }
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Auto-fill monthly rent when rental space changes
    if (name === 'rentalSpaceId') {
      const selectedSpace = spaces.find((s: any) => s.id == value)
      const baseRate = selectedSpace?.baseRentalRate || selectedSpace?.base_rental_rate || formData.monthlyRent
      
      setFormData({
        ...formData,
        [name]: value,
        monthlyRent: baseRate ? String(baseRate) : formData.monthlyRent,
      })
    } else {
      setFormData({
        ...formData,
        [name]: value,
      })
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setModalError(null)
    setModalSuccess(null)

    const todayStr = new Date().toISOString().split('T')[0]

    // Validate that start date is not in the past
    if (!editingContractId && formData.startDate < todayStr) {
      setModalError('Start date cannot be in the past.')
      setIsSubmitting(false)
      return
    }

    if (editingContractId && formData.startDate < todayStr && formData.startDate !== originalStartDate) {
      setModalError('Start date cannot be set to a past date.')
      setIsSubmitting(false)
      return
    }

    // Validate that end date is after start date
    if (formData.endDate && formData.endDate <= formData.startDate) {
      setModalError('End date must be after the start date.')
      setIsSubmitting(false)
      return
    }

    try {
      const payload = {
        tenantId: parseInt(formData.tenantId),
        rentalSpaceId: parseInt(formData.rentalSpaceId),
        startDate: formData.startDate,
        endDate: formData.endDate,
        monthlyRent: parseFloat(formData.monthlyRent),
        securityDeposit: parseFloat(formData.securityDeposit),
        terms: formData.terms,
      }

      if (editingContractId) {
        // Update existing contract
        await apiClient.updateContract(editingContractId.toString(), payload)
        setModalSuccess('✅ Contract updated successfully!')
        setTimeout(() => setModalSuccess(null), 3000)
      } else {
        // Create new contract
        await apiClient.createContract(payload)
        setModalSuccess('✅ Contract created successfully!')
        setTimeout(() => setModalSuccess(null), 3000)
      }

      // Refresh contracts list
      await fetchContracts()

      // Close modal after short delay
      setTimeout(() => {
        closeModal()
      }, 1500)
    } catch (err: any) {
      setModalError(err.message || 'Failed to save contract')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Contracts</h1>
            <p className="text-slate-600 text-base mt-1">
              {tenantId ? `Contracts for tenant #${tenantId}` : 'Manage rental contracts and agreements'}
            </p>
          </div>
          <button
            onClick={openAddModal}
            title="New Contract"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all"
          >
            + New Contract
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
            <div className="flex-shrink-0 text-red-500 font-bold text-xl">!</div>
            <div>
              <p className="text-sm font-medium text-red-900">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-start gap-3">
            <div className="flex-shrink-0 text-green-600 font-bold text-xl">✓</div>
            <div>
              <p className="text-sm font-medium text-green-900">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white rounded-lg shadow p-6 border border-gray-100">
          {/* Search */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by contract number, tenant, or space..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="for_renewal">For Renewal</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="terminated">Terminated</option>
              <option value="renewed">Renewed</option>
            </select>
          </div>
        </div>

        {/* Contracts Table */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 items-center justify-center">
                  <div className="loading-spinner" aria-hidden="true"></div>
                </div>
                <p className="text-gray-600 font-medium">Loading contracts...</p>
              </div>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No contracts found</p>
              <button
                onClick={openAddModal}
                className="action-primary inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2"
              >
                + Create Contract
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Contract #</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Tenant</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Space</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Rental Period</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Monthly Rent</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedContracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/contracts/${contract.id}`}
                          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                        >
                          {contract.contractNumber || contract.contract_number}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {contract.tenant?.user?.name || contract.tenant?.contactPerson || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {(() => {
                          const rs = contract.rentalSpace
                          return rs?.spaceCode || rs?.space_code || 'N/A'
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {contract.startDate ? new Date(contract.startDate || '').toLocaleDateString() : 'N/A'} to{' '}
                        {contract.endDate ? new Date(contract.endDate || '').toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ₱{(contract.monthlyRent || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                            (contract.status || 'PENDING').toUpperCase()
                          )}`}
                        >
                          {(contract.status || 'PENDING').toUpperCase().replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Link
                            href={`/dashboard/contracts/${contract.id}`}
                            title="View Contract"
                            aria-label="View Contract"
                            className="action-primary inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Link>
                          <button
                            onClick={() => openEditModal(contract)}
                            className="action-edit rounded-lg border px-3 py-1 text-xs font-semibold"
                          >
                            Edit
                          </button>
                          {['terminated', 'expired'].includes(String(contract.status || '').toLowerCase()) && (
                            <button
                              onClick={() => handleDeleteContract(contract)}
                              disabled={deletingId === Number(contract.id)}
                              className="action-danger rounded-lg border px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed"
                            >
                              {deletingId === Number(contract.id) ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        {!isLoading && filteredContracts.length > 0 && (
          <Pagination currentPage={currentPage} totalItems={filteredContracts.length} onPageChange={setCurrentPage} />
        )}

        {!isLoading && filteredContracts.length > 0 && (
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredContracts.length}</span> of <span className="font-semibold text-gray-900">{contracts.length}</span> contracts
          </div>
        )}

        {/* Add/Edit Contract Modal */}
        {showModal && (
          <>
            <div className="fixed inset-0 z-40 bg-[#28334b]/35 backdrop-blur-sm" onClick={closeModal} />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <div className="modal-shell max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
              {/* Modal Header */}
              <div className="modal-header sticky top-0 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingContractId ? 'Edit Contract' : 'Add New Contract'}
                </h3>
              </div>

              {/* Modal Content */}
              {modalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="loading-spinner" aria-hidden="true" />
                    <p className="mt-4 text-gray-600">Loading...</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="modal-body space-y-6">
                  {/* Success Message */}
                  {modalSuccess && (
                    <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
                      <p className="text-sm text-green-700">✅ {modalSuccess}</p>
                    </div>
                  )}

                  {/* Error Message */}
                  {modalError && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                      <p className="text-sm text-red-700">❌ {modalError}</p>
                    </div>
                  )}

                  {/* Tenant Selection */}
                  <div className="form-section">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tenant <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="tenantId"
                      required
                      value={formData.tenantId}
                      onChange={handleFormChange}
                      disabled={isSubmitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    >
                      <option value="">Select tenant</option>
                      {tenants.map((tenant: any) => {
                        const tenantName = tenant.businessName || tenant.business_name || tenant.contactPerson || 'Unknown'
                        const tenantIdentifier = tenant.contactPerson || tenant.contact_person || tenant.email || 'N/A'
                        return (
                          <option key={tenant.id} value={tenant.id}>
                            {tenantName} - {tenantIdentifier}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  {/* Rental Space Selection */}
                  <div className="form-section">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rental Space <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="rentalSpaceId"
                      required
                      value={formData.rentalSpaceId}
                      onChange={handleFormChange}
                      disabled={isSubmitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    >
                      <option value="">Select rental space</option>
                      {spaces.map((space: any) => (
                        <option key={space.id} value={space.id}>
                          {space.space_code || space.spaceCode || space.spaceNumber} - {space.name || space.location} ({space.size_sqm || space.squareMeters} sqm)
                          {(space.base_rental_rate || space.baseRentalRate) && (
                            <> • ₱{(space.base_rental_rate || space.baseRentalRate).toLocaleString()}/month</>
                          )}
                        </option>
                      ))}
                    </select>
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
                        min={editingContractId ? (originalStartDate && originalStartDate < new Date().toISOString().split('T')[0] ? originalStartDate : new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]}
                        value={formData.startDate}
                        onChange={handleFormChange}
                        disabled={isSubmitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
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
                        onChange={handleFormChange}
                        disabled={isSubmitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
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
                        onChange={handleFormChange}
                        disabled={isSubmitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                      />
                      <p className="text-xs text-gray-500 mt-1">💡 Auto-filled from space rate</p>
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
                        onChange={handleFormChange}
                        disabled={isSubmitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                      />
                    </div>
                  </div>

                  {/* Terms and Conditions */}
                  <div className="form-section">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Terms and Conditions
                    </label>
                    <textarea
                      name="terms"
                      rows={6}
                      value={formData.terms}
                      onChange={handleFormChange}
                      disabled={isSubmitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none disabled:bg-gray-100"
                      placeholder="Enter contract terms and conditions..."
                    />
                  </div>

                  {/* Actions */}
                  <div className="modal-actions">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={isSubmitting}
                      className="action-secondary rounded-lg border px-4 py-2 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="action-primary rounded-lg border px-5 py-2.5 font-medium disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Saving...' : editingContractId ? 'Update Contract' : 'Create Contract'}
                    </button>
                  </div>
                </form>
              )}
            </div>
            </div>
          </>
        )}

        {contractToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900">Delete Contract?</h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Delete <span className="font-semibold text-gray-900">{contractToDelete.contractNumber || contractToDelete.contract_number}</span>? This action cannot be undone.
              </p>
              <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
                <button type="button" onClick={() => setContractToDelete(null)} disabled={deletingId !== null} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={confirmDeleteContract} disabled={deletingId !== null} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {deletingId !== null ? 'Deleting...' : 'Delete Contract'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

export default function ContractsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-12 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-96 bg-slate-200 rounded-lg animate-pulse" />
      </div>
    }>
      <ContractsPageContent />
    </Suspense>
  )
}

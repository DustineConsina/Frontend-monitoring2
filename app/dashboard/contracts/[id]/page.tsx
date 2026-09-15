'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { Contract } from '@/types'

export default function ContractDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const contractId = params.id as string
  const [contract, setContract] = useState<Contract | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTerminateModal, setShowTerminateModal] = useState(false)
  const [isTerminating, setIsTerminating] = useState(false)
  const [terminationReason, setTerminationReason] = useState('')
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [isRenewing, setIsRenewing] = useState(false)
  const [renewalDuration, setRenewalDuration] = useState('12')
  const [renewalRent, setRenewalRent] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Safe date formatter
  const formatDate = (dateInput: any): string => {
    try {
      if (!dateInput) return 'N/A'
      
      const date = new Date(dateInput)
      if (isNaN(date.getTime())) {
        return 'Invalid Date'
      }
      return date.toLocaleDateString()
    } catch (e) {
      console.warn('Error formatting date:', dateInput, e)
      return 'Invalid Date'
    }
  }

  useEffect(() => {
    fetchContract()
  }, [contractId])

  const fetchContract = async () => {
    try {
      const response = await apiClient.getContract(contractId)
      
      console.log('🔍 RAW Contract Response:', response)
      console.log('   Response.data:', response.data)
      console.log('   Response.data type:', typeof response.data)
      console.log('   Is array?', Array.isArray(response.data))
      
      // API structure: {success: true, data: {contract object}}
      let contractData = response.data
      
      if (!contractData) {
        console.error('❌ No data in response!')
        console.log('   Keys in response:', Object.keys(response))
        throw new Error('Invalid API response: missing data field')
      }
      
      console.log('📋 ContractData keys:', Object.keys(contractData))
      console.log('   tenant:', contractData.tenant, '| Type:', typeof contractData.tenant)
      console.log('   rentalSpace:', contractData.rentalSpace, '| Type:', typeof contractData.rentalSpace)
      console.log('   rental_space:', contractData.rental_space, '| Type:', typeof contractData.rental_space)
      console.log('   Monthly Rent Debug:')
      console.log('     monthlyRental:', contractData.monthlyRental)
      console.log('     monthly_rental:', contractData.monthly_rental)
      console.log('     monthlyRent:', contractData.monthlyRent)
      console.log('     monthly_rent:', contractData.monthly_rent)
      
      // Ensure arrays are arrays
      if (contractData.payments && !Array.isArray(contractData.payments)) {
        contractData.payments = [contractData.payments]
      }
      
      // Map numeric fields with proper fallbacks for both camelCase and snake_case
      const monthlyRentValue = parseFloat(String(contractData.monthlyRental || contractData.monthly_rental || contractData.monthlyRent || 0))
      const securityDepositValue = parseFloat(String(contractData.depositAmount || contractData.deposit_amount || contractData.securityDeposit || 0))
      const interestRateValue = parseFloat(String(contractData.interestRate || contractData.interest_rate || 0))
      
      // Map all fields including date fields and rental space with proper fallbacks
      const mappedContract = {
        ...contractData,
        // Numeric fields - converted to proper numbers
        monthlyRent: monthlyRentValue,
        monthlyRental: monthlyRentValue,
        depositAmount: securityDepositValue,
        securityDeposit: securityDepositValue,
        interestRate: interestRateValue,
        // Date fields - with fallbacks
        startDate: contractData.startDate || contractData.start_date,
        endDate: contractData.endDate || contractData.end_date,
        // String identifiers
        contractNumber: contractData.contractNumber || contractData.contract_number,
        // Nested objects - with fallbacks
        rentalSpace: contractData.rentalSpace || contractData.rental_space,
        tenant: contractData.tenant || contractData.renter,
      }
      
      console.log('✅ Mapped Contract:', mappedContract)
      console.log('   Tenant in mapped:', mappedContract.tenant)
      console.log('   RentalSpace in mapped:', mappedContract.rentalSpace)
      console.log('   Monthly Rent Values in Mapped:')
      console.log('     monthlyRent:', mappedContract.monthlyRent)
      console.log('     monthlyRental:', mappedContract.monthlyRental)
      console.log('     monthly_rental:', mappedContract.monthly_rental)
      console.log('     monthly_rent:', mappedContract.monthly_rent)
      console.log('     Calculated monthlyRentValue:', monthlyRentValue)
      setContract(mappedContract)
    } catch (err: any) {
      console.error('❌ Error loading contract:', err)
      alert(err.message || 'Failed to load contract')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTerminate = async () => {
    if (!terminationReason.trim()) {
      alert('Please provide a reason for termination')
      return
    }
    setIsTerminating(true)
    try {
      await apiClient.terminateContract(contractId, terminationReason)
      setShowTerminateModal(false)
      setTerminationReason('')
      router.push('/dashboard/contracts')
    } catch (err: any) {
      alert(err.message || 'Failed to terminate contract')
      setIsTerminating(false)
    }
  }

  const handleRenew = async () => {
    if (!renewalDuration || parseInt(renewalDuration) < 1) {
      alert('Please specify a valid duration (minimum 1 month)')
      return
    }
    setIsRenewing(true)
    try {
      const renewalData: { duration_months: number; monthly_rental?: number } = {
        duration_months: parseInt(renewalDuration),
      }

      if (renewalRent.trim()) {
        const monthlyRental = Number(renewalRent)
        if (!Number.isFinite(monthlyRental) || monthlyRental <= 0) {
          throw new Error('Monthly rent must be greater than zero')
        }
        renewalData.monthly_rental = monthlyRental
      }

      const renewalResult = await apiClient.renewContract(contractId, renewalData)
      setIsRenewing(false)
      setShowRenewModal(false)
      setRenewalDuration('12')
      setRenewalRent('')

      const newContractId = renewalResult?.data?.id || renewalResult?.data?.contract?.id
      router.push(newContractId ? `/dashboard/contracts/${newContractId}` : '/dashboard/contracts')
    } catch (err: any) {
      alert(err.message || 'Failed to renew contract')
      setIsRenewing(false)
    }
  }

  const handleDownloadLease = async () => {
    if (!contract) return
    
    setIsDownloading(true)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/contracts/${encodeURIComponent(String(contract.id))}/lease`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response status:', response.status)
        console.error('Response body:', errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `lease-${contract.contractNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Download error:', err)
      alert(`Failed to download lease PDF: ${err.message}`)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDelete = async () => {
    const status = String(contract?.status || '').toLowerCase()
    if (!contract || !['terminated', 'expired'].includes(status)) {
      alert('Only terminated or expired contracts can be deleted.')
      return
    }
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!contract) return

    setIsDeleting(true)
    try {
      await apiClient.deleteContract(contractId)
      setShowDeleteModal(false)
      router.push('/dashboard/contracts')
    } catch (err: any) {
      alert(err.message || 'Failed to delete contract')
      setIsDeleting(false)
    }

      {showDeleteModal && contract && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900">Delete Contract?</h3>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Delete <span className="font-semibold text-gray-900">{contract.contractNumber}</span>? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button type="button" onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="action-secondary rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm">
                Cancel
              </button>
              <button type="button" onClick={confirmDelete} disabled={isDeleting} className="action-danger rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm">
                {isDeleting ? 'Deleting...' : 'Delete Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
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

  if (error || !contract) {
    return (
      <ProtectedRoute>
        <div className="space-y-6">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-sm text-red-700">{error || 'Contract not found'}</p>
          </div>
          <Link
            href="/dashboard/contracts"
            className="back-action"
          >
            Back to Contracts
          </Link>
        </div>
      </ProtectedRoute>
    )
  }

  const getStatusBadge = (status: string) => {
    const upperStatus = status?.toUpperCase() || 'PENDING'
    const colors = {
      ACTIVE: 'bg-green-100 text-green-800',
      FOR_RENEWAL: 'bg-indigo-100 text-indigo-800 font-bold',
      EXPIRED: 'bg-orange-100 text-orange-800',
      TERMINATED: 'bg-red-100 text-red-800',
      PENDING: 'bg-blue-100 text-blue-800',
      RENEWED: 'bg-indigo-100 text-indigo-800',
    }
    return colors[upperStatus as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Contract Details</h2>
            <p className="text-gray-600">{contract.contractNumber}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/dashboard/contracts"
              className="back-action"
            >
              Back
            </Link>
            <Link
              href={`/dashboard/contracts/${contractId}/edit`}
              className="action-edit inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 font-medium"
            >
              Edit
            </Link>
            <button
              onClick={handleDownloadLease}
              disabled={isDownloading}
              className="action-download inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 font-medium"
            >
              {isDownloading ? (
                <>
                  <span className="loading-spinner" aria-hidden="true" />
                  Downloading...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Download Lease
                </>
              )}
            </button>
            {contract.status?.toLowerCase() === 'for_renewal' && (
              <button
                onClick={() => setShowRenewModal(true)}
                className="action-success inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 font-medium"
              >
                Renew
              </button>
            )}
            {['terminated', 'expired'].includes(String(contract.status || '').toLowerCase()) && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="action-danger inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 font-medium"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
            <button
              onClick={() => setShowTerminateModal(true)}
              className="action-danger inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 font-medium"
            >
              Terminate
            </button>
          </div>
        </div>

        {/* Contract Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contract Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contract Status</h3>
              <div className="flex items-center gap-4">
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusBadge(contract.status?.toUpperCase() || 'PENDING')}`}>
                  {(contract.status?.toUpperCase() || 'PENDING').replace('_', ' ')}
                </span>
                <div className="text-sm text-gray-600">
                  Created on {formatDate(contract.createdAt)}
                </div>
              </div>
            </div>

            {/* Tenant Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tenant Information</h3>
              {contract.tenant && (typeof contract.tenant === 'object' && Object.keys(contract.tenant).length > 0) ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xl">👤</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {contract.tenant?.user?.name 
                          || contract.tenant?.name 
                          || contract.tenant?.contact_person 
                          || contract.tenant?.contactPerson 
                          || contract.tenant?.businessName 
                          || contract.tenant?.business_name
                          || 'Unnamed Tenant'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {contract.tenant?.user?.email 
                          || contract.tenant?.email 
                          || 'No email'}
                      </p>
                    </div>
                  </div>
                  {(contract.tenant?.user?.phone || contract.tenant?.phone || contract.tenant?.contactNumber || contract.tenant?.contact_number) && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Phone:</span> {contract.tenant?.user?.phone || contract.tenant?.phone || contract.tenant?.contactNumber || contract.tenant?.contact_number}
                    </div>
                  )}
                  {(contract.tenant?.user?.address || contract.tenant?.address || contract.tenant?.business_address) && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Address:</span> {contract.tenant?.user?.address || contract.tenant?.address || contract.tenant?.business_address}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4 space-y-2">
                  <p className="text-yellow-800 font-medium">
                    ⚠️ Tenant data not available
                  </p>
                  {contract.tenantId && (
                    <p className="text-sm text-yellow-700">
                      Tenant ID {contract.tenantId} is referenced by this contract, but the tenant record could not be found in the system.
                    </p>
                  )}
                  {!contract.tenantId && (
                    <p className="text-sm text-yellow-700">
                      This contract does not have a tenant assigned.
                    </p>
                  )}
                  <p className="text-xs text-yellow-600 mt-2">Please contact the administrator to assign or create the tenant account.</p>
                </div>
              )}
            </div>

            {/* Business Details */}
            {contract.tenant && (typeof contract.tenant === 'object' && Object.keys(contract.tenant).length > 0) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Details</h3>
                <div className="space-y-3">
                  {(contract.tenant.businessName || contract.tenant.business_name) && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Business Name:</span>
                      <span className="font-medium">{contract.tenant.businessName || contract.tenant.business_name}</span>
                    </div>
                  )}
                  {(contract.tenant.businessType || contract.tenant.business_type) && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Business Type:</span>
                      <span className="font-medium">{contract.tenant.businessType || contract.tenant.business_type}</span>
                    </div>
                  )}
                  {(contract.tenant.businessPermitNumber || contract.tenant.business_permit_number || contract.tenant.tin) && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Business Permit Number:</span>
                      <span className="font-medium">{contract.tenant.businessPermitNumber || contract.tenant.business_permit_number || contract.tenant.tin}</span>
                    </div>
                  )}
                  {(contract.tenant.businessAddress || contract.tenant.business_address) && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Business Address:</span>
                      <span className="font-medium">{contract.tenant.businessAddress || contract.tenant.business_address}</span>
                    </div>
                  )}
                  {(contract.tenant.contactNumber || contract.tenant.contact_number) && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Contact Number:</span>
                      <span className="font-medium">{contract.tenant.contactNumber || contract.tenant.contact_number}</span>
                    </div>
                  )}
                  {!(contract.tenant.businessName || contract.tenant.business_name) && !(contract.tenant.businessType || contract.tenant.business_type) && !(contract.tenant.businessPermitNumber || contract.tenant.business_permit_number || contract.tenant.tin) && !(contract.tenant.businessAddress || contract.tenant.business_address) && (
                    <p className="text-gray-500 text-sm italic">No additional business details available</p>
                  )}
                </div>
              </div>
            )}

            {/* Rental Space Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Rental Space</h3>
              {(contract.rentalSpace || contract.rental_space) && (typeof (contract.rentalSpace || contract.rental_space) === 'object') ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Space Code:</span>
                    <span className="font-medium">
                      {(contract.rentalSpace || contract.rental_space)?.spaceCode 
                        || (contract.rentalSpace || contract.rental_space)?.space_code 
                        || (contract.rentalSpace || contract.rental_space)?.spaceNumber 
                        || 'Not assigned'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Space Name:</span>
                    <span className="font-medium">
                      {(contract.rentalSpace || contract.rental_space)?.name 
                        || 'Not assigned'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium">
                      {(contract.rentalSpace || contract.rental_space)?.type?.name 
                        || (contract.rentalSpace || contract.rental_space)?.spaceType 
                        || (contract.rentalSpace || contract.rental_space)?.space_type 
                        || 'Not specified'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Space Size:</span>
                    <span className="font-medium">
                      {(contract.rentalSpace || contract.rental_space)?.sizeSqm 
                        || (contract.rentalSpace || contract.rental_space)?.squareMeters 
                        || (contract.rentalSpace || contract.rental_space)?.size_sqm 
                        || 'Not specified'} m²
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4 space-y-2">
                  <p className="text-yellow-800 font-medium">
                    ⚠️ Rental space data not available
                  </p>
                  {(contract.rentalSpaceId || contract.rental_space_id) && (
                    <p className="text-sm text-yellow-700">
                      Rental Space ID {contract.rentalSpaceId || contract.rental_space_id} is referenced by this contract, but the space record could not be found in the system.
                    </p>
                  )}
                  {!(contract.rentalSpaceId || contract.rental_space_id) && (
                    <p className="text-sm text-yellow-700">
                      This contract does not have a rental space assigned.
                    </p>
                  )}
                  <p className="text-xs text-yellow-600 mt-2">Please contact the administrator to assign a rental space to this contract.</p>
                </div>
              )}
            </div>

            {/* Terms and Conditions */}
            {contract.terms && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Terms and Conditions</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{contract.terms}</p>
              </div>
            )}

            {/* Payment Schedule */}
            {contract.payments && contract.payments.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Schedule</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Payment #</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Billing Period</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Due Date</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount Due</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Interest (3%)</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Total Amount</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount Paid</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contract.payments.map((payment: any) => (
                        <tr key={payment.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{payment.paymentNumber || payment.payment_number || 'N/A'}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatDate(payment.billingPeriodStart || payment.billing_period_start)} - {formatDate(payment.billingPeriodEnd || payment.billing_period_end)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatDate(payment.dueDate || payment.due_date)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            ₱{(parseFloat(payment.amountDue || payment.amount_due) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-red-600">
                            ₱{(parseFloat(payment.interestAmount || payment.interest_amount) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-blue-600">
                            ₱{(parseFloat(payment.totalAmount || payment.total_amount) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-green-600">
                            ₱{(parseFloat(payment.amountPaid || payment.amount_paid) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              (payment.status || '').toLowerCase() === 'paid' 
                                ? 'bg-green-100 text-green-800'
                                : (payment.status || '').toLowerCase() === 'overdue'
                                ? 'bg-red-100 text-red-800'
                                : (payment.status || '').toLowerCase() === 'partial'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {(payment.status || 'pending').toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contract Period */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contract Period</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Start Date</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(contract.startDate || contract.start_date)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">End Date</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(contract.endDate || contract.end_date)}
                  </p>
                </div>
              </div>
            </div>

            {/* Financial Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Details</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Monthly Rent</p>
                  <p className="text-xl font-bold text-blue-600">
                    ₱{(contract.monthlyRental || contract.monthlyRent || contract.monthly_rental || 0).toLocaleString()}
                  </p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm text-gray-600">Interest (3%)</p>
                  <p className="text-lg font-semibold text-red-600">
                    ₱{((contract.monthlyRental || contract.monthlyRent || contract.monthly_rental || 0) * 0.03).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </p>
                </div>
                <div className="border-t pt-3 bg-blue-50 -mx-6 -mb-6 px-6 py-3 rounded-b-lg">
                  <p className="text-sm font-semibold text-gray-700">Total Monthly Charge</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ₱{((contract.monthlyRental || contract.monthlyRent || contract.monthly_rental || 0) * 1.03).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </p>
                </div>
                {(contract.depositAmount || contract.securityDeposit || contract.deposit_amount || 0) > 0 && (
                  <div className="pt-2">
                    <p className="text-sm text-gray-600">Security Deposit</p>
                    <p className="font-medium text-gray-900">
                      ₱{(contract.depositAmount || contract.securityDeposit || contract.deposit_amount || 0).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terminate Contract Modal */}
      {showTerminateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Terminate Contract?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to terminate contract <span className="font-semibold">{contract?.contractNumber}</span>? This action cannot be undone.
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Termination Reason</label>
              <textarea
                value={terminationReason}
                onChange={(e) => setTerminationReason(e.target.value)}
                disabled={isTerminating}
                placeholder="Enter the reason for termination..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTerminateModal(false)
                  setTerminationReason('')
                }}
                disabled={isTerminating}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleTerminate}
                disabled={isTerminating || !terminationReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isTerminating ? 'Terminating...' : 'Terminate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Contract Modal */}
      {showRenewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Renew Contract?</h3>
            <p className="text-gray-600 mb-6">
              Renew contract <span className="font-semibold">{contract?.contractNumber}</span> for {contract?.tenant?.firstName}.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (Months) *</label>
                <select
                  value={renewalDuration}
                  onChange={(e) => setRenewalDuration(e.target.value)}
                  disabled={isRenewing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="1">1 Month</option>
                  <option value="3">3 Months</option>
                  <option value="6">6 Months</option>
                  <option value="12">1 Year</option>
                  <option value="24">2 Years</option>
                  <option value="36">3 Years</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Monthly Rent (Optional)</label>
                <div className="flex items-center">
                  <span className="text-gray-700 mr-2">₱</span>
                  <input
                    type="number"
                    value={renewalRent}
                    onChange={(e) => setRenewalRent(e.target.value)}
                    disabled={isRenewing}
                    placeholder={`${contract?.monthlyRent || 0}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    min="0"
                    step="0.01"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Leave empty to keep current rate: ₱{(contract?.monthlyRent || 0).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRenewModal(false)
                  setRenewalDuration('12')
                  setRenewalRent('')
                }}
                disabled={isRenewing}
                className="action-secondary flex-1 rounded-lg border px-4 py-2 font-medium disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleRenew}
                disabled={isRenewing}
                className="action-success flex-1 rounded-lg border px-4 py-2 font-medium disabled:cursor-not-allowed"
              >
                {isRenewing ? 'Renewing...' : 'Renew'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

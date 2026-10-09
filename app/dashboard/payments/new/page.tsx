'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { Contract } from '@/types'
import { showGlobalNotice } from '@/lib/global-notice'
import { getPaymentProviders, getProviderValue, PAYMENT_METHODS, requiresPaymentDetails } from '@/lib/payment-methods'

function getBillingPeriod(dueDate: string): { start: string; end: string } | null {
  const parts = dueDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null

  const [year, month, day] = parts
  const dueDateValue = new Date(year, month - 1, day)
  if (dueDateValue.getFullYear() !== year || dueDateValue.getMonth() !== month - 1 || dueDateValue.getDate() !== day) return null

  const endDate = new Date(year, month - 1, day)
  const previousMonth = new Date(year, month - 2, 1)
  const lastDayOfPreviousMonth = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0).getDate()
  const startDate = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), Math.min(day, lastDayOfPreviousMonth))

  const formatDate = (date: Date) => {
    const dateYear = date.getFullYear()
    const dateMonth = String(date.getMonth() + 1).padStart(2, '0')
    const dateDay = String(date.getDate()).padStart(2, '0')
    return `${dateYear}-${dateMonth}-${dateDay}`
  }

  return { start: formatDate(startDate), end: formatDate(endDate) }
}

function getNextContractDueDate(contract: any, payments: any[]): string {
  const startDateValue = String(contract?.startDate || contract?.start_date || '').slice(0, 10)
  const startDate = new Date(`${startDateValue}T00:00:00`)
  if (Number.isNaN(startDate.getTime())) return new Date().toISOString().slice(0, 10)

  const contractPayments = payments
    .filter((payment) => String(payment.contractId || payment.contract_id || payment.contract?.id) === String(contract.id))
    .map((payment) => String(payment.dueDate || payment.due_date || '').slice(0, 10))
    .filter((dueDate) => dueDate)

  if (contractPayments.length === 0) return startDateValue

  const latestDueDate = contractPayments.sort().at(-1) || startDateValue
  const latestDate = new Date(`${latestDueDate}T00:00:00`)
  const nextMonth = new Date(latestDate.getFullYear(), latestDate.getMonth() + 1, 1)
  const lastDayOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()
  nextMonth.setDate(Math.min(latestDate.getDate(), lastDayOfNextMonth))
  return nextMonth.toISOString().slice(0, 10)
}

function displayDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NewPaymentPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [existingPayments, setExistingPayments] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [contractSearchTerm, setContractSearchTerm] = useState('')
  const [isContractDropdownOpen, setIsContractDropdownOpen] = useState(false)

  const [formData, setFormData] = useState({
    contractId: '',
    amount: '',
    dueDate: '',
    paidDate: '',
    paymentMethod: 'cash',
    paymentProvider: '',
    paymentProviderOther: '',
    referenceNumber: '',
    notes: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      console.log('Fetching contracts...')
      // Fetch contracts
      const contractsDataResp = await apiClient.getContracts()
      console.log('Raw contracts response:', contractsDataResp)
      
      // Handle paginated response structure
      let contractsArray = []
      if (contractsDataResp.data?.data && Array.isArray(contractsDataResp.data.data)) {
        contractsArray = contractsDataResp.data.data
        console.log('Extracted from data.data (paginated):', contractsArray.length)
      } else if (contractsDataResp.data && Array.isArray(contractsDataResp.data)) {
        contractsArray = contractsDataResp.data
        console.log('Extracted from data (direct array):', contractsArray.length)
      } else if (Array.isArray(contractsDataResp)) {
        contractsArray = contractsDataResp
        console.log('Extracted from root (direct array):', contractsArray.length)
      }
      
      // Log first contract to see structure
      if (contractsArray.length > 0) {
        const firstContract = contractsArray[0] as any
        console.log('First contract structure:', {
          id: firstContract.id,
          contract_number: firstContract.contract_number,
          contractNumber: firstContract.contractNumber,
          monthly_rental: firstContract.monthly_rental,
          monthlyRental: firstContract.monthlyRental,
          rentalSpace: firstContract.rentalSpace,
          rental_space: firstContract.rental_space,
          allKeys: Object.keys(firstContract),
          fullObject: JSON.stringify(firstContract, null, 2)
        })
      }
      
      // Existing contracts remain selectable so each monthly billing period can be recorded.
      const availableContracts = Array.isArray(contractsArray) ? contractsArray : []

      const paymentsDataResp = await apiClient.getPayments()
      const paymentsArray = paymentsDataResp.data?.data || paymentsDataResp.data || paymentsDataResp

      console.log('Available contracts:', availableContracts.map(c => ({
        id: c.id,
        contract_number: c.contract_number,
        monthly_rental: c.monthly_rental
      })))
      
      setContracts(availableContracts)
      setExistingPayments(Array.isArray(paymentsArray) ? paymentsArray : [])
    } catch (err: any) {
      console.error('Error loading contracts:', err)
      alert(err.message || 'Failed to load contracts')
    } finally {
      setLoadingData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Get the selected contract to extract tenant_id
      const selectedContract = contracts.find((c) => c.id && parseInt(c.id) === parseInt(formData.contractId))
      
      if (!selectedContract) {
        alert('Please select a valid contract')
        setIsLoading(false)
        return
      }

      const billingPeriod = getBillingPeriod(formData.dueDate)
      const duplicatePaidPayment = existingPayments.find((payment) => {
        const paymentContractId = payment.contractId || payment.contract_id || payment.contract?.id
        const paymentPeriodStart = String(payment.billingPeriodStart || payment.billing_period_start || getBillingPeriod(payment.dueDate || payment.due_date || '')?.start || '').slice(0, 10)
        return String(paymentContractId) === String(selectedContract.id) &&
          billingPeriod?.start === paymentPeriodStart
      })

      if (duplicatePaidPayment) {
        showGlobalNotice('Payment already recorded', `The billing period ${displayDate(billingPeriod!.start)} - ${displayDate(billingPeriod!.end)} already has a payment recorded. A duplicate payment cannot be added.`)
        setIsLoading(false)
        return
      }

      const paymentProvider = getProviderValue(formData.paymentProvider, formData.paymentProviderOther)
      if (formData.paidDate && requiresPaymentDetails(formData.paymentMethod) && !paymentProvider) {
        showGlobalNotice('Payment provider required', 'Select a payment provider before recording this payment.')
        setIsLoading(false)
        return
      }
      if (formData.paidDate && requiresPaymentDetails(formData.paymentMethod) && !formData.referenceNumber.trim()) {
        showGlobalNotice('Reference number required', `Reference number is required for ${formData.paymentMethod === 'e_wallet' ? 'E-Wallet' : 'Bank Transfer'} payments.`)
        setIsLoading(false)
        return
      }

      // Map form data to backend expected format with proper snake_case field naming
      const paymentData: any = {
        contract_id: parseInt(formData.contractId),
        tenant_id: selectedContract.tenant?.id || selectedContract.tenant_id,
        amount_due: parseFloat(formData.amount),
        due_date: formData.dueDate,
        remarks: formData.notes,
      }

      if (formData.paidDate) {
        paymentData.payment_method = formData.paymentMethod
        paymentData.payment_provider = paymentProvider || null
        paymentData.reference_number = formData.referenceNumber.trim() || null
      }

      if (billingPeriod) {
        paymentData.billing_period_start = billingPeriod.start
        paymentData.billing_period_end = billingPeriod.end
      }

      // Only add payment_date if provided
      if (formData.paidDate) {
        paymentData.payment_date = formData.paidDate
      }

      console.log('Submitting payment:', paymentData)
      await apiClient.createPayment(paymentData)
      setFormData({
        contractId: '',
        amount: '',
        dueDate: '',
        paidDate: '',
        paymentMethod: 'cash',
        paymentProvider: '',
        paymentProviderOther: '',
        referenceNumber: '',
        notes: '',
      })
      setContractSearchTerm('')
      setIsContractDropdownOpen(false)
      router.push('/dashboard/payments')
    } catch (err: any) {
      showGlobalNotice('Payment could not be recorded', err.message || 'Please check the payment details and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (e.target.name === 'paymentMethod' && e.target.value === 'cash') {
      setFormData((current) => ({ ...current, paymentMethod: 'cash', paymentProvider: '', paymentProviderOther: '', referenceNumber: '' }))
      return
    }
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleContractChange = (contractId: string) => {
    console.log('=== CONTRACT SELECTION ===')
    console.log('Selected contract ID:', contractId)
    
    // Auto-fill amount from contract
    const selectedContract = contracts.find((c) => c.id && c.id.toString() === contractId)
    
    console.log('Found contract:', selectedContract)
    console.log('Looking for monthly rental in:', {
      monthly_rental: (selectedContract as any)?.monthly_rental,
      monthlyRental: (selectedContract as any)?.monthlyRental,
      rentalSpace: (selectedContract as any)?.rentalSpace,
      rental_space: (selectedContract as any)?.rental_space,
    })
    
    if (selectedContract) {
      const contract = selectedContract as any  // Cast to allow runtime exploration of all properties
      
      // Try multiple locations for monthly rental
      let monthlyRent = 0
      
      // 1. Direct on contract (snake_case from backend or camelCase from api-client)
      if (contract.monthlyRental) {
        monthlyRent = contract.monthlyRental
      } else if (contract.monthly_rental) {
        monthlyRent = contract.monthly_rental
      }
      // 2. Nested in rentalSpace relationship
      else if (contract.rentalSpace) {
        monthlyRent = contract.rentalSpace.monthly_rental || contract.rentalSpace.monthlyRental || contract.rentalSpace.base_rental_rate || contract.rentalSpace.baseRentalRate || 0
        console.log('Found rentalSpace, extracted monthly rental:', monthlyRent)
      }
      // 3. Nested in rental_space relationship (snake_case)
      else if (contract.rental_space) {
        monthlyRent = contract.rental_space.monthly_rental || contract.rental_space.monthlyRental || contract.rental_space.base_rental_rate || contract.rental_space.baseRentalRate || 0
        console.log('Found rental_space, extracted monthly rental:', monthlyRent)
      }
      
      
      console.log('Located monthly_rent:', monthlyRent)
      
      // Parse and validate
      let numericRent = 0
      if (monthlyRent) {
        try {
          numericRent = parseFloat(String(monthlyRent))
          if (isNaN(numericRent)) {
            numericRent = 0
          }
        } catch (e) {
          console.error('Error parsing monthly rent:', e)
          numericRent = 0
        }
      }
      
      const amountString = numericRent > 0 ? numericRent.toFixed(2) : '0.00'
      
      console.log('Final amount to fill:', {
        numericRent,
        amountString,
        willShow: numericRent > 0 ? `₱${numericRent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Still 0'
      })
      
      setFormData({
        ...formData,
        contractId,
        amount: amountString,
        dueDate: getNextContractDueDate(selectedContract, existingPayments),
      })
    } else {
      console.warn('Contract not found in list')
      // If no contract selected, clear the form
      setFormData({
        ...formData,
        contractId,
        amount: '',
      })
    }
  }

  const searchableContracts = contracts.filter((contract) => {
    const contractNumber = String(contract.contractNumber || contract.contract_number || '').trim()
    const tenantName = String(
      contract.tenant?.user?.name ||
      contract.tenant?.name ||
      contract.tenant?.contact_person ||
      contract.tenant?.contactPerson ||
      contract.tenant?.business_name ||
      contract.tenant?.businessName ||
      ''
    ).trim()
    const query = contractSearchTerm.trim().toLowerCase()

    if (!query) return true

    return `${tenantName} ${contractNumber}`.toLowerCase().includes(query)
  })

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Record Payment</h2>
            <p className="text-gray-600">Record a new payment for a contract</p>
          </div>
          <Link
            href="/dashboard/payments"
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
              {/* Contract Selection */}
              <div className="form-section">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={contractSearchTerm}
                    onFocus={() => setIsContractDropdownOpen(true)}
                    onChange={(event) => {
                      setContractSearchTerm(event.target.value)
                      setIsContractDropdownOpen(true)
                    }}
                    placeholder="Search tenant or contract number"
                    className="w-full px-4 py-2 pr-9 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required={!formData.contractId}
                  />
                  <button
                    type="button"
                    aria-label={isContractDropdownOpen ? 'Close contract list' : 'Open contract list'}
                    aria-expanded={isContractDropdownOpen}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setIsContractDropdownOpen((isOpen) => !isOpen)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                  >
                    <span className={isContractDropdownOpen ? 'inline-block rotate-180' : 'inline-block'}>⌄</span>
                  </button>
                  {isContractDropdownOpen && (
                    <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      {searchableContracts.length > 0 ? searchableContracts.map((contract) => {
                        const contractNumber = contract.contractNumber || contract.contract_number || `Contract ${contract.id}`
                        const tenantName = contract.tenant?.user?.name || contract.tenant?.contact_person || contract.tenant?.business_name || 'Unknown tenant'
                        return (
                          <button
                            key={contract.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              handleContractChange(String(contract.id))
                              setContractSearchTerm(`${tenantName} — ${contractNumber}`)
                              setIsContractDropdownOpen(false)
                            }}
                            className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50"
                          >
                            {tenantName} — {contractNumber}
                          </button>
                        )
                      }) : <p className="px-3 py-2 text-sm text-gray-500">No matching contracts</p>}
                    </div>
                  )}
                  <input type="hidden" name="contractId" value={formData.contractId} required />
                </div>
              </div>

              {/* Payment Details */}
              <div className="form-section grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (₱) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="amount"
                    value={formData.amount ? `₱${parseFloat(formData.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                    readOnly
                    disabled
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-blue-50 text-gray-800 cursor-not-allowed outline-none font-semibold text-lg text-center"
                    placeholder="Select contract to see amount"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Amount is fixed to the contract&apos;s monthly rental. Select a contract above to auto-fill.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleChange}
                    disabled={!formData.paidDate}
                    className="w-full appearance-none px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="form-section grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paid Date (leave empty if not paid yet)
                  </label>
                  <input
                    type="date"
                    name="paidDate"
                    value={formData.paidDate}
                    onChange={(event) => {
                      handleChange(event)
                      if (!event.target.value) setFormData((current) => ({ ...current, paymentMethod: 'cash', paymentProvider: '', paymentProviderOther: '', referenceNumber: '' }))
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{formData.paymentMethod === 'e_wallet' ? 'E-Wallet' : 'Bank'} Provider</label>
                      <select name="paymentProvider" value={formData.paymentProvider} onChange={(event) => {
                        handleChange(event)
                        setFormData((current) => ({ ...current, paymentProviderOther: '' }))
                      }} disabled={!formData.paidDate || formData.paymentMethod === 'cash'} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100">
                        <option value="">Select provider</option>
                        {getPaymentProviders(formData.paymentMethod).map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                      </select>
                      {formData.paymentProvider === 'Other' && <input name="paymentProviderOther" value={formData.paymentProviderOther} onChange={handleChange} placeholder="Specify provider" disabled={!formData.paidDate} className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100" />}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Reference Number</label>
                      <input name="referenceNumber" value={formData.referenceNumber} onChange={handleChange} disabled={!formData.paidDate || formData.paymentMethod === 'cash'} required={Boolean(formData.paidDate && formData.paymentMethod !== 'cash')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100" />
                    </div>
                </>

                <div className="md:col-span-2 rounded-md border border-[#e8eaf1] bg-[#fafaff] p-4">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9aa1b3]">Billing Period</p>
                  {getBillingPeriod(formData.dueDate) ? (
                    <p className="text-sm font-semibold text-[#28334b]">
                      {displayDate(getBillingPeriod(formData.dueDate)!.start)} - {displayDate(getBillingPeriod(formData.dueDate)!.end)}
                    </p>
                  ) : (
                    <p className="text-xs text-[#9aa1b3]">Select a due date to calculate the monthly billing period.</p>
                  )}
                  <p className="mt-1 text-[11px] text-[#9aa1b3]">Each payment covers one month from the due date to the same day next month.</p>
                </div>
              </div>

              {/* Notes */}
              <div className="form-section">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  placeholder="Payment notes or remarks..."
                />
              </div>

              {/* Action Buttons */}
              <div className="form-actions flex gap-2 justify-end">
                <Link
                  href="/dashboard/payments"
                  title="Cancel"
                  className="px-4 py-2 flex items-center justify-center border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isLoading}
                  title="Record Payment"
                  className="px-5 py-2.5 flex items-center justify-center bg-[#5148e5] text-white rounded-md hover:bg-[#4038c7] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Saving...' : 'Record'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

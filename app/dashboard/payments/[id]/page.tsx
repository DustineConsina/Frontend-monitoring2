'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import apiClient from '@/lib/api-client'
import { Payment, DemandLetter } from '@/types'
import { PAYMENT_METHODS, getPaymentProviders, requiresPaymentDetails } from '@/lib/payment-methods'
import { statusColorClass } from '@/lib/status-colors'

export default function PaymentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const paymentId = params.id as string

  const [payment, setPayment] = useState<Payment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(searchParams.get('edit') === 'true')
  const [isUpdating, setIsUpdating] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({
    amount_to_pay: '',
    payment_method: '',
    payment_provider: '',
    reference_number: '',
    paid_date: '',
    remarks: '',
  })

  // Only cashiers can record and edit payments
  const canEditPayments = user?.role && user.role.toUpperCase() === 'CASHIER'

  const getNewTransactionForm = () => ({
    amount_to_pay: '',
    payment_method: '',
    payment_provider: '',
    reference_number: '',
    paid_date: '',
    remarks: '',
  })

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

  const parseCurrencyValue = (value: unknown, fallback = 0): number => {
    if (value === null || value === undefined || value === '') return fallback
    if (typeof value === 'number' && Number.isFinite(value)) return value

    const text = String(value).trim()
    if (!text) return fallback

    const normalized = text.startsWith('(') && text.endsWith(')') ? `-${text.slice(1, -1)}` : text
    const cleaned = normalized.replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, '').replace(/,/g, '')
    const amount = Number.parseFloat(cleaned)

    return Number.isFinite(amount) ? amount : fallback
  }

  useEffect(() => {
    fetchPayment()
  }, [paymentId])

  const fetchPayment = async () => {
    try {
      await apiClient.post('/payments/calculate-overdue')

      // First try to get payment details with contract data from the specific endpoint
      try {
        const response = await apiClient.request<any>(`/payments/${paymentId}`)
        console.log('Full API response:', response)
        
        // Handle different response structures
        const paymentData = response.data?.data || response.data
        
        // If we still don't have payment data, try to extract it
        if (!paymentData || typeof paymentData !== 'object' || !paymentData.id) {
          console.error('Invalid payment data structure:', paymentData)
          throw new Error('Payment data not found in response')
        }
        
        console.log('Raw payment data from API:', paymentData)
        console.log('Financial fields from API:', {
          amount_due: paymentData.amount_due,
          interest_amount: paymentData.interest_amount,
          total_amount: paymentData.total_amount,
          amount_paid: paymentData.amount_paid,
          balance: paymentData.balance,
        })
        
        // Extract contract if available
        const contract = paymentData.contract || {}
        const monthlyRental = parseFloat(String(contract.monthlyRental || 0))
        
        // Calculate missing values - apiClient converts snake_case to camelCase, so only use camelCase keys
        const amountDue = parseCurrencyValue(paymentData.amountDue ?? paymentData.amount_due ?? monthlyRental, monthlyRental)
        const interestAmount = parseCurrencyValue(paymentData.interestAmount ?? paymentData.interest_amount ?? (amountDue * 0.03), amountDue * 0.03)
        const totalAmount = parseCurrencyValue(paymentData.totalAmount ?? paymentData.total_amount ?? (amountDue + interestAmount), amountDue + interestAmount)
        const amountPaid = parseCurrencyValue(paymentData.amountPaid ?? paymentData.amount_paid, 0)
        const balance = Math.max(0, parseCurrencyValue(paymentData.balance ?? (totalAmount - amountPaid), totalAmount - amountPaid))
        
        console.log('Calculated financial values:', { amountDue, interestAmount, totalAmount, amountPaid, balance })
        
        // Map the payment with all available fields
        const mappedPayment = {
          ...paymentData,
          id: paymentData.id || paymentId,
          amountDue,
          interestAmount,
          totalAmount,
          amountPaid,
          balance,
          dueDate: paymentData.dueDate || paymentData.due_date,
          billingPeriodStart: paymentData.billingPeriodStart || paymentData.billing_period_start,
          billingPeriodEnd: paymentData.billingPeriodEnd || paymentData.billing_period_end,
          paymentNumber: paymentData.paymentNumber || paymentData.payment_number,
          paymentMethod: paymentData.paymentMethod || paymentData.payment_method,
          referenceNumber: paymentData.referenceNumber || paymentData.reference_number,
          contract: contract,
          contractNumber: contract?.contractNumber || contract?.contract_number || paymentData.contractNumber || paymentData.contract_number,
        }
        
        console.log('Mapped payment:', mappedPayment)
        setPayment(mappedPayment)
        
        // Auto-open edit modal if edit query param is present
        if (searchParams.get('edit') === 'true') {
          setTimeout(() => {
            setEditFormData(getNewTransactionForm())
            setIsEditingModalOpen(true)
          }, 100)
        }
      } catch (specificError) {
        console.warn('Could not fetch specific payment, trying list endpoint:', specificError)
        
        // Fallback: get all payments and find the one we need
        const data = await apiClient.getPayments()
        const paymentsArray = data.data?.data || data.data || data
        const found = Array.isArray(paymentsArray) ? paymentsArray.find((p: Payment) => p.id && parseInt(p.id) === parseInt(paymentId)) : null
        
        if (found) {
          const monthlyRental = parseCurrencyValue(found.contract?.monthly_rental ?? found.contract?.monthlyRent ?? 0, 0)
          const amountDue = parseCurrencyValue(found.amountDue ?? found.amount_due ?? monthlyRental, monthlyRental)
          const interestAmount = parseCurrencyValue(found.interestAmount ?? found.interest_amount ?? (amountDue * 0.03), amountDue * 0.03)
          const totalAmount = parseCurrencyValue(found.totalAmount ?? found.total_amount ?? (amountDue + interestAmount), amountDue + interestAmount)
          const amountPaid = parseCurrencyValue(found.amountPaid ?? found.amount_paid, 0)
          const balance = Math.max(0, parseCurrencyValue(found.balance ?? (totalAmount - amountPaid), totalAmount - amountPaid))
          
          const mappedPayment = {
            ...found,
            amountDue,
            interestAmount,
            totalAmount,
            amountPaid,
            balance,
            dueDate: found.dueDate || found.due_date,
            billingPeriodStart: found.billingPeriodStart || found.billing_period_start,
            billingPeriodEnd: found.billingPeriodEnd || found.billing_period_end,
            paymentNumber: found.paymentNumber || found.payment_number,
            paymentMethod: found.paymentMethod || found.payment_method,
            referenceNumber: found.referenceNumber || found.reference_number,
          }
          setPayment(mappedPayment)
          
          if (searchParams.get('edit') === 'true') {
            setTimeout(() => {
              setEditFormData(getNewTransactionForm())
              setIsEditingModalOpen(true)
            }, 100)
          }
        } else {
          alert('Payment not found')
        }
      }
    } catch (err: any) {
      console.error('Failed to load payment:', err)
      alert(err.message || 'Failed to load payment')
    } finally {
      setIsLoading(false)
    }
  }

  const openEditModal = () => {
    // Only cashiers can edit
    if (!canEditPayments) {
      alert('Only cashiers can record payments')
      return
    }
    
    if (payment) {
      setEditFormData(getNewTransactionForm())
      setIsEditingModalOpen(true)
    }
  }

  const closeEditModal = () => {
    setIsEditingModalOpen(false)
    resetEditForm()
  }

  const resetEditForm = () => {
    setEditFormData({
      amount_to_pay: '',
      payment_method: '',
      payment_provider: '',
      reference_number: '',
      paid_date: '',
      remarks: '',
    })
  }

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name === 'payment_method' && value === 'cash') {
      setEditFormData((prev) => ({ ...prev, payment_method: 'cash', payment_provider: '', reference_number: '' }))
      return
    }
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleUpdatePayment = async () => {
    if (!payment) return
    
    if (!editFormData.amount_to_pay) {
      alert('Please enter an amount to pay')
      return
    }

    if (!editFormData.paid_date) {
      alert('Paid date is required to record a payment.')
      return
    }

    if (!editFormData.payment_method) {
      alert('Please select a payment method.')
      return
    }

    if (editFormData.payment_method !== 'cash' && !editFormData.payment_provider) {
      alert('Payment provider is required for non-cash payments.')
      return
    }

    if (editFormData.payment_method !== 'cash' && !editFormData.reference_number.trim()) {
      alert(`Reference number is required for ${editFormData.payment_method === 'e_wallet' ? 'E-Wallet' : 'Bank Transfer'} payments.`)
      return
    }

    const amountToPay = parseFloat(editFormData.amount_to_pay)
    const currentBalance = parseFloat(String(payment.balance || 0))

    // Check if amount exceeds remaining balance
    if (amountToPay > currentBalance) {
      alert(`Amount cannot exceed remaining balance of ₱${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      return
    }

    setIsUpdating(true)
    try {
      const result = await apiClient.post(`/payments/${payment.id}/record`, {
        amount: amountToPay,
        paid_date: editFormData.paid_date,
        payment_method: editFormData.payment_method,
        payment_provider: editFormData.payment_provider || null,
        reference_number: editFormData.reference_number.trim() || null,
        remarks: editFormData.remarks,
      })
      if (result.data) setPayment(result.data)
      closeEditModal()
      resetEditForm()
      setSuccessMessage(`Payment of ₱${amountToPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} recorded successfully!`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      console.error('Full error object:', err)
      const errorMsg = err.message || 'Failed to record payment'
      alert(errorMsg)
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    return statusColorClass(status)
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Payment Details</h2>
            <p className="text-gray-600">View payment information</p>
          </div>
          <div className="flex gap-2">
            {canEditPayments && (
              <button
                onClick={openEditModal}
                disabled={!!(payment && (payment.balance === 0 || parseFloat(String(payment.balance || 0)) === 0))}
                title={payment && (payment.balance === 0 || parseFloat(String(payment.balance || 0)) === 0) ? "This payment is already paid" : "Record a payment"}
                className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition ${payment && (payment.balance === 0 || parseFloat(String(payment.balance || 0)) === 0) ? 'cursor-not-allowed border-gray-300 bg-gray-200 text-gray-500' : 'action-edit'}`}
              >
                Edit Payment
              </button>
            )}
            <Link
              href="/dashboard/payments"
              title="Back to Payments"
              className="back-action"
            >
              Back to Payments
            </Link>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="loading-spinner" aria-hidden="true" />
              <p className="mt-4 text-gray-600">Loading payment details...</p>
            </div>
          </div>
        )}

        {/* Payment Details */}
        {!isLoading && payment && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Information */}
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Payment Number</label>
                <p className="text-gray-900 font-mono">{payment.paymentNumber || payment.payment_number}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
                <span
                  className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusBadge(
                    payment.status || 'pending'
                  )}`}
                >
                  {(payment.status || 'pending').toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Due Date</label>
                  <p className="text-gray-900">{formatDate(payment.dueDate || payment.due_date)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Payment Method</label>
                  <p className="text-gray-900">{(payment.paymentMethod || payment.payment_method || 'N/A').toUpperCase()}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Reference Number</label>
                <p className="text-gray-900">{payment.referenceNumber || payment.reference_number || 'N/A'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Remarks</label>
                <p className="text-gray-900">{payment.remarks || payment.notes || 'N/A'}</p>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-red-700">Balance Remaining</label>
                  <p className="font-bold text-2xl text-red-600">₱{(typeof payment?.balance === 'number' ? payment.balance : parseFloat(String(payment?.balance || 0))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="border-b pb-4">
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-600">Amount Due (Original)</label>
                    <p className="font-semibold text-gray-900">₱{(typeof payment?.amountDue === 'number' ? payment.amountDue : parseFloat(String(payment?.amountDue || 0))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="border-b pb-4">
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-600">Interest (3%)</label>
                    <p className="font-semibold text-blue-600">₱{(typeof payment?.interestAmount === 'number' ? payment.interestAmount : parseFloat(String(payment?.interestAmount || 0))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="border-b pb-4">
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-600">Total Amount Due</label>
                    <p className="font-semibold text-gray-900">₱{(typeof payment?.totalAmount === 'number' ? payment.totalAmount : parseFloat(String(payment?.totalAmount || 0))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="border-b pb-4">
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-600">Amount Paid</label>
                    <p className="font-semibold text-green-600">₱{(typeof payment?.amountPaid === 'number' ? payment.amountPaid : parseFloat(String(payment?.amountPaid || 0))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Transactions</h3>
              {(payment as any).transactions?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Transaction ID</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Paid Date</th>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2">Provider</th>
                        <th className="px-3 py-2">Reference</th>
                        <th className="px-3 py-2">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(payment as any).transactions.map((transaction: any) => (
                        <tr key={transaction.id}>
                          <td className="px-3 py-3 font-mono">#{transaction.id}</td>
                          <td className="px-3 py-3 font-semibold">₱{Number(transaction.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-3">{formatDate(transaction.paidDate || transaction.paid_date)}</td>
                          <td className="px-3 py-3">{String(transaction.paymentMethod || transaction.payment_method || '').replace('_', ' ').toUpperCase()}</td>
                          <td className="px-3 py-3">{transaction.paymentProvider || transaction.payment_provider || 'N/A'}</td>
                          <td className="px-3 py-3">{transaction.referenceNumber || transaction.reference_number || 'N/A'}</td>
                          <td className="px-3 py-3">{transaction.recorder?.name || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No payment transactions recorded yet.</p>
              )}
            </div>

            {/* Demand Letters Section */}
            {payment.demandLetters && payment.demandLetters.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Demand Letters</h3>
                <div className="space-y-3">
                  {payment.demandLetters.map((letter: any) => (
                    <div
                      key={letter.id}
                      className="border-l-4 border-red-500 bg-red-50 p-4 rounded flex items-center justify-between hover:bg-red-100 transition"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{letter.demandNumber || letter.demand_number}</p>
                        <p className="text-sm text-gray-600">
                          Issued: {new Date(letter.issuedDate || letter.issued_date).toLocaleDateString()} | 
                          Due: {new Date(letter.dueDate || letter.due_date).toLocaleDateString()}
                        </p>
                        <p className="text-sm font-semibold text-red-700 mt-1">
                          Amount Demanded: ₱{(letter.totalAmountDemanded || letter.total_amount_demanded || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <span className="text-xs inline-block mt-2 px-2 py-1 bg-red-200 text-red-800 rounded">
                          {(letter.status || 'issued').toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => apiClient.downloadDemandLetter(letter.id)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium whitespace-nowrap ml-4"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contract & Tenant Information */}
            <div className="bg-white rounded-lg shadow p-6 space-y-4 lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contract & Tenant Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Contract Number</label>
                  <p className="text-gray-900 font-mono">{payment.contract?.contractNumber || payment.contract?.contract_number || 'N/A'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Contract Status</label>
                  <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusBadge(payment.contract?.status || 'pending')}`}>
                    {(payment.contract?.status || 'N/A').replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Tenant</label>
                  <p className="text-gray-900">{payment.tenant?.user?.name || payment.tenant?.contactPerson || payment.tenant?.contact_person || payment.tenant?.businessName || payment.tenant?.business_name || 'N/A'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Rental Space</label>
                  <p className="text-gray-900">
                    {(() => {
                      const rentalSpace = payment.contract?.rentalSpace || payment.contract?.rental_space
                      return rentalSpace?.spaceNumber
                        || rentalSpace?.space_number
                        || rentalSpace?.spaceCode
                        || rentalSpace?.space_code
                        || rentalSpace?.name
                        || 'N/A'
                    })()}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Billing Period</label>
                  <p className="text-gray-900">
                    {(payment.billingPeriodStart || payment.billing_period_start) && (payment.billingPeriodEnd || payment.billing_period_end)
                      ? `${formatDate(payment.billingPeriodStart || payment.billing_period_start)} - ${formatDate(payment.billingPeriodEnd || payment.billing_period_end)}`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          </>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg shadow-lg max-w-sm">
              {successMessage}
            </div>
          </div>
        )}

        {/* No Payment Found */}
        {!isLoading && !payment && (
          <div className="text-center py-12">
            <p className="text-gray-500">Payment not found</p>
          </div>
        )}

        {/* Edit Payment Modal */}
        {isEditingModalOpen && canEditPayments && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#28334b]/40 p-4 backdrop-blur-sm">
            <div className="modal-shell w-full max-w-sm overflow-y-auto p-6 max-h-[85vh]">
              <h3 className="modal-header -mx-6 -mt-6 mb-4">Record Payment</h3>

              <div className="space-y-3">
                {/* Show Current Balance */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                  <p className="text-xl font-bold text-blue-600">
                    ₱{payment ? parseFloat(String(payment.balance || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Pay (₱)</label>
                  <input
                    type="number"
                    name="amount_to_pay"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max={payment ? parseFloat(String(payment.balance || 0)) : undefined}
                    value={editFormData.amount_to_pay}
                    onChange={handleEditFormChange}
                    placeholder="Enter payment amount"
                    className="no-number-spinner w-full appearance-none px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum: ₱{payment ? parseFloat(String(payment.balance || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} (remaining balance with interest)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paid Date</label>
                  <input
                    type="date"
                    name="paid_date"
                    value={editFormData.paid_date}
                    onChange={handleEditFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    name="payment_method"
                    value={editFormData.payment_method}
                    onChange={handleEditFormChange}
                    disabled={!editFormData.paid_date}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    <option value="">Select payment method</option>
                    {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                  </select>
                  {!editFormData.paid_date && <p className="mt-1 text-xs text-gray-500">Enter a Paid Date to enable payment methods.</p>}
                </div>

                {requiresPaymentDetails(editFormData.payment_method) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{editFormData.payment_method === 'e_wallet' ? 'E-Wallet' : 'Bank'} Provider</label>
                      <select
                        name="payment_provider"
                        value={editFormData.payment_provider}
                        onChange={handleEditFormChange}
                        disabled={!editFormData.paid_date}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                      >
                        <option value="">Select provider</option>
                        {getPaymentProviders(editFormData.payment_method).map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                      </select>
                      {editFormData.payment_provider === 'Other' && <input
                        type="text"
                        name="payment_provider"
                        value={editFormData.payment_provider}
                        onChange={handleEditFormChange}
                        placeholder="Specify provider"
                        disabled={!editFormData.paid_date}
                        className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                      />}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                      <input
                        type="text"
                        name="reference_number"
                        value={editFormData.reference_number}
                        onChange={handleEditFormChange}
                        required={Boolean(editFormData.paid_date)}
                        placeholder="Required"
                        disabled={!editFormData.paid_date}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remarks/Notes</label>
                  <textarea
                    name="remarks"
                    value={editFormData.remarks}
                    onChange={handleEditFormChange}
                    rows={3}
                    placeholder="Optional notes about this payment"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="modal-actions pt-6">
                  <button
                    onClick={handleUpdatePayment}
                    disabled={isUpdating || !editFormData.amount_to_pay}
                    title="Record Payment"
                    className="action-success flex-1 rounded-lg border px-4 py-2 font-medium disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isUpdating ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={closeEditModal}
                    disabled={isUpdating}
                    title="Cancel"
                    className="action-secondary flex-1 rounded-lg border px-4 py-2 font-medium disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import apiClient from '@/lib/api-client'
import { Payment } from '@/types'
import { getPaymentProviders, getProviderValue, PAYMENT_METHODS, requiresPaymentDetails } from '@/lib/payment-methods'
import Pagination from '@/components/Pagination'
import { Banknote, Clock3, Eye, ReceiptText } from 'lucide-react'
import { statusColorClass } from '@/lib/status-colors'

function getBillingPeriodLabel(dueDate?: string): string {
  if (!dueDate) return 'N/A'
  const [year, month, day] = dueDate.slice(0, 10).split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) return 'N/A'

  const startDate = new Date(year, month - 1, day)
  const endDate = new Date(year, month, 1)
  const lastDay = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate()
  endDate.setDate(Math.min(day, lastDay))

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'N/A'
  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
  return `${formatDate(startDate)} - ${formatDate(endDate)}`
}

function getBillingPeriod(dueDate: string): { start: string; end: string } | null {
  const endDate = new Date(`${dueDate}T00:00:00`)
  if (Number.isNaN(endDate.getTime())) return null

  const startDate = new Date(endDate)
  startDate.setMonth(startDate.getMonth() - 1)
  const originalDay = endDate.getDate()
  const lastDay = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate()
  startDate.setDate(Math.min(originalDay, lastDay))

  const formatDate = (date: Date) => date.toISOString().slice(0, 10)
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

function getContractMonthlyRent(contract: any): number {
  const rentalSpace = contract?.rentalSpace || contract?.rental_space
  return parseFloat(String(
    contract?.monthlyRental || contract?.monthly_rental || contract?.monthlyRent ||
    rentalSpace?.monthlyRental || rentalSpace?.monthly_rental || rentalSpace?.baseRentalRate || rentalSpace?.base_rental_rate || 0,
  )) || 0
}

export default function PaymentsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('')
  const [sortColumn, setSortColumn] = useState('due_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [contractSearchTerm, setContractSearchTerm] = useState('')
  const [isContractDropdownOpen, setIsContractDropdownOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [recordForm, setRecordForm] = useState({
    contractId: '',
    amount: '',
    dueDate: new Date().toISOString().slice(0, 10),
    paidDate: '',
    paymentMethod: 'cash',
    paymentProvider: '',
    paymentProviderOther: '',
    referenceNumber: '',
    remarks: '',
  })

  // Only cashiers can record and edit payments
  const canRecordPayments = user?.role && user.role.toUpperCase() === 'CASHIER'

  useEffect(() => {
    fetchPayments()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, monthFilter])



  const fetchPayments = async () => {
    try {
      // Fetch both payments and contracts for amount calculations
      const [paymentsResp, contractsResp] = await Promise.all([
        apiClient.getPayments(undefined, { per_page: 1000 }),
        apiClient.getContracts(),
      ])
      
      console.log('Payments API Response:', paymentsResp)
      console.log('Contracts API Response:', contractsResp)
      
      // Extract and map contracts by ID
      let contractsArray = []
      if (contractsResp.data?.data && Array.isArray(contractsResp.data.data)) {
        contractsArray = contractsResp.data.data
      } else if (Array.isArray(contractsResp.data)) {
        contractsArray = contractsResp.data
      } else if (Array.isArray(contractsResp)) {
        contractsArray = contractsResp
      }
      
      const contractMap = new Map(contractsArray.map((c: any) => [String(c.id), c]))
      setContracts(contractsArray)
      
      // Extract payments
      let paymentsData = []
      if (paymentsResp.data?.data && Array.isArray(paymentsResp.data.data)) {
        paymentsData = paymentsResp.data.data
      } else if (Array.isArray(paymentsResp.data)) {
        paymentsData = paymentsResp.data
      } else if (Array.isArray(paymentsResp)) {
        paymentsData = paymentsResp
      }
      
      console.log('Extracted payments array:', paymentsData.length)
      
      const activeContractIds = new Set(contractsArray.map((contract: any) => String(contract.id)))

      // Ignore stale payment rows whose contract no longer exists. This prevents orphaned payments
      // from showing as N/A after a contract is deleted.
      const validPayments = paymentsData.filter((payment: any) => {
        const paymentContractId = payment.contractId || payment.contract_id || payment.contract?.id
        const fallbackContract = payment.contract || contractMap.get(String(paymentContractId))
        return Boolean(fallbackContract) || (!paymentContractId && Boolean(payment.contract))
      })
      
      // Map payments with proper amount calculations using contract fallback
      const mappedPayments = validPayments.map((p: any) => {
        // Get the contract to use for fallback amounts
        const contract = p.contract || contractMap.get(String(p.contract_id || p.contractId || p.contract?.id))

        if (!contract && p.contractId) {
          activeContractIds.delete(String(p.contractId))
        }
        
        // Get amount_due - use payment value, fallback to contract's monthly_rental
        let amountDue = parseFloat(p.amountDue || p.amount_due || 0)
        if (amountDue === 0 && contract) {
          amountDue = parseFloat(contract.monthly_rental || contract.monthlyRental || 0)
        }
        
        // Calculate interest (3%) if not in database
        let interestAmount = parseFloat(p.interestAmount || p.interest_amount || 0)
        if (interestAmount === 0 && amountDue > 0) {
          interestAmount = amountDue * 0.03
        }
        
        // Calculate total if not in database
        let totalAmount = parseFloat(p.totalAmount || p.total_amount || 0)
        if (totalAmount === 0) {
          totalAmount = amountDue + interestAmount
        }
        
        const amountPaid = parseFloat(p.amountPaid || p.amount_paid || 0)
        
        return {
          ...p,
          // Ensure numeric fields are numbers
          amountDue,
          interestAmount,
          totalAmount,
          amountPaid,
          paymentDate: p.paymentDate || p.payment_date,
          balance: Math.max(0, totalAmount - amountPaid),
          dueDate: p.dueDate || p.due_date,
          billingPeriodStart: p.billingPeriodStart || p.billing_period_start,
          billingPeriodEnd: p.billingPeriodEnd || p.billing_period_end,
          // Map status field from both formats
          status: p.status || p.payment_status || 'pending',
          // Map payment number
          paymentNumber: p.paymentNumber || p.payment_number,
        }
      })
      
      setPayments(mappedPayments)
      console.log('Payments loaded:', mappedPayments.length)
    } catch (err: any) {
      console.error('Error loading payments:', err)
      alert(err.message || 'Failed to load payments')
      setPayments([])
    } finally {
      setIsLoading(false)
    }
  }

  const closeRecordModal = () => {
    if (isRecording) return
    setShowRecordModal(false)
    setContractSearchTerm('')
    setIsContractDropdownOpen(false)
    setRecordForm({
      contractId: '',
      amount: '',
      dueDate: new Date().toISOString().slice(0, 10),
      paidDate: '',
      paymentMethod: 'cash',
      paymentProvider: '',
      paymentProviderOther: '',
      referenceNumber: '',
      remarks: '',
    })
  }

  const openRecordModal = () => {
    closeRecordModal()
    setShowRecordModal(true)
  }

  const openDeleteModal = (payment: Payment) => {
    setPaymentToDelete(payment)
    setShowDeleteModal(true)
  }

  const confirmDeletePayment = async () => {
    if (!paymentToDelete || !paymentToDelete.id) return

    try {
      setDeletingPaymentId(paymentToDelete.id)
      await apiClient.deletePayment(String(paymentToDelete.id))
      setShowDeleteModal(false)
      setPaymentToDelete(null)
      await fetchPayments()
    } catch (err: any) {
      alert(err.message || 'Failed to delete payment.')
    } finally {
      setDeletingPaymentId(null)
    }
  }

  const handleRecordFormChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    if (name === 'contractId') {
      const selectedContract = contracts.find((contract) => String(contract.id) === value)
      setRecordForm((current) => ({
        ...current,
        contractId: value,
        amount: selectedContract ? String(getContractMonthlyRent(selectedContract)) : '',
        dueDate: selectedContract ? getNextContractDueDate(selectedContract, payments) : current.dueDate,
      }))
      return
    }
    if (name === 'paymentMethod' && value === 'cash') {
      setRecordForm((current) => ({ ...current, paymentMethod: value, paymentProvider: '', paymentProviderOther: '', referenceNumber: '' }))
      return
    }
    setRecordForm((current) => ({ ...current, [name]: value }))
  }

  const handleRecordPayment = async (event: React.FormEvent) => {
    event.preventDefault()
    const selectedContract = contracts.find((contract) => String(contract.id) === recordForm.contractId)
    if (!selectedContract) {
      alert('Please select a valid contract.')
      return
    }

    const amount = Number(recordForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Please enter a valid payment amount.')
      return
    }

    const paymentProvider = getProviderValue(recordForm.paymentProvider, recordForm.paymentProviderOther)
    if (recordForm.paidDate && requiresPaymentDetails(recordForm.paymentMethod) && !paymentProvider) {
      alert('Select a payment provider for this payment.')
      return
    }
    if (recordForm.paidDate && requiresPaymentDetails(recordForm.paymentMethod) && !recordForm.referenceNumber.trim()) {
      alert(`Reference number is required for ${recordForm.paymentMethod === 'e_wallet' ? 'E-Wallet' : 'Bank Transfer'} payments.`)
      return
    }

    const billingPeriod = getBillingPeriod(recordForm.dueDate)
    const duplicatePayment = payments.some((payment: any) => {
      const paymentContractId = payment.contractId || payment.contract_id || payment.contract?.id
      const paymentPeriodStart = String(payment.billingPeriodStart || payment.billing_period_start || getBillingPeriod(payment.dueDate || payment.due_date || '')?.start || '').slice(0, 10)
      return String(paymentContractId) === String(selectedContract.id) && paymentPeriodStart === billingPeriod?.start
    })

    if (duplicatePayment) {
      alert('A payment for this contract and billing period already exists.')
      return
    }

    setIsRecording(true)
    try {
      await apiClient.createPayment({
        contract_id: selectedContract.id,
        tenant_id: selectedContract.tenant?.id || selectedContract.tenant_id,
        amount_due: amount,
        due_date: recordForm.dueDate,
        ...(recordForm.paidDate ? {
          payment_method: recordForm.paymentMethod,
          payment_provider: paymentProvider || null,
          reference_number: recordForm.referenceNumber.trim() || null,
        } : {}),
        remarks: recordForm.remarks,
        ...(recordForm.paidDate ? { payment_date: recordForm.paidDate } : {}),
        ...(billingPeriod ? { billing_period_start: billingPeriod.start, billing_period_end: billingPeriod.end } : {}),
      })
      setIsRecording(false)
      closeRecordModal()
      await fetchPayments()
    } catch (err: any) {
      alert(err.message || 'Failed to record payment.')
    } finally {
      setIsRecording(false)
    }
  }

  const filteredPayments = Array.isArray(payments) ? payments.filter((payment) => {
    // Get contract number from payment object (may be nested)
    const contractNumber = payment.contract?.contractNumber || payment.contract?.contract_number || ''
    const matchesSearch = contractNumber.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Handle both uppercase and lowercase status from backend
    const paymentStatus = (payment.status || '').toLowerCase()
    const filterStatus = statusFilter.toLowerCase()
    const matchesStatus = statusFilter === 'all' || paymentStatus === filterStatus
    
    // Filter by month
    let matchesMonth = true
    if (monthFilter) {
      const dueDate = new Date(payment.dueDate || payment.due_date || '')
      const [year, month] = monthFilter.split('-')
      matchesMonth = dueDate.getFullYear() === parseInt(year) && (dueDate.getMonth() + 1) === parseInt(month)
    }

    return matchesSearch && matchesStatus && matchesMonth
  }).sort((a, b) => {
    let aValue: any, bValue: any

    switch (sortColumn) {
      case 'contract':
        aValue = a.contract?.contractNumber || a.contract?.contract_number || ''
        bValue = b.contract?.contractNumber || b.contract?.contract_number || ''
        break
      case 'due_date':
        aValue = new Date(a.dueDate || a.due_date || '').getTime()
        bValue = new Date(b.dueDate || b.due_date || '').getTime()
        break
      case 'amount':
        aValue = parseFloat(String(a.amountDue || 0))
        bValue = parseFloat(String(b.amountDue || 0))
        break
      case 'total':
        aValue = parseFloat(String(a.totalAmount || 0))
        bValue = parseFloat(String(b.totalAmount || 0))
        break
      case 'status':
        aValue = a.status || ''
        bValue = b.status || ''
        break
      default:
        return 0
    }

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
    return 0
  }) : []

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column and reset to ascending
      setSortColumn(column)
      setSortOrder('asc')
    }
  }


  const getStatusBadge = (status: string) => {
    return statusColorClass(status)
  }

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const summaryMonth = monthFilter || currentMonth
  const summaryMonthLabel = new Date(`${summaryMonth}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const totalPaid = payments
    .filter((p) => {
      const status = String(p.status || '').toLowerCase().replace(/\s+/g, '_')
      return ['paid', 'partial', 'partially_paid'].includes(status) && String(p.dueDate || p.due_date || '').slice(0, 7) === summaryMonth
    })
    .reduce((sum, p) => {
      const status = String(p.status || '').toLowerCase().replace(/\s+/g, '_')
      const amountPaid = Number.parseFloat(String(p.amountPaid || p.amount_paid || 0)) || 0
      const settledAmount = amountPaid || (status === 'paid' ? Number.parseFloat(String(p.totalAmount || p.total_amount || p.amountDue || p.amount_due || 0)) || 0 : 0)
      return sum + settledAmount
    }, 0)

  const totalPending = payments
    .filter((p) => {
      const status = String(p.status || '').toLowerCase().replace(/\s+/g, '_')
      return ['pending', 'overdue', 'partial', 'partially_paid'].includes(status) && String(p.dueDate || p.due_date || '').slice(0, 7) === summaryMonth
    })
    .reduce((sum, p) => sum + parseFloat(String(p.balance || 0)), 0)

  const monthlyAmountDue = payments
    .filter((p) => String(p.dueDate || p.due_date || '').slice(0, 7) === summaryMonth)
    .reduce((sum, p) => sum + (Number.parseFloat(String(p.totalAmount || p.total_amount || 0)) || 0), 0)

  const totalPaymentCount = filteredPayments.length
  const paginatedPayments = filteredPayments.slice((currentPage - 1) * 10, currentPage * 10)

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
      <div className="space-y-6 pb-8">
        <header className="relative overflow-hidden rounded-3xl bg-[linear-gradient(118deg,#102f36_0%,#0b5963_58%,#12817f_100%)] p-5 text-white shadow-[0_18px_42px_rgba(13,76,83,0.14)] sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-40 right-28 h-72 w-72 rounded-full border border-white/10" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-100/80">Payment management</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Payments</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Monitor rental collections, review outstanding balances, and keep payment records up to date.</p>
              {canRecordPayments && (
                <button
                  type="button"
                  onClick={openRecordModal}
                  title="Record Payment"
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-teal-900 shadow-sm transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                >
                  <Banknote className="h-4 w-4" aria-hidden="true" />Record payment
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[570px]">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/70"><Banknote className="h-3.5 w-3.5 text-teal-200" /> Paid · {summaryMonthLabel}</span>
                <p className="mt-2 text-xl font-bold tabular-nums">₱{totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="mt-1 text-[10px] leading-4 text-white/65">of ₱{monthlyAmountDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} due</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/70"><Clock3 className="h-3.5 w-3.5 text-amber-200" /> Pending · {summaryMonthLabel}</span>
                <p className="mt-2 text-xl font-bold tabular-nums">₱{totalPending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/70"><ReceiptText className="h-3.5 w-3.5 text-sky-200" /> Payments</span>
                <p className="mt-2 text-xl font-bold tabular-nums">{totalPaymentCount}</p>
                <p className="mt-1 text-[10px] leading-4 text-white/65">Matching current filters</p>
              </div>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white rounded-lg shadow p-6 border border-gray-100">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by contract number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Period</label>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              min="2000-01"
              max="2100-12"
              aria-label="Filter payments by month and year"
              className="w-full cursor-pointer px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="partial">Partial</option>
            </select>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="loading-spinner" aria-hidden="true" />
                <p className="mt-4 text-gray-600">Loading payments...</p>
              </div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No payments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Contract #</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Contract Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Billing Period</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Amount Due</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Interest</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedPayments.map((payment) => {
                    const contractStatus = payment.contract?.status || 'N/A';
                    const balanceAmount = parseFloat(String(payment.balance || 0));
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                          {payment.contract?.contractNumber || payment.contract?.contract_number || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={statusColorClass(contractStatus)}>
                            {contractStatus.toUpperCase()}
                          </span>
                        </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {payment.billingPeriodStart && payment.billingPeriodEnd
                              ? `${new Date(payment.billingPeriodStart).toLocaleDateString()} - ${new Date(payment.billingPeriodEnd).toLocaleDateString()}`
                              : getBillingPeriodLabel(payment.dueDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          ₱{parseFloat(String(payment.amountDue || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                          ₱{parseFloat(String(payment.interestAmount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          <span className={balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                            ₱{balanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(payment.status || '')}`}>
                            {(payment.status || 'pending').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => router.push(`/dashboard/payments/${payment.id}`)}
                              title="View Payment"
                              aria-label="View Payment"
                              className="action-primary inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {canRecordPayments && (
                              <button 
                                onClick={() => router.push(`/dashboard/payments/${payment.id}?edit=true`)}
                                disabled={balanceAmount === 0 || contractStatus === 'terminated'}
                                className={`px-2 py-1 rounded transition ${balanceAmount === 0 || contractStatus === 'terminated' ? 'text-gray-400 bg-gray-50 cursor-not-allowed' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}`}
                              >
                                Edit
                              </button>
                            )}
                            {canRecordPayments && (
                              <button
                                type="button"
                                onClick={() => openDeleteModal(payment)}
                                disabled={deletingPaymentId === String(payment.id ?? '')}
                                className="action-danger rounded-lg border px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed"
                              >
                                {deletingPaymentId === String(payment.id ?? '') ? 'Archiving...' : 'Archive'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!isLoading && filteredPayments.length > 0 && (
          <Pagination currentPage={currentPage} totalItems={filteredPayments.length} onPageChange={setCurrentPage} />
        )}

        {!isLoading && filteredPayments.length > 0 && (
          <div className="text-sm text-gray-600">
            Showing {filteredPayments.length} of {payments.length} payments
          </div>
        )}
      </div>

      {showDeleteModal && paymentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && setShowDeleteModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between border-b border-gray-200 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Archive Payment</h3>
                <p className="mt-1 text-sm text-gray-500">This action will permanently remove the payment record.</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Are you sure you want to archive <span className="font-semibold">{paymentToDelete.paymentNumber || paymentToDelete.payment_number || 'this payment'}</span>?
              </p>
              <p className="text-xs text-gray-500">
                This action cannot be undone.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button type="button" onClick={() => setShowDeleteModal(false)} disabled={deletingPaymentId !== null} className="action-secondary rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={confirmDeletePayment} disabled={deletingPaymentId !== null} className="action-danger rounded-lg border px-4 py-2 text-sm font-semibold">
                {deletingPaymentId === String(paymentToDelete.id ?? '') ? 'Archiving...' : 'Archive Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between border-b border-gray-200 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Record Payment</h3>
                <p className="mt-1 text-sm text-gray-500">Add a payment without leaving this page.</p>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Contract</label>
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    required={!recordForm.contractId}
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
                      {searchableContracts.filter((contract) => String(contract.status || '').toLowerCase() !== 'terminated').length > 0 ? searchableContracts.filter((contract) => String(contract.status || '').toLowerCase() !== 'terminated').map((contract) => {
                        const contractNumber = contract.contractNumber || contract.contract_number || `Contract ${contract.id}`
                        const tenantName = contract.tenant?.user?.name || contract.tenant?.name || contract.tenant?.contact_person || contract.tenant?.contactPerson || contract.tenant?.business_name || contract.tenant?.businessName || 'Unknown tenant'
                        return (
                          <button
                            key={contract.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              handleRecordFormChange({ target: { name: 'contractId', value: String(contract.id) } } as React.ChangeEvent<HTMLInputElement>)
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
                  <input type="hidden" name="contractId" value={recordForm.contractId} required />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Amount (₱)</label>
                  <input name="amount" type="number" min="0.01" step="0.01" value={recordForm.amount} onChange={handleRecordFormChange} required className="no-number-spinner w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Due Date</label>
                  <input name="dueDate" type="date" value={recordForm.dueDate} onChange={handleRecordFormChange} required className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Paid Date (optional)</label>
                <input
                  name="paidDate"
                  type="date"
                  value={recordForm.paidDate}
                  onChange={(event) => {
                    handleRecordFormChange(event)
                    if (!event.target.value) setRecordForm((current) => ({ ...current, paymentMethod: 'cash', paymentProvider: '', paymentProviderOther: '', referenceNumber: '' }))
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Payment Method</label>
                <select name="paymentMethod" value={recordForm.paymentMethod} onChange={handleRecordFormChange} disabled={!recordForm.paidDate} className="w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-100">
                  {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                </select>
                {!recordForm.paidDate && <p className="mt-1 text-xs text-gray-500">Enter a Paid Date before recording a payment.</p>}
              </div>

              <>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">{recordForm.paymentMethod === 'e_wallet' ? 'E-Wallet' : 'Bank'} Provider</label>
                    <select name="paymentProvider" value={recordForm.paymentProvider} onChange={(event) => {
                      handleRecordFormChange(event)
                      setRecordForm((current) => ({ ...current, paymentProviderOther: '' }))
                    }} disabled={!recordForm.paidDate || !requiresPaymentDetails(recordForm.paymentMethod)} className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-100">
                      <option value="">Select provider</option>
                      {getPaymentProviders(recordForm.paymentMethod).map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                    </select>
                    {recordForm.paymentProvider === 'Other' && <input name="paymentProviderOther" value={recordForm.paymentProviderOther} onChange={handleRecordFormChange} placeholder="Specify provider" disabled={!recordForm.paidDate} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100" />}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">Reference Number</label>
                    <input name="referenceNumber" value={recordForm.referenceNumber} onChange={handleRecordFormChange} disabled={!recordForm.paidDate || !requiresPaymentDetails(recordForm.paymentMethod)} required={Boolean(recordForm.paidDate && requiresPaymentDetails(recordForm.paymentMethod))} className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100" />
                  </div>
              </>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Remarks</label>
                <textarea name="remarks" value={recordForm.remarks} onChange={handleRecordFormChange} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <button type="button" onClick={closeRecordModal} disabled={isRecording} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isRecording} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{isRecording ? 'Recording...' : 'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

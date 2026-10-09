'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

function CashierAnalyticsPanel({
  title,
  subtitle,
  action,
  href,
  children,
}: {
  title: string
  subtitle: string
  action: string
  href: string
  children: React.ReactNode
}) {
  return (
    <section className="dashboard-panel p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="dashboard-panel-title">{title}</h2>
          <p className="dashboard-muted mt-1">{subtitle}</p>
        </div>
        <Link href={href} className="rounded-md border border-[#e8eaf1] px-3 py-1.5 text-[10px] font-semibold text-[#5964c7] transition hover:bg-[#eef0ff]">{action}</Link>
      </div>
      {children}
    </section>
  )
}

function CashierLegend({ items }: { items: string[][] }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 text-[10px] text-[#8d95a8]">
      {items.map(([color, label]) => (
        <span key={label} className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>
      ))}
    </div>
  )
}
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { showGlobalNotice } from '@/lib/global-notice'
import { getPaymentProviders, getProviderValue, PAYMENT_METHODS, requiresPaymentDetails } from '@/lib/payment-methods'
import Pagination from '@/components/Pagination'
import { statusColorClass } from '@/lib/status-colors'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface CollectiblePayment {
  id: number
  paymentNumber: string
  contractNumber: string
  tenant: string
  amountDue: number
  interest: number
  total: number
  balance: number
  dueDate: string
  status: string
  daysOverdue: number
}

function getBillingPeriod(dueDate: string): { start: string; end: string } | null {
  const startDate = new Date(dueDate)
  if (Number.isNaN(startDate.getTime())) return null

  const endDate = new Date(startDate)
  const originalDay = startDate.getDate()
  endDate.setDate(1)
  const lastDayOfPreviousMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate()
  endDate.setMonth(endDate.getMonth() - 1)
  endDate.setDate(Math.min(originalDay, lastDayOfPreviousMonth))

  const formatDate = (date: Date) => date.toISOString().split('T')[0]
  return { start: formatDate(endDate), end: formatDate(startDate) }
}

interface TodaysCollection {
  date?: string
  totalCollected: string | number
  paymentCount: number
}

interface PaymentTrend {
  month: string
  paid: number
  pending: number
  overdue: number
  total: number
}

function parseAmount(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0

  const normalizedValue = value.replace(/[^0-9.-]/g, '')
  const amount = Number.parseFloat(normalizedValue)
  return Number.isFinite(amount) ? amount : 0
}

export default function CashierDashboard() {
  const [todaysData, setTodaysData] = useState<TodaysCollection | null>(null)
  const [collectibles, setCollectibles] = useState<CollectiblePayment[]>([])
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all')
  const [selectedPayment, setSelectedPayment] = useState<CollectiblePayment | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordData, setRecordData] = useState({
    amount: '',
    method: 'cash',
    provider: '',
    providerOther: '',
    referenceNumber: '',
    paidDate: '',
    remarks: '',
  })
  const [recordingMessage, setRecordingMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [paymentTrends, setPaymentTrends] = useState<PaymentTrend[]>([])
  const [trendMonth, setTrendMonth] = useState('')
  const [trendYear, setTrendYear] = useState(String(new Date().getFullYear()))
  const [collectionPeriod, setCollectionPeriod] = useState<'6-months' | 'year'>('6-months')
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  const resetRecordData = () => {
    setRecordData({ amount: '', method: 'cash', provider: '', providerOther: '', referenceNumber: '', paidDate: '', remarks: '' })
  }

  // Helper to safely parse and format dates
  const formatDate = (dateInput: any): string => {
    try {
      let date: Date | null = null
      
      // Handle string dates (ISO format, timestamp strings, etc)
      if (typeof dateInput === 'string') {
        // Try parsing ISO format or other standard formats
        date = new Date(dateInput)
      } else if (typeof dateInput === 'number') {
        // Timestamp
        date = new Date(dateInput)
      } else if (dateInput instanceof Date) {
        date = dateInput
      }
      
      if (!date || isNaN(date.getTime())) {
        return 'Invalid date'
      }
      
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    } catch (e) {
      console.warn('Error formatting date:', dateInput, e)
      return 'Invalid date'
    }
  }

  const getMonthFromDate = (dateInput: any): string => {
    try {
      let date: Date | null = null
      
      if (typeof dateInput === 'string') {
        date = new Date(dateInput)
      } else if (typeof dateInput === 'number') {
        date = new Date(dateInput)
      } else if (dateInput instanceof Date) {
        date = dateInput
      }
      
      if (!date || isNaN(date.getTime())) {
        return 'Unknown'
      }
      
      return date.toLocaleString('en-US', { year: 'numeric', month: 'short' })
    } catch (e) {
      console.warn('Error getting month from date:', dateInput, e)
      return 'Unknown'
    }
  }

  useEffect(() => {
    loadCashierData()
    loadPaymentTrends()
  }, [filterStatus, trendYear, collectionPeriod])

  const loadPaymentTrends = async () => {
    try {
      // Get payment reports from the last 6 months
      const response = await apiClient.get('/reports/payments?status=all')
      let payments = []
      
      // Handle nested response structure: { success, data: { payments: [...], summary: {...} } }
      if (response.data?.data?.payments && Array.isArray(response.data.data.payments)) {
        payments = response.data.data.payments
      } else if (response.data?.payments && Array.isArray(response.data.payments)) {
        payments = response.data.payments
      } else if (Array.isArray(response.data?.data)) {
        payments = response.data.data
      } else if (Array.isArray(response.data)) {
        payments = response.data
      }
      
      if (!Array.isArray(payments) || payments.length === 0) {
        console.warn('No payment data available:', { response, payments })
        payments = []
      }
      
      // Group payments by month
      const monthlyData: Record<string, { paid: number; pending: number; overdue: number; total: number }> = {}
      
      payments.forEach((payment: any) => {
        // Get the month key using the safe helper - use camelCase field names
        const monthKey = getMonthFromDate(payment.dueDate || payment.due_date || payment.createdAt || payment.created_at)
        
        if (!monthKey || monthKey === 'Unknown') {
          console.warn('Could not extract month from payment:', payment)
          return
        }
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { paid: 0, pending: 0, overdue: 0, total: 0 }
        }
        
        const amount = parseFloat(payment.totalAmount || payment.total_amount || payment.amount || payment.total || 0)
        monthlyData[monthKey].total += amount
        
        const status = (payment.status || '').toLowerCase()
        if (status === 'paid') {
          monthlyData[monthKey].paid += amount
        } else if (status === 'overdue') {
          monthlyData[monthKey].overdue += amount
        } else {
          monthlyData[monthKey].pending += amount
        }
      })
      
      // Keep zero-value months so the year and month filters remain usable without records.
      const yearMonths = Array.from({ length: 12 }, (_, monthIndex) => {
        const date = new Date(Number(trendYear), monthIndex, 1)
        return date.toLocaleString('en-US', { year: 'numeric', month: 'short' })
      })
      const visibleMonths = collectionPeriod === '6-months' ? yearMonths.slice(-6) : yearMonths
      const trends = visibleMonths.map((month) => ({
        month,
        ...(monthlyData[month] || { paid: 0, pending: 0, overdue: 0, total: 0 }),
      }))
      
      console.log('Payment trends loaded:', trends)
      setPaymentTrends(trends)
      if (!trends.some((trend) => trend.month === trendMonth)) {
        setTrendMonth(trends[trends.length - 1]?.month || '')
      }
    } catch (error) {
      console.error('Error loading payment trends:', error)
      setPaymentTrends([])
    }
  }

  const loadCashierData = async () => {
    try {
      setLoading(true)
      const [todaysRes, collectiblesRes] = await Promise.all([
        apiClient.get('/cashier/todays-collection'),
        apiClient.get(`/cashier/collectibles?status=${filterStatus}`),
      ])

      const todaysPayload = todaysRes.data?.data || todaysRes.data || todaysRes
      setTodaysData({
        date: todaysPayload.date,
        totalCollected: todaysPayload.totalCollected ?? todaysPayload.total_collected ?? 0,
        paymentCount: Number(todaysPayload.paymentCount ?? todaysPayload.payment_count ?? 0),
      })
      // Map backend response to ensure camelCase field names
      const payments = collectiblesRes.data.payments || []
      const mappedPayments = payments.map((p: any) => ({
        id: p.id,
        paymentNumber: p.paymentNumber || p.payment_number,
        contractNumber: p.contractNumber || p.contract_number,
        tenant: p.tenant,
        amountDue: parseFloat(String(p.amountDue || p.amount_due || 0)),
        interest: parseFloat(String(p.interest || 0)),
        total: parseFloat(String(p.total || 0)),
        balance: Math.max(0, parseFloat(String(p.balance || 0))),
        dueDate: p.dueDate || p.due_date,
        status: String(p.status || p.paymentStatus || p.payment_status || '').toLowerCase(),
        daysOverdue: p.daysOverdue || p.days_overdue || 0,
      }))
      setCollectibles(mappedPayments)
      setCurrentPage(1)
    } catch (error) {
      console.error('Error loading cashier data:', error)
      setCollectibles([])
    } finally {
      setLoading(false)
    }
  }

  const clampPaymentAmount = (rawValue: string, maxAllowed: number) => {
    const parsedValue = Number.parseFloat(rawValue)
    if (!Number.isFinite(parsedValue)) return ''

    const safeMax = Math.max(0, maxAllowed)
    const clampedValue = Math.min(Math.max(parsedValue, 0), safeMax)
    return String(clampedValue)
  }

  const handleRecordPayment = async () => {
    if (String(selectedPayment?.status).toLowerCase() === 'paid') {
      showGlobalNotice('Payment already recorded', 'This billing period is already paid and cannot be recorded again.')
      return
    }

    if (!selectedPayment) {
      showGlobalNotice('Payment details required', 'Please select a payment before recording.')
      return
    }

    const maxAllowed = Math.max(0, Number(selectedPayment.balance) || 0)
    const enteredAmount = Number.parseFloat(recordData.amount)

    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      showGlobalNotice('Payment details required', 'Please enter an amount before recording the payment.')
      return
    }

    if (enteredAmount > maxAllowed) {
      setRecordData((current) => ({ ...current, amount: String(maxAllowed) }))
      showGlobalNotice('Amount adjusted', 'The payment amount was capped to the remaining balance.')
      return
    }

    if (!recordData.paidDate) {
      showGlobalNotice('Paid date required', 'Enter the paid date before selecting or recording a payment method.')
      return
    }

    const paymentProvider = getProviderValue(recordData.provider, recordData.providerOther)
    if (requiresPaymentDetails(recordData.method) && !paymentProvider) {
      showGlobalNotice('Payment provider required', 'Select a payment provider before recording this payment.')
      return
    }

    if (requiresPaymentDetails(recordData.method) && !recordData.referenceNumber.trim()) {
      showGlobalNotice('Reference number required', `Reference number is required for ${recordData.method === 'e_wallet' ? 'E-Wallet' : 'Bank Transfer'} payments.`)
      return
    }

    try {
      setIsRecording(true)
      const billingPeriod = getBillingPeriod(selectedPayment.dueDate)
      await apiClient.post(`/cashier/payments/${selectedPayment.id}/record`, {
        amount: Number(enteredAmount.toFixed(2)),
        payment_method: recordData.method,
        payment_provider: paymentProvider || null,
        reference_number: recordData.referenceNumber.trim() || null,
        paid_date: recordData.paidDate,
        remarks: recordData.remarks,
        ...(billingPeriod && {
          billing_period_start: billingPeriod.start,
          billing_period_end: billingPeriod.end,
        }),
      })

      resetRecordData()
      setIsRecording(false)
      setRecordingMessage({ type: 'success', message: '✓ Payment recorded successfully!' })
      setTimeout(() => setRecordingMessage(null), 3000)
      
      // Wait 3 seconds before closing to show success message
      setSelectedPayment(null)
      setCollectibles((currentPayments) => currentPayments.filter((payment) => payment.id !== selectedPayment.id))
      setTimeout(() => {
        setRecordingMessage(null)
        loadCashierData()
      }, 3000)
    } catch (error: any) {
      showGlobalNotice('Payment could not be recorded', error.message || 'Please check the payment details and try again.')
      setIsRecording(false)
    }
  }

  const getStatusColor = (status: string) => {
    return statusColorClass(status)
  }

  const getUrgencyColor = (status: string, daysOverdue: number) => {
    if (status !== 'overdue') return ''
    if (daysOverdue > 30) return 'bg-[#fff2f4]'
    if (daysOverdue > 7) return 'bg-[#fff8ed]'
    return 'bg-[#fffaf0]'
  }

  const paymentSummary = paymentTrends.reduce(
    (summary, trend) => ({
      paid: summary.paid + trend.paid,
      pending: summary.pending + trend.pending,
      overdue: summary.overdue + trend.overdue,
      total: summary.total + trend.total,
    }),
    { paid: 0, pending: 0, overdue: 0, total: 0 },
  )

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e8eaf1] pb-5">
          <div>
            <div className="mb-2 text-[11px] font-semibold text-[#5663c4]">Collection</div>
            <h1 className="text-2xl font-medium tracking-tight text-[#354057]">Cashier Dashboard</h1>
            <p className="mt-1 text-xs text-[#9aa1b3]">Record payments and track daily collection</p>
          </div>
        </div>

        {/* Payment Analytics */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.85fr]">
          <CashierAnalyticsPanel title="Today's Collection" subtitle="Payments recorded today" action="View Payments" href="/dashboard/payments">
            <div className="mb-2 text-3xl font-semibold text-[#28334b]">₱{parseAmount(todaysData?.totalCollected).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="mb-4 text-xs text-[#9aa1b3]">{Number(todaysData?.paymentCount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} payments recorded today</p>
            <div className="h-2 overflow-hidden rounded-full bg-[#eef0f5]"><div className="h-full rounded-full bg-[#42bdd9]" style={{ width: `${Math.min((todaysData?.paymentCount || 0) * 10, 100)}%` }} /></div>
          </CashierAnalyticsPanel>

          <CashierAnalyticsPanel title="Payment Status" subtitle="Last 6 months" action="View" href="/dashboard/payments">
            <div className="relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={[{ name: 'Paid', value: paymentSummary.paid }, { name: 'Pending', value: paymentSummary.pending }, { name: 'Overdue', value: paymentSummary.overdue }]} innerRadius={42} outerRadius={58} paddingAngle={3} dataKey="value">
                    <Cell fill="#42bdd9" /><Cell fill="#f4a62a" /><Cell fill="#ed5b69" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute text-center"><div className="text-xl font-semibold text-[#28334b]">₱{Math.round(paymentSummary.total / 1000)}k</div><div className="text-[10px] text-[#9aa1b3]">Volume</div></div>
            </div>
            <CashierLegend items={[['#42bdd9', 'Paid'], ['#f4a62a', 'Pending'], ['#ed5b69', 'Overdue']]} />
          </CashierAnalyticsPanel>

          <CashierAnalyticsPanel title="Revenue Trend" subtitle="Monthly payment totals" action="View Report" href="/dashboard/reports">
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={paymentTrends}>
                <CartesianGrid stroke="#eef0f5" vertical={false} strokeDasharray="3 4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#a3a9b8', fontSize: 10 }} />
                <YAxis hide /><Tooltip formatter={(value) => [`₱${Number(value).toLocaleString()}`, 'Total']} />
                <Bar dataKey="total" fill="#5c68c9" radius={[2, 2, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </CashierAnalyticsPanel>

          <CashierAnalyticsPanel title="Transactions" subtitle="Payment count by month" action="View" href="/dashboard/payments">
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={paymentTrends.map((trend) => ({ ...trend, count: trend.total > 0 ? 1 : 0 }))}>
                <CartesianGrid stroke="#eef0f5" vertical={false} strokeDasharray="3 4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#a3a9b8', fontSize: 10 }} />
                <YAxis hide /><Tooltip />
                <Line type="monotone" dataKey="count" stroke="#42bdd9" strokeWidth={2} dot={{ r: 3, fill: '#42bdd9' }} />
              </LineChart>
            </ResponsiveContainer>
          </CashierAnalyticsPanel>
        </div>

        {/* Recording Modal */}
        {selectedPayment && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-[#28334b]/35 backdrop-blur-sm" 
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
              <div className="modal-shell max-w-md w-full max-h-[90vh] overflow-y-auto pointer-events-auto">
                <div className="modal-header sticky top-0 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Record Payment</h2>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); handleRecordPayment(); }} className="modal-body space-y-4">
                  {/* Success/Error Message */}
                  {recordingMessage && (
                    <div className={`p-4 rounded-lg text-sm font-bold ${
                      recordingMessage.type === 'success' 
                        ? 'bg-green-100 text-green-800 border-2 border-green-500' 
                        : 'bg-red-100 text-red-800 border-2 border-red-500'
                    }`}>
                      {recordingMessage.message}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm text-gray-600">Tenant</p>
                      <p className="font-bold text-lg">{selectedPayment.tenant}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm text-gray-600">Contract</p>
                      <p className="font-bold text-lg">{selectedPayment.contractNumber}</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                    <p className="text-2xl font-bold text-blue-600">
                      ₱{parseFloat(String(selectedPayment.balance || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  {getBillingPeriod(selectedPayment.dueDate) && (
                    <div className="rounded-md border border-[#e8eaf1] bg-[#fafaff] p-4">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa1b3]">Billing Period</p>
                      <p className="text-sm font-semibold text-[#28334b]">
                        {formatDate(getBillingPeriod(selectedPayment.dueDate)!.start)} - {formatDate(getBillingPeriod(selectedPayment.dueDate)!.end)}
                      </p>
                      <p className="mt-1 text-[11px] text-[#9aa1b3]">The next monthly period begins on the current due date.</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount to Collect (₱)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={Math.max(0, Number(selectedPayment.balance) || 0)}
                      value={recordData.amount}
                      onChange={(e) => {
                        const nextValue = clampPaymentAmount(e.target.value, Number(selectedPayment.balance) || 0)
                        setRecordData({ ...recordData, amount: nextValue })
                      }}
                      onWheel={(e) => e.preventDefault()}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault()
                        }
                      }}
                      className="no-number-spinner w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Enter amount"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum: ₱{parseFloat(String(selectedPayment.balance || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Paid Date</label>
                    <input
                      type="date"
                      value={recordData.paidDate}
                      onChange={(e) => setRecordData({ ...recordData, paidDate: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <select
                      value={recordData.method}
                      disabled={!recordData.paidDate}
                      onChange={(e) => setRecordData({ ...recordData, method: e.target.value, provider: '', providerOther: '', referenceNumber: '' })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                    </select>
                  </div>

                  {requiresPaymentDetails(recordData.method) && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{recordData.method === 'e_wallet' ? 'E-Wallet' : 'Bank'} Provider</label>
                        <select
                          value={recordData.provider}
                          disabled={!recordData.paidDate}
                          onChange={(e) => setRecordData({ ...recordData, provider: e.target.value })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                        >
                          <option value="">Select provider</option>
                          {getPaymentProviders(recordData.method).map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                        </select>
                        {recordData.provider === 'Other' && (
                          <input
                            type="text"
                            value={recordData.providerOther}
                            onChange={(e) => setRecordData({ ...recordData, providerOther: e.target.value })}
                            className="mt-2 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Specify provider"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Reference Number</label>
                        <input
                          type="text"
                          value={recordData.referenceNumber}
                          disabled={!recordData.paidDate}
                          onChange={(e) => setRecordData({ ...recordData, referenceNumber: e.target.value })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                          placeholder="Required"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                    <textarea
                      value={recordData.remarks}
                      onChange={(e) =>
                        setRecordData({ ...recordData, remarks: e.target.value })
                      }
                      rows={2}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Optional notes"
                    />
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      type="submit"
                      disabled={isRecording || !recordData.amount}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                    >
                      {isRecording ? 'Recording...' : 'Record Payment'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isRecording) {
                          setSelectedPayment(null)
                          setRecordData({ amount: '', method: 'cash', provider: '', providerOther: '', referenceNumber: '', paidDate: '', remarks: '' })
                          setRecordingMessage(null)
                        }
                      }}
                      disabled={isRecording}
                      className="flex-1 bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {/* Payment Trends Chart */}
        <div className="dashboard-panel p-5">
          <div className="mb-5">
            <h2 className="dashboard-panel-title">Payment Trends</h2>
            <p className="dashboard-muted mt-1">Last 6 months of collection activity</p>
          </div>
          
          <div className="space-y-6">
              {/* Month selector */}
              <div className="max-w-xs">
                <label className="block text-sm font-medium mb-2 text-gray-700">Collection year</label>
                <select
                  value={trendYear}
                  onChange={(e) => setTrendYear(e.target.value)}
                  className="mb-4 px-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 11 }, (_, index) => String(new Date().getFullYear() - 5 + index)).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <label className="block text-sm font-medium mb-2 text-gray-700">Filter by Month</label>
                <select
                  value={trendMonth}
                  onChange={(e) => setTrendMonth(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500"
                >
                  {paymentTrends.map((trend) => (
                    <option key={trend.month} value={trend.month}>
                      {trend.month}
                    </option>
                  ))}
                </select>
                <div className="mt-4 flex gap-2">
                  {(['6-months', 'year'] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setCollectionPeriod(period)}
                      className={`rounded-md px-3 py-2 text-xs font-semibold ${collectionPeriod === period ? 'bg-[#5964c7] text-white' : 'border border-[#dfe2ec] text-[#5964c7]'}`}
                    >
                      {period === '6-months' ? '6 Months' : 'Full Year'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="rounded-md border border-[#eef0f5] bg-[#fafaff] p-5 overflow-x-auto">
                {paymentTrends.length > 0 ? (
                  <div>
                    <div className="flex min-h-[18rem] items-end justify-between gap-4 pb-6">
                      {paymentTrends.map((trend) => {
                        const maxAmount = Math.max(...paymentTrends.map(t => t.total)) || 1000
                        const paidPercent = maxAmount > 0 ? (trend.paid / maxAmount) * 100 : 0
                        const pendingPercent = maxAmount > 0 ? (trend.pending / maxAmount) * 100 : 0
                        const overduePercent = maxAmount > 0 ? (trend.overdue / maxAmount) * 100 : 0
                        
                        return (
                          <div key={trend.month} className="flex flex-col items-center gap-3 flex-shrink-0" style={{ width: 80 }}>
                            <div className="w-full rounded-t-md bg-white border border-[#dfe2ec] overflow-hidden h-64 flex flex-col-reverse">
                              {paidPercent > 0 && (
                                <div
                                  className="bg-[#42bdd9] w-full transition-all hover:bg-[#31a9c6]"
                                  style={{ height: `${paidPercent}%`, minHeight: paidPercent > 0 ? '4px' : '0' }}
                                  title={`Paid: ₱${trend.paid.toLocaleString()}`}
                                />
                              )}
                              {pendingPercent > 0 && (
                                <div
                                  className="bg-[#f4a62a] w-full transition-all hover:bg-[#db8e18]"
                                  style={{ height: `${pendingPercent}%`, minHeight: pendingPercent > 0 ? '4px' : '0' }}
                                  title={`Pending: ₱${trend.pending.toLocaleString()}`}
                                />
                              )}
                              {overduePercent > 0 && (
                                <div
                                  className="bg-[#ed5b69] w-full transition-all hover:bg-[#d94b5a]"
                                  style={{ height: `${overduePercent}%`, minHeight: overduePercent > 0 ? '4px' : '0' }}
                                  title={`Overdue: ₱${trend.overdue.toLocaleString()}`}
                                />
                              )}
                            </div>
                            <p className="text-xs font-bold text-gray-800 text-center whitespace-nowrap">{trend.month}</p>
                            <p className="text-xs text-gray-600 font-semibold">₱{(trend.total / 1000).toFixed(1)}k</p>
                          </div>
                        )
                      })}
                    </div>

                    {/* Legend */}
                    <div className="mt-6 flex flex-wrap gap-6 justify-center pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#42bdd9]"></div>
                        <span className="text-xs font-medium text-[#7d8699]">Paid</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#f4a62a]"></div>
                        <span className="text-xs font-medium text-[#7d8699]">Pending</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#ed5b69]"></div>
                        <span className="text-xs font-medium text-[#7d8699]">Overdue</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No payment data available
                  </div>
                )}
              </div>
          </div>
        </div>

        {paymentTrends.length === 0 && !loading && (
          <div className="dashboard-panel p-5">
            <h2 className="dashboard-panel-title mb-5">Payment Trends</h2>
            <div className="rounded-md bg-[#fafaff] py-16 text-center">
              <p className="text-gray-500 text-lg">No payment data available yet</p>
              <p className="text-gray-400 text-sm mt-2">Payment trends will appear once payments are recorded</p>
            </div>
          </div>
        )}

        {/* Filter & Payments to Collect */}
        <div className="dashboard-panel p-5">
          <div className="mb-5 flex flex-col gap-3 border-b border-[#eef0f5] pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="dashboard-panel-title">
              {filterStatus === 'paid' ? 'Paid Payments' : 'Payments to Collect'}
              </h2>
              <p className="dashboard-muted mt-1">Review balances and record incoming payments</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterStatus('all')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  filterStatus === 'all'
                    ? 'bg-[#5148e5] text-white'
                    : 'bg-[#f0f1f7] text-[#7d8699] hover:bg-[#e4e6f1]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  filterStatus === 'pending'
                    ? 'bg-[#5148e5] text-white'
                    : 'bg-[#f0f1f7] text-[#7d8699] hover:bg-[#e4e6f1]'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setFilterStatus('overdue')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  filterStatus === 'overdue'
                    ? 'bg-[#5148e5] text-white'
                    : 'bg-[#f0f1f7] text-[#7d8699] hover:bg-[#e4e6f1]'
                }`}
              >
                Overdue
              </button>
              <button
                onClick={() => setFilterStatus('paid')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  filterStatus === 'paid'
                    ? 'bg-[#5148e5] text-white'
                    : 'bg-[#f0f1f7] text-[#7d8699] hover:bg-[#e4e6f1]'
                }`}
              >
                Paid
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="loading-spinner" aria-hidden="true" />
              <p className="mt-2 text-gray-600">Loading...</p>
            </div>
          ) : collectibles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No payments to collect
            </div>
          ) : (
            <div className="divide-y divide-[#eef0f5]">
              {collectibles.slice((currentPage - 1) * 10, currentPage * 10).map((payment) => (
                <div
                  key={payment.id}
                  onClick={() => {
                    if (String(payment.status).toLowerCase() !== 'paid') {
                      resetRecordData()
                      setRecordingMessage(null)
                      setSelectedPayment(payment)
                    }
                  }}
                  className={`px-2 py-4 ${
                    String(payment.status).toLowerCase() === 'paid'
                      ? 'bg-[#fafaff] cursor-default'
                      : 'cursor-pointer hover:bg-[#fafaff]'
                  } transition ${getUrgencyColor(
                    payment.status,
                    payment.daysOverdue
                  )}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-bold text-lg">{payment.tenant}</p>
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(
                            payment.status
                          )}`}
                        >
                          {payment.status.toUpperCase()}
                        </span>
                        {payment.daysOverdue > 0 && (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-red-600 text-white">
                            {payment.daysOverdue} DAYS OVERDUE
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {payment.contractNumber} • Due: {formatDate(payment.dueDate)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Amount: ₱{parseFloat(String(payment.amountDue || 0)).toLocaleString()} + Interest: ₱
                        {parseFloat(String(payment.interest || 0)).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {payment.status === 'paid' ? 'Amount Paid' : 'Balance Due'}
                      </p>
                      <p
                        className={`text-2xl font-bold ${
                          payment.status === 'paid' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        ₱{parseFloat(String(payment.balance || 0)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <Pagination currentPage={currentPage} totalItems={collectibles.length} onPageChange={setCurrentPage} />
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

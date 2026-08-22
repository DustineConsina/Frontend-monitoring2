'use client'

import { useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'

function reportDate(value: unknown): string {
  if (!value) return 'Date unavailable'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString()
}

function reportDateTime(value: unknown): string {
  if (!value) return 'Date unavailable'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString()
}

function reportValue(value: unknown, fallback = 'Not provided'): string {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function reportAmount(value: unknown): string {
  const amount = Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(amount) ? `₱${amount.toLocaleString()}` : 'Amount unavailable'
}

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string>('')
  const [reportData, setReportData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [filters, setFilters] = useState({
    status: 'all',
    dateFrom: '',
    dateTo: '',
  })

  const reports = [
    { id: 'contracts', name: 'Contracts Report', icon: '📋', description: 'View all contracts with status breakdown' },
    { id: 'payments', name: 'Payments Report', icon: '💰', description: 'Payment history and status summary' },
    { id: 'delinquency', name: 'Delinquency Report', icon: '⚠️', description: 'Overdue payments and delinquent tenants' },
    { id: 'revenue', name: 'Revenue Report', icon: '📊', description: 'Monthly and annual revenue analysis' },
    { id: 'expiring-contracts', name: 'Expiring Contracts', icon: '⏰', description: 'Contracts expiring soon' },
    { id: 'tenants', name: 'Tenants Report', icon: '👥', description: 'Complete tenant information' },
    { id: 'audit-log', name: 'Audit Log Report', icon: '📝', description: 'System activity and changes log' },
  ]

  const generateReport = async (reportId: string) => {
    setIsLoading(true)
    setSelectedReport(reportId)
    setReportData(null)
    try {
      let data
      const params = {
        status: filters.status !== 'all' ? filters.status : undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
      }

      switch (reportId) {
        case 'contracts':
          data = await apiClient.getContractsReport(params)
          break
        case 'payments':
          data = await apiClient.getPaymentsReport(params)
          break
        case 'delinquency':
          data = await apiClient.getDelinquencyReport()
          break
        case 'revenue':
          data = await apiClient.getRevenueReport()
          break
        case 'expiring-contracts':
          data = await apiClient.getExpiringContractsReport()
          break
        case 'tenants':
          data = await apiClient.getTenantsReport()
          break
        case 'audit-log':
          data = await apiClient.getAuditLogReport()
          break
        default:
          data = null
      }
      
      // Extract data from response structure
      let reportDataContent = data?.data || data
      
      // Log for debugging
      console.log(`Report ${reportId} response:`, reportDataContent)
      
      setReportData(reportDataContent)
    } catch (err: any) {
      console.error('Failed to generate report:', err)
      setReportData({ error: err.message || 'Failed to generate report' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async (format: 'pdf' | 'csv') => {
    if (!selectedReport) {
      alert('Please select a report first')
      return
    }

    setIsExporting(true)
    try {
      const params = {
        status: filters.status !== 'all' ? filters.status : undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
      }
      
      if (format === 'pdf') {
        await apiClient.exportReportPDF(selectedReport, params)
      } else {
        // CSV export now uses backend endpoint
        await apiClient.exportReportCSV(selectedReport, params)
      }
      alert(`Report exported successfully as ${format.toUpperCase()}`)
    } catch (err: any) {
      alert(`Failed to export as ${format.toUpperCase()}: ${err.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const renderReportContent = () => {
    if (!reportData) return null

    if (reportData.error) {
      return (
        <div className="text-center py-12 text-red-600">
          <p className="text-lg font-medium">{reportData.error}</p>
        </div>
      )
    }

    switch (selectedReport) {
      case 'contracts':
        return renderContractsReport()
      case 'payments':
        return renderPaymentsReport()
      case 'delinquency':
        return renderDelinquencyReport()
      case 'revenue':
        return renderRevenueReport()
      case 'expiring-contracts':
        return renderExpiringContractsReport()
      case 'tenants':
        return renderTenantsReport()
      case 'audit-log':
        return renderAuditLogReport()
      default:
        return null
    }
  }

  const renderContractsReport = () => {
    // Handle both direct array and wrapped response
    let contracts: any[] = []
    let summary: any = {}
    
    if (Array.isArray(reportData)) {
      contracts = reportData
    } else if (reportData?.contracts) {
      contracts = reportData.contracts
      summary = reportData.summary || {}
    }
    
    if (contracts.length === 0) {
      return <div className="text-center py-12 text-gray-500">No contracts found</div>
    }

    return (
      <div className="space-y-6">
        {/* Summary */}
        {summary && Object.keys(summary).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(summary).map(([key, value], idx) => {
              const colors = [
                'from-blue-400 to-blue-600',
                'from-purple-400 to-purple-600',
                'from-pink-400 to-pink-600',
                'from-green-400 to-green-600',
                'from-orange-400 to-orange-600',
                'from-red-400 to-red-600',
              ]
              return (
                <div key={key} className={`bg-gradient-to-br ${colors[idx % colors.length]} rounded-lg p-4 text-white shadow-lg`}>
                  <p className="text-xs opacity-90 uppercase tracking-wide">{key.replace(/_/g, ' ')}</p>
                    <p className="text-2xl font-bold mt-2">{key.includes('total') || key.includes('balance') || key.includes('amount') ? reportAmount(value) : reportValue(value)}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Contracts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b-2">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Contract #</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Tenant</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Space</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Monthly Rent</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Start Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">End Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contracts.map((contract: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{reportValue(contract.contractNumber || contract.contract_number)}</td>
                  <td className="px-4 py-3">{reportValue(contract.tenant?.contactPerson || contract.tenant?.contact_person || contract.tenant?.name)}</td>
                  <td className="px-4 py-3">{reportValue(contract.rentalSpace?.name || contract.rental_space?.name)} ({reportValue(contract.rentalSpace?.spaceType || contract.rental_space?.space_type)})</td>
                  <td className="px-4 py-3">{reportAmount(contract.monthlyRent || contract.monthlyRental || contract.monthly_rental)}</td>
                  <td className="px-4 py-3">{reportDate(contract.startDate || contract.start_date)}</td>
                  <td className="px-4 py-3">{reportDate(contract.endDate || contract.end_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      contract.status === 'active' ? 'bg-gray-100 text-gray-800' :
                      contract.status === 'expired' ? 'bg-gray-200 text-gray-800' :
                      contract.status === 'terminated' ? 'bg-gray-300 text-gray-900' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {contract.status?.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderPaymentsReport = () => {
    // Handle both direct array and wrapped response
    let payments: any[] = []
    let summary: any = {}
    
    if (Array.isArray(reportData)) {
      payments = reportData
    } else if (reportData?.payments) {
      payments = reportData.payments
      summary = reportData.summary || {}
    }
    
    if (payments.length === 0) {
      return <div className="text-center py-12 text-gray-500">No payments found</div>
    }

    return (
      <div className="space-y-6">
        {/* Summary */}
        {summary && Object.keys(summary).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(summary).map(([key, value], idx) => {
              const colors = [
                'from-green-400 to-green-600',
                'from-blue-400 to-blue-600',
                'from-purple-400 to-purple-600',
                'from-orange-400 to-orange-600',
              ]
              return (
                <div key={key} className={`bg-gradient-to-br ${colors[idx % colors.length]} rounded-lg p-4 text-white shadow-lg`}>
                  <p className="text-xs opacity-90 uppercase tracking-wide">{key.replace(/_/g, ' ')}</p>
                  <p className="text-xl font-bold mt-2">
                    {key.includes('total') || key.includes('balance') || key.includes('amount') ? reportAmount(value) : reportValue(value)}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Payments Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b-2">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Payment #</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Contract</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Tenant</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Amount Due</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Amount Paid</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Due Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((payment: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{reportValue(payment.paymentNumber || payment.payment_number)}</td>
                  <td className="px-4 py-3">{reportValue(payment.contract?.contractNumber || payment.contract?.contract_number)}</td>
                  <td className="px-4 py-3">{reportValue(payment.tenant?.contactPerson || payment.tenant?.contact_person)}</td>
                  <td className="px-4 py-3">{reportAmount(payment.amountDue || payment.amount_due)}</td>
                  <td className="px-4 py-3">{reportAmount(payment.amountPaid || payment.amount_paid)}</td>
                  <td className="px-4 py-3">{reportDate(payment.dueDate || payment.due_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      payment.status === 'paid' ? 'bg-gray-100 text-gray-800' :
                      payment.status === 'overdue' ? 'bg-gray-200 text-gray-900' :
                      payment.status === 'pending' ? 'bg-gray-100 text-gray-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {payment.status?.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderDelinquencyReport = () => {
    // Handle both direct array and wrapped response
    let delinquent_tenants: any[] = []
    let summary: any = {}
    
    if (Array.isArray(reportData)) {
      delinquent_tenants = reportData
    } else if (reportData?.delinquent_tenants) {
      delinquent_tenants = reportData.delinquent_tenants
      summary = reportData.summary || {}
    }
    
    if (delinquent_tenants.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-2xl text-gray-900 font-semibold">✓ Great! No delinquent tenants</p>
          <p className="text-gray-600 mt-2">All payments are up to date</p>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(summary).map(([key, value], idx) => {
              const colors = [
                'from-red-400 to-red-600',
                'from-orange-400 to-orange-600',
                'from-pink-400 to-pink-600',
                'from-purple-400 to-purple-600',
              ]
              return (
                <div key={key} className={`bg-gradient-to-br ${colors[idx % colors.length]} rounded-lg p-4 text-white shadow-lg`}>
                  <p className="text-xs opacity-90 uppercase tracking-wide">{key.replace(/_/g, ' ')}</p>
                  <p className="text-xl font-bold mt-2">
                    {typeof value === 'number' && key.includes('balance') ? `₱${parseFloat(String(value)).toLocaleString()}` : String(value)}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Delinquent Tenants */}
        <div className="space-y-4">
          {delinquent_tenants.map((item: any, idx: number) => (
            <div key={idx} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">{item.tenant?.contact_person || item.tenant?.name}</h4>
                  <p className="text-sm text-gray-600">{reportValue(item.tenant?.user?.email || item.tenant?.email)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{reportAmount(item.totalBalance || item.total_balance)}</p>
                  <p className="text-xs text-gray-600">{reportValue(item.overdueCount || item.overdue_count, '0')} payment(s) overdue</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Outstanding:</span>
                  <p className="font-semibold">{reportAmount(item.totalBalance || item.total_balance)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Interest Charged:</span>
                  <p className="font-semibold">{reportAmount(item.totalInterest || item.total_interest)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Oldest Due:</span>
                  <p className="font-semibold">{reportDate(item.oldestDueDate || item.oldest_due_date)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderRevenueReport = () => {
    // Handle wrapped response structure
    let monthly_revenue: any = {}
    let summary: any = {}
    
    if (reportData?.monthly_revenue) {
      monthly_revenue = reportData.monthly_revenue
      summary = reportData.summary || {}
    } else if (reportData?.data?.monthly_revenue) {
      monthly_revenue = reportData.data.monthly_revenue
      summary = reportData.data.summary || {}
    }
    
    return (
      <div className="space-y-6">
        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(summary).map(([key, value], idx) => {
              const colors = [
                'from-purple-400 to-purple-600',
                'from-pink-400 to-pink-600',
                'from-indigo-400 to-indigo-600',
                'from-violet-400 to-violet-600',
              ]
              return (
                <div key={key} className={`bg-gradient-to-br ${colors[idx % colors.length]} rounded-lg p-4 text-white shadow-lg`}>
                  <p className="text-xs opacity-90 uppercase tracking-wide">{key.replace(/_/g, ' ')}</p>
                  <p className="text-xl font-bold mt-2">
                    {reportAmount(value)}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Monthly Revenue Chart */}
        {monthly_revenue && Object.keys(monthly_revenue).length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Monthly Revenue Breakdown</h4>
            <div className="space-y-2">
              {Object.entries(monthly_revenue).map(([month, amount]) => (
                <div key={month} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-gray-700">{month}</div>
                  <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div 
                      className="h-full bg-gray-700 rounded-lg flex items-center justify-end pr-3"
                      style={{ width: `${Math.min((Number.parseFloat(String(amount).replace(/[^0-9.-]/g, '')) / 100000) * 100, 100)}%` }}
                    >
                      <span className="text-white text-xs font-semibold">{reportAmount(amount)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderExpiringContractsReport = () => {
    // Handle both array and wrapped response
    let contracts: any[] = []
    
    if (Array.isArray(reportData)) {
      contracts = reportData
    } else if (reportData?.contracts) {
      contracts = reportData.contracts
    } else if (reportData?.expiring_contracts) {
      contracts = reportData.expiring_contracts
    }
    
    if (contracts.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-2xl text-gray-900 font-semibold">✓ No contracts expiring soon</p>
          <p className="text-gray-600 mt-2">All active contracts have more than 30 days remaining</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {contracts.map((contract: any, idx: number) => {
          const endDateValue = contract.endDate || contract.end_date
          const endDate = new Date(endDateValue)
          const daysUntilExpiry = Number.isNaN(endDate.getTime()) ? 0 : Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          return (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-900">{reportValue(contract.contractNumber || contract.contract_number)}</h4>
                  <p className="text-sm text-gray-600">{reportValue(contract.tenant?.contactPerson || contract.tenant?.contact_person)} • {reportValue(contract.rentalSpace?.name || contract.rental_space?.name)} ({reportValue(contract.rentalSpace?.spaceType || contract.rental_space?.space_type)})</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${daysUntilExpiry <= 7 ? 'text-gray-900' : daysUntilExpiry <= 14 ? 'text-gray-800' : 'text-gray-700'}`}>
                    {daysUntilExpiry} days
                  </p>
                  <p className="text-sm text-gray-600">Expires {reportDate(endDateValue)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderTenantsReport = () => {
    // Handle both array and wrapped object response
    let tenants: any[] = []
    
    if (Array.isArray(reportData)) {
      tenants = reportData
    } else if (reportData?.tenants) {
      tenants = reportData.tenants
    }
    
    if (tenants.length === 0) {
      return <div className="text-center py-12 text-gray-500">No tenants found</div>
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b-2">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Tenant Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Phone</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Business Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">TIN</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Active Contracts</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tenants.map((item: any, idx: number) => {
              // Handle wrapped item structure
              const tenant = item.tenant || item
              const activeContractsCount = item.active_contracts_count || 0
              
              return (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{reportValue(tenant.contactPerson || tenant.contact_person || tenant.name)}</td>
                  <td className="px-4 py-3">{reportValue(tenant.user?.email || tenant.email)}</td>
                  <td className="px-4 py-3">{reportValue(tenant.contactNumber || tenant.contact_number)}</td>
                  <td className="px-4 py-3">{reportValue(tenant.businessName || tenant.business_name)}</td>
                  <td className="px-4 py-3">{reportValue(tenant.tin)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{reportValue(item.activeContractsCount || item.active_contracts_count, '0')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      tenant.status === 'active' ? 'bg-gray-100 text-gray-800' : 'bg-gray-200 text-gray-800'
                    }`}>
                      {tenant.status?.toUpperCase()}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderAuditLogReport = () => {
    // Handle both array and wrapped response
    let logs: any[] = []
    
    if (Array.isArray(reportData)) {
      logs = reportData
    } else if (reportData?.logs) {
      logs = reportData.logs
    } else if (reportData?.audit_logs) {
      logs = reportData.audit_logs
    }
    
    if (logs.length === 0) {
      return <div className="text-center py-12 text-gray-500">No audit logs found</div>
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b-2">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Date/Time</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">User</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Action</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Model</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log: any, idx: number) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">{reportDateTime(log.createdAt || log.created_at)}</td>
                <td className="px-4 py-3">{reportValue(log.userId || log.user_id, 'System')}</td>
                <td className="px-4 py-3 uppercase text-xs font-medium">{log.action}</td>
                <td className="px-4 py-3">{reportValue(log.modelType || log.model_type)}</td>
                <td className="px-4 py-3">{reportValue(log.description)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
          <p className="text-gray-600">Generate and analyze system reports</p>
        </div>

        <div className="space-y-6">
          {/* Report Selection Cards */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Select a Report</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => generateReport(report.id)}
                  className={`text-left rounded-lg p-4 border-2 transition ${
                    selectedReport === report.id
                      ? 'bg-blue-50 border-blue-400'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow'
                  }`}
                  title={report.description}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{report.icon}</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{report.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">{report.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Filters (when report selected) */}
          {(selectedReport === 'contracts' || selectedReport === 'payments') && (
            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Report Filters</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="all">All</option>
                    {selectedReport === 'contracts' && (
                      <>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="terminated">Terminated</option>
                        <option value="pending">Pending</option>
                      </>
                    )}
                    {selectedReport === 'payments' && (
                      <>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="overdue">Overdue</option>
                        <option value="partial">Partial</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => generateReport(selectedReport)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Report Display */}
          <div className="bg-white rounded-lg shadow">
            {!selectedReport ? (
              <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                <p className="text-lg font-medium">Select a report to generate</p>
                <p className="text-sm mt-2">Choose from the available reports above</p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
                  <p className="mt-4 text-gray-600">Generating report...</p>
                </div>
              </div>
            ) : (
              <div className="p-6">
                {/* Report Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {reports.find((r) => r.id === selectedReport)?.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Generated on {new Date().toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExport('pdf')}
                      disabled={isExporting || !reportData}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {isExporting ? '⏳' : '📄'} Export PDF
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      disabled={isExporting || !reportData}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {isExporting ? '⏳' : '📊'} Export CSV
                    </button>
                  </div>
                </div>

                {/* Report Content */}
                {renderReportContent()}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
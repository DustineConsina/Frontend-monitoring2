'use client'

import { useState } from 'react'
import ExcelJS from '@/lib/exceljs-browser-shim'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import apiClient from '@/lib/api-client'
import { showGlobalNotice } from '@/lib/global-notice'
import { statusColorClass } from '@/lib/status-colors'
import { AlertTriangle, ArrowRight, BarChart3, CalendarClock, ClipboardList, CreditCard, Download, FileSpreadsheet, FileText, Filter, LoaderCircle, Users } from 'lucide-react'

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

function parseCurrencyValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const text = String(value).trim()
  if (!text) return null

  const normalized = text.startsWith('(') && text.endsWith(')') ? `-${text.slice(1, -1)}` : text
  const cleaned = normalized.replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, '').replace(/,/g, '')
  const amount = Number.parseFloat(cleaned)

  return Number.isFinite(amount) ? amount : null
}

function formatNumberWithoutCurrency(value: unknown): string {
  if (value === null || value === undefined || value === '') return '0'

  const parsed = Number(value)
  if (Number.isFinite(parsed)) {
    return Number.isInteger(parsed) ? String(parsed) : parsed.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }

  return String(value)
}

function formatMetricValue(key: string, value: unknown): string {
  const normalizedKey = key.toLowerCase()
  const isPaymentCountMetric = /(paid[_ ]?payments?|pending[_ ]?payments?|overdue[_ ]?payments?|total[_ ]?payments?)/.test(normalizedKey)
  const isCountMetric = isPaymentCountMetric || /(count|tenants?|contracts?|days|logs?|entries?|records?|active|expired|pending|available|occupied|maintenance)/.test(normalizedKey)
  const isCurrencyMetric = !isPaymentCountMetric && /(amount|balance|revenue|interest|rent|average[_ ]?payment|total[_ ]?paid|total_overdue_amount|overdue_amount|monthly|collected|total_income|total_expense|total_collection)/.test(normalizedKey)

  if (value === null || value === undefined || value === '') {
    return isCurrencyMetric ? 'PHP 0.00' : '0'
  }

  if (isCurrencyMetric) {
    return reportAmount(value)
  }

  if (isCountMetric) {
    return formatNumberWithoutCurrency(value)
  }

  return reportValue(value, '0')
}

function formatMetricLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bdelinquent\b/gi, 'Arrears')
    .replace(/\bdelinquency\b/gi, 'Arrears')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatWholeNumber(value: unknown): string {
  if (value === null || value === undefined || value === '') return '0'
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed).toLocaleString('en-US') : String(value)
}

function formatExportValue(header: string, value: unknown): string {
  const normalizedHeader = header.toLowerCase()
  const isPaymentCount = /(paid|pending|overdue|total) payments?/.test(normalizedHeader)
  const isCurrency = !isPaymentCount && /(amount|balance|revenue|interest|rent|total overdue|total paid|monthly|collected)/.test(normalizedHeader)
  const isWholeNumber = isPaymentCount || /(count|days|tenants|contracts|records|entries|active|overdue|days left)/.test(normalizedHeader)

  if (isCurrency) return reportAmount(value)
  if (isWholeNumber) return formatWholeNumber(value)
  if (/date|time/.test(normalizedHeader) && value && !Number.isNaN(new Date(String(value)).getTime())) {
    return normalizedHeader.includes('time') ? reportDateTime(value) : reportDate(value)
  }

  return toExportText(value)
}

function toExportText(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'N/A'
  if (typeof value === 'string' && value.trim() === '') return 'N/A'
  return String(value)
}

function reportAmount(value: unknown): string {
  const amount = parseCurrencyValue(value)
  if (amount === null) return 'PHP 0.00'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatRevenueMonth(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return 'Unknown month'

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const yearMonthMatch = raw.match(/^(?:\d{4}[-/])?(\d{1,2})$/)
  if (yearMonthMatch) {
    const monthNumber = Number(yearMonthMatch[1])
    if (monthNumber >= 1 && monthNumber <= 12) return monthNames[monthNumber - 1]
    if (monthNumber === 0) return monthNames[0]
  }

  const parsedDate = new Date(`${raw} 1, 2026`)
  if (!Number.isNaN(parsedDate.getTime()) && /[a-z]/i.test(raw)) {
    return monthNames[parsedDate.getMonth()]
  }

  return raw
}

function parseRevenueAmount(value: unknown): number {
  return parseCurrencyValue(value) ?? 0
}

export default function ReportsPage() {
  const { user } = useAuth()
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
    { id: 'delinquency', name: 'Arrears Report', icon: '⚠️', description: 'Overdue payments and tenants with arrears' },
    { id: 'revenue', name: 'Revenue Report', icon: '📊', description: 'Monthly and annual revenue analysis' },
    { id: 'expiring-contracts', name: 'Expiring Contracts', icon: '⏰', description: 'Contracts expiring soon' },
    { id: 'tenants', name: 'Tenants Report', icon: '👥', description: 'Complete tenant information' },
    { id: 'audit-log', name: 'Audit Log Report', icon: '📝', description: 'System activity and changes log' },
  ]
  const reportIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    contracts: FileText,
    payments: CreditCard,
    delinquency: AlertTriangle,
    revenue: BarChart3,
    'expiring-contracts': CalendarClock,
    tenants: Users,
    'audit-log': ClipboardList,
  }

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
      const reportDataContent = data?.data || data
      
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

  const toDisplayText = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return 'N/A'
    if (typeof value === 'string' && value.trim() === '') return 'N/A'
    if (typeof value === 'number' && !Number.isFinite(value)) return 'N/A'
    return String(value)
  }

  const getNestedValue = (source: any, keys: string[]) => {
    for (const key of keys) {
      if (source && typeof source === 'object' && key in source && source[key] !== undefined && source[key] !== null && source[key] !== '') {
        return source[key]
      }
    }
    return undefined
  }

  const resolveFieldValue = (source: any, keys: string[]) => {
    const candidates = new Set<string>()
    for (const key of keys) {
      candidates.add(key)
      candidates.add(key.toLowerCase())
      candidates.add(key.replace(/_/g, ''))
      candidates.add(key.replace(/_/g, '').toLowerCase())
      candidates.add(key.replace(/([a-z])([A-Z])/g, '$1_$2'))
      candidates.add(key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase())
    }

    const nestedFind = (node: any): any => {
      if (!node || typeof node !== 'object') return undefined

      for (const [entryKey, value] of Object.entries(node)) {
        const normalized = entryKey.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (candidates.has(entryKey) || candidates.has(entryKey.toLowerCase()) || candidates.has(normalized)) {
          if (value !== undefined && value !== null && value !== '') return value
        }
      }

      for (const value of Object.values(node)) {
        if (value && typeof value === 'object') {
          const found = nestedFind(value)
          if (found !== undefined) return found
        }
      }

      return undefined
    }

    return nestedFind(source)
  }

  const getReportSummaryEntries = () => {
    if (!reportData) return []

    const summarySource =
      reportData.summary ||
      reportData.data?.summary ||
      reportData.summary_data ||
      reportData.data?.summary_data ||
      reportData.meta?.summary ||
      reportData.metadata?.summary ||
      {}

    if (!summarySource || typeof summarySource !== 'object') return []
    return Object.entries(summarySource)
  }

  const getReportDataset = (): any[] => {
    if (!reportData) return []

    if (Array.isArray(reportData)) return reportData

    const datasetCandidates = [
      reportData.data,
      reportData.results,
      reportData.records,
      reportData.contracts,
      reportData.payments,
      reportData.tenants,
      reportData.logs,
      reportData.auditLogs,
      reportData.audit_logs,
      reportData.delinquentTenants,
      reportData.delinquent_tenants,
      reportData.expiringContracts,
      reportData.expiring_contracts,
    ]

    for (const candidate of datasetCandidates) {
      if (Array.isArray(candidate)) return candidate
    }

    const objectEntries = Object.values(reportData)
    const arrayEntry = objectEntries.find((value) => Array.isArray(value))
    return Array.isArray(arrayEntry) ? arrayEntry : []
  }

  const buildExportRows = (): Record<string, string>[] => {
    if (!reportData) return []

    const dataset = getReportDataset()

    if (!dataset.length && typeof reportData === 'object') {
      const monthlyRevenue = reportData.monthlyRevenue || reportData.monthly_revenue
      if (monthlyRevenue && typeof monthlyRevenue === 'object') {
        return (Array.isArray(monthlyRevenue)
          ? monthlyRevenue.map((item: any) => [item.month || item.monthName || item.month_name, item.revenue ?? item.amount ?? item.total ?? item.value])
          : Object.entries(monthlyRevenue)
        ).map(([month, amount]) => ({ Month: formatRevenueMonth(month), Amount: reportAmount(amount) }))
      }
      const summaryEntries = getReportSummaryEntries()
      if (summaryEntries.length > 0) {
        return summaryEntries.map(([key, value]) => ({ Metric: formatMetricLabel(key), Value: formatMetricValue(key, value) }))
      }
    }

    switch (selectedReport) {
      case 'contracts':
        return (dataset as any[]).map((contract: any) => ({
          'Contract #': toDisplayText(contract.contractNumber || contract.contract_number),
          Tenant: toDisplayText(contract.tenant?.contactPerson || contract.tenant?.contact_person || contract.tenant?.name),
          'Leased Area Facility': toDisplayText(contract.rentalSpace?.spaceCode || contract.rentalSpace?.space_code || contract.rental_space?.space_code || contract.rentalSpace?.name || contract.rental_space?.name),
          'Monthly Rent': toDisplayText(contract.monthlyRent || contract.monthlyRental || contract.monthly_rental),
          'Start Date': toDisplayText(contract.startDate || contract.start_date),
          'End Date': toDisplayText(contract.endDate || contract.end_date),
          Status: toDisplayText(contract.status),
        }))
      case 'payments':
        return (dataset as any[]).map((payment: any) => ({
          'Payment #': toDisplayText(payment.paymentNumber || payment.payment_number),
          'Contract #': toDisplayText(payment.contract?.contractNumber || payment.contract?.contract_number),
          Tenant: toDisplayText(payment.tenant?.contactPerson || payment.tenant?.contact_person || payment.tenant?.name),
          'Amount Due': toDisplayText(payment.amountDue || payment.amount_due),
          'Amount Paid': toDisplayText(payment.amountPaid || payment.amount_paid),
          'Due Date': toDisplayText(payment.dueDate || payment.due_date),
          Status: toDisplayText(payment.status),
        }))
      case 'delinquency':
        return (dataset as any[]).map((item: any) => {
          const tenant = item.tenant || item.tenantData || item.tenant_details || {}
          const tenantName = resolveFieldValue(item, ['contactPerson', 'contact_person', 'tenantName', 'tenant_name', 'name', 'fullName', 'full_name'])
            ?? getNestedValue(tenant, ['contactPerson', 'contact_person', 'name', 'fullName', 'full_name'])
          const tenantEmail = resolveFieldValue(item, ['email', 'tenantEmail', 'tenant_email', 'userEmail', 'user_email'])
            ?? getNestedValue(tenant, ['email', 'userEmail', 'user_email'])
          const balance = resolveFieldValue(item, ['totalOverdue', 'total_overdue', 'totalBalance', 'total_balance', 'outstandingBalance', 'outstanding_balance', 'amount'])
          const interest = resolveFieldValue(item, ['totalInterest', 'total_interest', 'interestCharged', 'interest_charged', 'lateFee', 'late_fee'])
          const overdueCount = resolveFieldValue(item, ['daysOverdue', 'days_overdue', 'overdueDays', 'overdue_days', 'overdueCount', 'overdue_count'])
          const oldestDue = resolveFieldValue(item, ['oldestDueDate', 'oldest_due_date', 'oldestDue', 'oldest_due', 'dueDate', 'due_date'])

          return {
            Tenant: toDisplayText(tenantName),
            Email: toDisplayText(tenantEmail),
            'Total Overdue': toDisplayText(balance),
            'Interest Charged': toDisplayText(interest),
            'Days Overdue': toDisplayText(overdueCount),
            'Oldest Due': toDisplayText(oldestDue),
          }
        })
      case 'revenue':
        {
          const monthlyRevenue = reportData?.monthlyRevenue || reportData?.monthly_revenue || reportData?.data?.monthlyRevenue || reportData?.data?.monthly_revenue
          if (monthlyRevenue && typeof monthlyRevenue === 'object') {
            return (Array.isArray(monthlyRevenue)
              ? monthlyRevenue.map((item: any) => [item.month || item.monthName || item.month_name, item.revenue ?? item.amount ?? item.total ?? item.value])
              : Object.entries(monthlyRevenue)
            ).map(([month, amount]) => ({
              Month: formatRevenueMonth(month),
              Revenue: reportAmount(amount),
            }))
          }
        }
        return (dataset as any[]).map((item: any) => ({
          Month: formatRevenueMonth(item.month || item.monthName || item.month_name || item.label),
          Revenue: reportAmount(item.revenue ?? item.amount ?? item.total ?? item.value),
        }))
      case 'expiring-contracts':
        return (dataset as any[]).map((contract: any) => ({
          'Contract #': toDisplayText(contract.contractNumber || contract.contract_number),
          Tenant: toDisplayText(contract.tenant?.contactPerson || contract.tenant?.contact_person || contract.tenant?.name),
          'Leased Area Facility': toDisplayText(contract.rentalSpace?.spaceCode || contract.rentalSpace?.space_code || contract.rental_space?.space_code || contract.rentalSpace?.name || contract.rental_space?.name),
          'Expiry Date': toDisplayText(contract.endDate || contract.end_date),
          'Days Left': toDisplayText(contract.daysLeft ?? contract.days_left ?? ''),
        }))
      case 'tenants':
        return (dataset as any[]).map((tenantItem: any) => {
          const tenant = tenantItem.tenant || tenantItem
          return {
            'Tenant Name': toDisplayText(tenant.contactPerson || tenant.contact_person || tenant.name),
            Email: toDisplayText(tenant.user?.email || tenant.email),
            Phone: toDisplayText(tenant.contactNumber || tenant.contact_number),
            'Business Name': toDisplayText(tenant.businessName || tenant.business_name),
            'Business Permit': toDisplayText(tenant.businessPermitNumber || tenant.business_permit_number || tenant.tin),
            'Active Contracts': toDisplayText(tenantItem.activeContractsCount || tenantItem.active_contracts_count || tenant.activeContractsCount || tenant.active_contracts_count),
            Status: toDisplayText(tenant.status),
          }
        })
      case 'audit-log':
        return (dataset as any[]).map((log: any) => ({
          'Date / Time': toDisplayText(log.createdAt || log.created_at),
          User: toDisplayText(log.user?.name || log.user?.email || log.userId || log.user_id || 'System'),
          Action: toDisplayText(log.action),
          Model: toDisplayText(log.modelType || log.model_type),
          Description: toDisplayText(log.description),
        }))
      default:
        return []
    }
  }

  const downloadCSVFromCurrentReport = () => {
    const rows = buildExportRows()
    if (!rows.length) {
      throw new Error('No report data is available to export.')
    }

    const headers = Object.keys(rows[0]) as Array<keyof Record<string, string>>
    const escapeCsvValue = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`

    const csvRows = [
      headers.map((header) => String(header)),
      ...rows.map((row) => headers.map((header) => formatExportValue(String(header), row[String(header)]))),
    ]

    const csvContent = '\uFEFFsep=,\r\n' + csvRows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedReport}-report-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const downloadExcelReport = () => {
    const rows = buildExportRows()
    if (!rows.length) {
      throw new Error('No report data is available to export.')
    }

    const title = reports.find((report) => report.id === selectedReport)?.name || 'Report'
    const headers = Object.keys(rows[0])
    const escapeHtml = (value: unknown) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
    const columnWidths = headers.map((header) => {
      const longestValue = Math.max(header.length, ...rows.map((row) => formatExportValue(header, row[header]).length))
      return Math.min(Math.max(longestValue * 7 + 24, 110), 260)
    })

    const tableHeader = headers.map((header, index) => `<th style="width:${columnWidths[index]}px">${escapeHtml(header)}</th>`).join('')
    const tableRows = rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(formatExportValue(header, row[header]))}</td>`).join('')}</tr>`).join('')
    const html = `<!DOCTYPE html>
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="UTF-8"><style>
          @page { margin: 0.6in; }
          body { font-family: Calibri, Arial, sans-serif; color: #1f2937; }
          table { border-collapse: collapse; table-layout: fixed; width: 100%; }
          td, th { border: 1px solid #cbd5e1; padding: 8px 10px; vertical-align: middle; word-wrap: break-word; }
          .agency { color: #173b66; font-size: 16pt; font-weight: bold; }
          .department { color: #64748b; font-size: 10pt; }
          .report-title { color: #111827; font-size: 18pt; font-weight: bold; padding-top: 12px; }
          .meta-label { background: #eef3f8; color: #475569; font-weight: bold; width: 130px; }
          .section { background: #173b66; color: white; font-weight: bold; letter-spacing: 1px; padding: 9px 10px; }
          .summary-label { background: #f1f5f9; color: #475569; font-weight: bold; width: 180px; }
          .summary-value { font-weight: bold; }
          th { background: #2f5d85; color: white; font-weight: bold; text-align: left; white-space: normal; }
          tr:nth-child(even) td { background: #f8fafc; }
          .footer { color: #64748b; font-size: 9pt; padding-top: 14px; }
        </style></head>
        <body>
          <table>
            <tr><td colspan="${headers.length}" class="agency">PHILIPPINE FISHERIES DEVELOPMENT AUTHORITY</td></tr>
            <tr><td colspan="${headers.length}" class="department">PFDA Bulan, Sorsogon Fish Port - Contract Monitoring System</td></tr>
            <tr><td colspan="${headers.length}" class="report-title">${escapeHtml(title)}</td></tr>
            <tr><td class="meta-label">Prepared On</td><td colspan="${Math.max(headers.length - 1, 1)}">${escapeHtml(new Date().toLocaleString('en-US'))}</td></tr>
            <tr><td class="meta-label">Records</td><td colspan="${Math.max(headers.length - 1, 1)}">${rows.length.toLocaleString('en-US')}</td></tr>
            <tr><td colspan="${headers.length}" class="section">REPORT DATA</td></tr>
            <tr>${tableHeader}</tr>
            ${tableRows}
            <tr><td colspan="${headers.length}" class="footer">Confidential report - Generated by PFDA Contract Monitoring System</td></tr>
          </table>
        </body>
      </html>`

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedReport}-report-${new Date().toISOString().slice(0, 10)}.xls`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const downloadRealExcelReport = async () => {
    const rows = buildExportRows()
    if (!rows.length) {
      throw new Error('No report data is available to export.')
    }

    const title = reports.find((report) => report.id === selectedReport)?.name || 'Report'
    const headers = Object.keys(rows[0])
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'PFDA Contract Monitoring System'
    workbook.created = new Date()
    workbook.modified = new Date()

    const worksheet = workbook.addWorksheet(title.slice(0, 31), {
      views: [{ showGridLines: false }],
      properties: { defaultRowHeight: 20 },
    })

    const dataHeaderRow = 1

    const tableHeaderRow = worksheet.getRow(dataHeaderRow)
    headers.forEach((header, index) => {
      const cell = tableHeaderRow.getCell(index + 1)
      cell.value = header
      cell.font = { bold: true, color: { argb: 'FFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2F5D85' } }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = { bottom: { style: 'medium', color: { argb: '173B66' } } }
    })
    tableHeaderRow.height = 34

    const dataRows = rows.map((row) => headers.map((header) => {
      const formatted = formatExportValue(header, row[header])
      const normalizedHeader = header.toLowerCase()
      if (/(amount|balance|revenue|interest|rent|total overdue|total paid|monthly|collected)/.test(normalizedHeader)) return parseCurrencyValue(row[header]) ?? 0
      if (/(count|days|tenants|contracts|records|entries|active|overdue|days left|payments)/.test(normalizedHeader)) return Number(formatted.replace(/,/g, '')) || 0
      return formatted
    }))
    dataRows.forEach((values, index) => {
      const row = worksheet.getRow(dataHeaderRow + 1 + index)
      values.forEach((value, cellIndex) => {
        const cell = row.getCell(cellIndex + 1)
        cell.value = value
        cell.alignment = { vertical: 'top', wrapText: true }
        if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } }
        const header = headers[cellIndex].toLowerCase()
        if (/(amount|balance|revenue|interest|rent|total overdue|total paid|monthly|collected)/.test(header)) cell.numFmt = 'PHP #,##0.00'
        if (/(count|days|tenants|contracts|records|entries|active|overdue|days left|payments)/.test(header)) cell.numFmt = '#,##0'
      })
    })

    const firstDataRow = dataHeaderRow + 1
    const lastDataRow = dataHeaderRow + rows.length
    worksheet.addTable({
      name: `ReportTable${Date.now()}`,
      ref: `A${dataHeaderRow}:${String.fromCharCode(64 + Math.min(headers.length, 26))}${lastDataRow}`,
      headerRow: true,
      totalsRow: false,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: headers.map((header) => ({ name: header })),
      rows: dataRows,
    })
    worksheet.views = [{ state: 'frozen', ySplit: dataHeaderRow, showGridLines: false }]
    worksheet.autoFilter = { from: { row: dataHeaderRow, column: 1 }, to: { row: lastDataRow, column: headers.length } }

    headers.forEach((header, index) => {
      const longest = Math.max(header.length, ...rows.map((row) => formatExportValue(header, row[header]).length))
      worksheet.getColumn(index + 1).width = Math.min(Math.max(longest * 1.15 + 3, 14), 34)
    })
    worksheet.getColumn(1).width = Math.max(worksheet.getColumn(1).width || 14, 18)
    worksheet.getHeaderFooter().oddFooter = '&LConfidential report&CGenerated by PFDA Contract Monitoring System'

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${selectedReport}-report-${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const downloadPDFFromCurrentReport = () => {
    const rows = buildExportRows()
    if (!rows.length) {
      throw new Error('No report data is available to export.')
    }

    const headers = Object.keys(rows[0])
    const generatedAtDate = new Date()
    const generatedAt = generatedAtDate.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    const printedBy = user?.name?.trim()
      || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
      || user?.email
      || 'CMS Administrator'
    const escapeHtml = (value: unknown) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

    const formatCellContent = (header: string, val: string) => {
      const norm = header.toLowerCase()
      if (norm === 'status') {
        const s = (val || '').toLowerCase()
        let bg = '#f1f5f9', color = '#475569'
        if (s === 'active' || s === 'paid') { bg = '#dcfce7'; color = '#15803d'; }
        else if (s === 'overdue' || s === 'terminated') { bg = '#fee2e2'; color = '#b91c1c'; }
        else if (s === 'for_renewal' || s === 'pending') { bg = '#fef9c3'; color = '#854d0e'; }
        else if (s === 'expired') { bg = '#ffedd5'; color = '#c2410c'; }
        return '<span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:7pt;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;background:' + bg + ';color:' + color + ';">' + escapeHtml(val) + '</span>'
      }
      const isNumeric = /(amount|balance|revenue|interest|rent|due|paid|overdue|total)/i.test(norm)
      const textAlign = isNumeric ? 'text-align:right;' : 'text-align:left;'
      return '<div style="' + textAlign + '">' + escapeHtml(val) + '</div>'
    }

    const tableRows = rows.map((row) => {
      return '<tr>' + headers.map((header) => {
        const val = formatExportValue(header, row[header])
        return '<td>' + formatCellContent(header, val) + '</td>'
      }).join('') + '</tr>'
    }).join('')

    const printWindow = window.open('', '_blank', 'width=1200,height=900')
    if (!printWindow) {
      throw new Error('Please allow pop-ups to save the report as a PDF.')
    }

    const title = reports.find((report) => report.id === selectedReport)?.name || 'Report'
    const safeTitle = escapeHtml(title)
    const logoUrl = escapeHtml(new URL('/logo.png', window.location.origin).toString())
    const thCells = headers.map((h) => '<th>' + escapeHtml(h) + '</th>').join('')

    const css = [
      '@page {',
      '  size: A4 landscape;',
      '  margin: 8mm 12mm 14mm 12mm;',
      '  @bottom-left { content: ""; }',
      '  @bottom-center {',
      '    content: "This is an official document generated by the Philippine Fisheries Development Authority - Bulan Fish Port Complex Contract Monitoring System. Confidential.";',
      '    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
      '    font-size: 6.8pt;',
      '    color: #64748b;',
      '  }',
      '  @bottom-right {',
      '    content: "Page " counter(page) " of " counter(pages);',
      '    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
      '    font-size: 7.2pt;',
      '    color: #64748b;',
      '    white-space: nowrap;',
      '  }',
      '}',
      '* { box-sizing: border-box; margin: 0; padding: 0; }',
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0f172a; background: #ffffff; font-size: 8pt; line-height: 1.3; }',
      '.report-wrapper { padding: 4px; padding-bottom: 24px; }',
      /* Official Republic of the Philippines Header */
      '.gov-header { display: flex; align-items: center; justify-content: center; position: relative; text-align: center; padding: 2px 0 6px; }',
      '.gov-logo { position: absolute; left: 16px; top: 0; width: 50px; height: 50px; object-fit: contain; }',
      '.gov-text { text-align: center; line-height: 1.25; }',
      '.gov-rep { font-size: 7.5pt; color: #475569; letter-spacing: 0.05em; text-transform: uppercase; }',
      '.gov-dept { font-size: 7.5pt; color: #475569; }',
      '.gov-agency { font-size: 11pt; font-weight: 800; color: #0b2545; letter-spacing: 0.04em; margin-top: 2px; }',
      '.gov-port { font-size: 7.5pt; color: #64748b; margin-top: 1px; }',
      '.gov-divider { border-top: 2px solid #0b2545; border-bottom: 0.5px solid #0b2545; height: 2px; margin: 6px 0 10px; }',
      /* Report Title & Metadata */
      '.report-heading { text-align: center; margin-bottom: 12px; }',
      '.report-title { font-size: 13pt; font-weight: 800; color: #0b2545; letter-spacing: 0.06em; text-transform: uppercase; }',
      '.report-meta { font-size: 7.5pt; color: #64748b; margin-top: 3px; display: flex; justify-content: center; gap: 12px; align-items: center; }',
      '.report-meta strong { color: #1e293b; }',
      /* Formal Table */
      'table { width: 100%; border-collapse: collapse; font-size: 8pt; line-height: 1.25; margin-bottom: 14px; }',
      'thead { display: table-header-group; }',
      'th { background: #0b2545; color: #ffffff; font-weight: 700; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.04em; padding: 6px 8px; border: 1px solid #0b2545; white-space: nowrap; text-align: left; }',
      'td { padding: 4.5px 7px; border: 1px solid #cbd5e1; vertical-align: middle; color: #1e293b; }',
      'tr { page-break-inside: avoid; }',
      'tbody tr:nth-child(even) td { background: #f8fafc; }',
      /* Signatories */
      '.sign-section { display: flex; justify-content: space-between; margin-top: 18px; padding: 0 30px; page-break-inside: avoid; }',
      '.sign-box { width: 220px; text-align: center; }',
      '.sign-role { font-size: 7.5pt; color: #475569; font-weight: 700; text-transform: uppercase; text-align: left; }',
      '.sign-space { height: 28px; }',
      '.sign-name { font-size: 8.5pt; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.02em; }',
      '.sign-line { border-bottom: 1.5px solid #0f172a; margin: 2px 0 3px; }',
      '.sign-title { font-size: 7pt; color: #64748b; }',
      /* Fixed Screen Footer */
      '.fixed-doc-footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 5px 14px; display: flex; justify-content: center; align-items: center; background: #ffffff; border-top: 0.5px solid #e2e8f0; font-size: 6.8pt; color: #64748b; text-align: center; }',
      '@media print {',
      '  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      '  .fixed-doc-footer { display: none; }',
      '}',
    ].join(' ')

    const body = [
      '<div class="report-wrapper">',
      '  <!-- OFFICIAL LETTERHEAD -->',
      '  <div class="gov-header">',
      '    <img class="gov-logo" src="' + logoUrl + '" alt="PFDA Logo" />',
      '    <div class="gov-text">',
      '      <div class="gov-rep">Republic of the Philippines</div>',
      '      <div class="gov-dept">Department of Agriculture</div>',
      '      <div class="gov-agency">PHILIPPINE FISHERIES DEVELOPMENT AUTHORITY</div>',
      '      <div class="gov-port">Bulan Fish Port Complex &bull; Pier Site, Zone 4, Bulan, Sorsogon</div>',
      '    </div>',
      '  </div>',
      '  <div class="gov-divider"></div>',
      '  <!-- REPORT TITLE & METADATA -->',
      '  <div class="report-heading">',
      '    <div class="report-title">' + safeTitle + '</div>',
      '    <div class="report-meta">',
      '      <span><strong>As of:</strong> ' + escapeHtml(generatedAt) + '</span>',
      '      <span>&bull;</span>',
      '      <span><strong>Prepared By:</strong> ' + escapeHtml(printedBy) + '</span>',
      '      <span>&bull;</span>',
      '      <span><strong>Total Records:</strong> ' + rows.length.toLocaleString('en-US') + '</span>',
      '      <span>&bull;</span>',
      '      <span><strong>System:</strong> PFDA-BFPC CMS</span>',
      '    </div>',
      '  </div>',
      '  <!-- DATA TABLE -->',
      '  <table>',
      '    <thead><tr>' + thCells + '</tr></thead>',
      '    <tbody>' + tableRows + '</tbody>',
      '  </table>',
      '  <!-- SIGNATORIES -->',
      '  <div class="sign-section">',
      '    <div class="sign-box">',
      '      <div class="sign-role">Prepared by:</div>',
      '      <div class="sign-space"></div>',
      '      <div class="sign-name">' + escapeHtml(printedBy) + '</div>',
      '      <div class="sign-line"></div>',
      '      <div class="sign-title">Contract Monitoring System Staff</div>',
      '    </div>',
      '    <div class="sign-box">',
      '      <div class="sign-role">Noted by:</div>',
      '      <div class="sign-space"></div>',
      '      <div class="sign-name">PORT MANAGER / DESIGNEE</div>',
      '      <div class="sign-line"></div>',
      '      <div class="sign-title">PFDA Bulan Fish Port Complex</div>',
      '    </div>',
      '  </div>',
      '</div>',
      '<div class="fixed-doc-footer">',
      '  This is an official document generated by the Philippine Fisheries Development Authority - Bulan Fish Port Complex Contract Monitoring System. Confidential.',
      '</div>',
    ].join('')

    const htmlDoc = '<!DOCTYPE html><html><head><meta charset="utf-8" /><title>' + safeTitle + '</title><style>' + css + '</style></head><body>' + body + '</body></html>'
    printWindow.document.write(htmlDoc)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 400)
  }

  const handleExport = async (format: 'pdf' | 'csv') => {
    if (!selectedReport) {
      showGlobalNotice('Select a report', 'Choose a report before downloading.', 'info')
      return
    }

    setIsExporting(true)
    try {
      // Generate from the loaded report response so the screen and download
      // always use the same data, including delinquency details.
      if (format === 'pdf') {
        downloadPDFFromCurrentReport()
      } else {
        downloadCSVFromCurrentReport()
      }

      showGlobalNotice(
        'Report downloaded', `Your ${format.toUpperCase()} report was generated successfully.`,
        'success'
      )
    } catch (err: any) {
      showGlobalNotice(
        'Download failed', err?.message || `The ${format.toUpperCase()} report could not be exported. Please try again.`,
        'error'
      )
    } finally {
      setIsExporting(false)
    }
  }

  const renderSummaryCard = (key: string, value: unknown, idx: number, colors: string[]) => {
    const accentColor = colors[idx % colors.length].match(/#[0-9a-f]{6}/i)?.[0] || '#0f766e'

    return (
      <div
        key={key}
        className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{formatMetricLabel(key)}</p>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
            style={{ color: accentColor, backgroundColor: `${accentColor}14` }}
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-4 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{formatMetricValue(key, value)}</p>
      </div>
    )
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

    const hasNoData = (
      Array.isArray(reportData)
        ? reportData.length === 0
        : (reportData?.contracts?.length === 0 || reportData?.payments?.length === 0 || reportData?.tenants?.length === 0 || reportData?.logs?.length === 0 || reportData?.delinquentTenants?.length === 0 || reportData?.delinquent_tenants?.length === 0 || reportData?.expiring_contracts?.length === 0 || reportData?.expiringContracts?.length === 0 || Object.keys(reportData || {}).length === 0)
    )

    if (hasNoData && selectedReport === 'delinquency') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              ['total_delinquent_tenants', 0],
              ['total_overdue_amount', 0],
              ['tenants_30_days_overdue', 0],
              ['tenants_90_days_overdue', 0],
            ] as Array<[string, number]>).map(([key, value], idx) => {
              const colors = [
                'linear-gradient(135deg, #a53442 0%, #d14f62 100%)',
                'linear-gradient(135deg, #b8611d 0%, #d88c39 100%)',
                'linear-gradient(135deg, #8a4b7d 0%, #bc6ca7 100%)',
                'linear-gradient(135deg, #4d5fa1 0%, #6b7cc8 100%)',
              ]
              return renderSummaryCard(key, value, idx, colors)
            })}
          </div>

          <div className="rounded-2xl border border-dashed border-[#dfe6f1] bg-[#f8fafc] p-10 text-center">
            <p className="text-2xl font-semibold text-[#1f2937]">No tenants with arrears</p>
            <p className="mt-2 text-sm text-[#6b7280]">All tenant accounts are current and there are no overdue balances to display.</p>
          </div>
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
                'linear-gradient(135deg, #1d5d8c 0%, #3674b0 100%)',
                'linear-gradient(135deg, #2d7d73 0%, #47a688 100%)',
                'linear-gradient(135deg, #5b4cb3 0%, #7e71d4 100%)',
                'linear-gradient(135deg, #b86a1d 0%, #d4913a 100%)',
                'linear-gradient(135deg, #5a7785 0%, #7a96a6 100%)',
                'linear-gradient(135deg, #9c5260 0%, #c06a78 100%)',
              ]
              return renderSummaryCard(key, value, idx, colors)
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
              {contracts.slice(0, 10).map((contract: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{reportValue(contract.contractNumber || contract.contract_number)}</td>
                  <td className="px-4 py-3">{reportValue(contract.tenant?.contactPerson || contract.tenant?.contact_person || contract.tenant?.name)}</td>
                  <td className="px-4 py-3">{reportValue(contract.rentalSpace?.spaceCode || contract.rentalSpace?.space_code || contract.rental_space?.space_code || contract.rentalSpace?.name || contract.rental_space?.name)} ({reportValue(contract.rentalSpace?.spaceType || contract.rental_space?.space_type)})</td>
                  <td className="px-4 py-3">{reportAmount(contract.monthlyRent || contract.monthlyRental || contract.monthly_rental)}</td>
                  <td className="px-4 py-3">{reportDate(contract.startDate || contract.start_date)}</td>
                  <td className="px-4 py-3">{reportDate(contract.endDate || contract.end_date)}</td>
                  <td className="px-4 py-3">
                    <span className={statusColorClass(contract.status)}>
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
                'linear-gradient(135deg, #1d7b66 0%, #2ca47d 100%)',
                'linear-gradient(135deg, #285d8f 0%, #3a7bb4 100%)',
                'linear-gradient(135deg, #564aac 0%, #796bd8 100%)',
                'linear-gradient(135deg, #bf7521 0%, #d99134 100%)',
              ]
              return renderSummaryCard(key, value, idx, colors)
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
              {payments.slice(0, 10).map((payment: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{reportValue(payment.paymentNumber || payment.payment_number)}</td>
                  <td className="px-4 py-3">{reportValue(payment.contract?.contractNumber || payment.contract?.contract_number)}</td>
                  <td className="px-4 py-3">{reportValue(payment.tenant?.contactPerson || payment.tenant?.contact_person)}</td>
                  <td className="px-4 py-3">{reportAmount(payment.amountDue || payment.amount_due)}</td>
                  <td className="px-4 py-3">{reportAmount(payment.amountPaid || payment.amount_paid)}</td>
                  <td className="px-4 py-3">{reportDate(payment.dueDate || payment.due_date)}</td>
                  <td className="px-4 py-3">
                    <span className={statusColorClass(payment.status)}>
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
    } else if (reportData?.delinquentTenants || reportData?.delinquent_tenants) {
      delinquent_tenants = reportData.delinquentTenants || reportData.delinquent_tenants
      summary = reportData.summary || {}
    }
    
    if (delinquent_tenants.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-2xl text-gray-900 font-semibold">✓ Great! No tenants with arrears</p>
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
                'linear-gradient(135deg, #a53442 0%, #d14f62 100%)',
                'linear-gradient(135deg, #b8611d 0%, #d88c39 100%)',
                'linear-gradient(135deg, #8a4b7d 0%, #bc6ca7 100%)',
                'linear-gradient(135deg, #4d5fa1 0%, #6b7cc8 100%)',
              ]
              return renderSummaryCard(key, value, idx, colors)
            })}
          </div>
        )}

        {/* Tenants with arrears */}
        <div className="space-y-4">
          {delinquent_tenants.slice(0, 10).map((item: any, idx: number) => {
            const tenantName = resolveFieldValue(item, ['contactPerson', 'contact_person', 'tenantName', 'tenant_name', 'name', 'fullName', 'full_name'])
              ?? resolveFieldValue(item.tenant || {}, ['contactPerson', 'contact_person', 'name', 'fullName', 'full_name'])
            const tenantEmail = resolveFieldValue(item, ['email', 'tenantEmail', 'tenant_email', 'userEmail', 'user_email'])
              ?? resolveFieldValue(item.tenant || {}, ['email', 'userEmail', 'user_email'])
            const totalOverdue = resolveFieldValue(item, ['totalOverdue', 'total_overdue', 'totalBalance', 'total_balance', 'outstandingBalance', 'outstanding_balance', 'amount'])
            const interest = resolveFieldValue(item, ['totalInterest', 'total_interest', 'interestCharged', 'interest_charged', 'lateFee', 'late_fee'])
            const daysOverdue = resolveFieldValue(item, ['daysOverdue', 'days_overdue', 'overdueDays', 'overdue_days', 'overdueCount', 'overdue_count'])
            const oldestDue = resolveFieldValue(item, ['oldestDueDate', 'oldest_due_date', 'oldestDue', 'oldest_due', 'dueDate', 'due_date'])

            return (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{reportValue(tenantName)}</h4>
                    <p className="text-sm text-gray-600">{reportValue(tenantEmail)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{reportAmount(totalOverdue)}</p>
                    <p className="text-xs text-gray-600">{reportValue(daysOverdue, '0')} day(s) overdue</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Overdue:</span>
                    <p className="font-semibold">{reportAmount(totalOverdue)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Interest Charged:</span>
                    <p className="font-semibold">{reportAmount(interest)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Oldest Due:</span>
                    <p className="font-semibold">{reportDate(oldestDue)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderRevenueReport = () => {
    const revenueData = reportData?.data && typeof reportData.data === 'object' && !Array.isArray(reportData.data)
      ? reportData.data
      : reportData
    const monthly_revenue = revenueData?.monthlyRevenue || revenueData?.monthly_revenue || revenueData?.monthly || revenueData?.revenueByMonth || {}
    const summary = revenueData?.summary || {}
    
    return (
      <div className="space-y-6">
        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(summary).map(([key, value], idx) => {
              const colors = [
                'linear-gradient(135deg, #4f46c9 0%, #6e63d4 100%)',
                'linear-gradient(135deg, #7f3f98 0%, #a660b9 100%)',
                'linear-gradient(135deg, #2a6f85 0%, #4b96a8 100%)',
                'linear-gradient(135deg, #98552f 0%, #d5894c 100%)',
              ]
              return renderSummaryCard(key, value, idx, colors)
            })}
          </div>
        )}

        {/* Monthly Revenue Chart */}
        {monthly_revenue && Object.keys(monthly_revenue).length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Monthly Revenue Breakdown</h4>
            <div className="space-y-2">
              {(Array.isArray(monthly_revenue)
                ? monthly_revenue.map((item: any) => [item.month || item.monthName || item.month_name, item.revenue ?? item.amount ?? item.total ?? item.value])
                : Object.entries(monthly_revenue)
              ).slice(0, 10).map(([month, amount]) => (
                <div key={month} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-gray-700">{formatRevenueMonth(month)}</div>
                  <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div 
                      className="h-full bg-gray-700 rounded-lg flex items-center justify-end pr-3"
                      style={{ width: `${Math.min((parseRevenueAmount(amount) / 100000) * 100, 100)}%` }}
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
        {contracts.slice(0, 10).map((contract: any, idx: number) => {
          const endDateValue = contract.endDate || contract.end_date
          const endDate = new Date(endDateValue)
          const daysUntilExpiry = Number.isNaN(endDate.getTime()) ? 0 : Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          return (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-900">{reportValue(contract.contractNumber || contract.contract_number)}</h4>
                  <p className="text-sm text-gray-600">{reportValue(contract.tenant?.contactPerson || contract.tenant?.contact_person)} • {reportValue(contract.rentalSpace?.spaceCode || contract.rentalSpace?.space_code || contract.rental_space?.space_code || contract.rentalSpace?.name || contract.rental_space?.name)} ({reportValue(contract.rentalSpace?.spaceType || contract.rental_space?.space_type)})</p>
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
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Business Permit Number</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Active Contracts</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tenants.slice(0, 10).map((item: any, idx: number) => {
              // Handle wrapped item structure
              const tenant = item.tenant || item
              const activeContractsCount = item.active_contracts_count || 0
              
              return (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{reportValue(tenant.contactPerson || tenant.contact_person || tenant.name)}</td>
                  <td className="px-4 py-3">{reportValue(tenant.user?.email || tenant.email)}</td>
                  <td className="px-4 py-3">{reportValue(tenant.contactNumber || tenant.contact_number)}</td>
                  <td className="px-4 py-3">{reportValue(tenant.businessName || tenant.business_name)}</td>
                  <td className="px-4 py-3">{reportValue(tenant.businessPermitNumber || tenant.business_permit_number || tenant.tin)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{reportValue(item.activeContractsCount || item.active_contracts_count, '0')}</td>
                  <td className="px-4 py-3">
                    <span className={statusColorClass(tenant.status)}>
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
    } else if (reportData?.logs || reportData?.auditLogs || reportData?.audit_logs) {
      logs = reportData.logs || reportData.auditLogs || reportData.audit_logs
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
            {logs.slice(0, 10).map((log: any, idx: number) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">{reportDateTime(log.createdAt || log.created_at)}</td>
                <td className="px-4 py-3">{reportValue(log.user?.name || log.user?.email || log.userId || log.user_id, 'System')}</td>
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
      <div className="space-y-6 pb-8">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">Insights & exports</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Build, review, and export operational reports.</p>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-5">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div><h2 className="text-sm font-bold text-slate-900">Report library</h2><p className="mt-1 text-[11px] text-slate-500">Select a report to begin.</p></div>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-slate-100 px-2 text-xs font-bold text-slate-600">{reports.length}</span>
            </div>
            <div className="space-y-1.5">
              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => generateReport(report.id)}
                  aria-pressed={selectedReport === report.id}
                  className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    selectedReport === report.id
                      ? 'border-teal-200 bg-teal-50'
                      : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                  }`}
                  title={report.description}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${selectedReport === report.id ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-teal-800'}`}>
                    {(() => { const Icon = reportIcons[report.id]; return <Icon className="h-5 w-5" aria-hidden="true" /> })()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-xs font-bold ${selectedReport === report.id ? 'text-teal-950' : 'text-slate-800'}`}>{report.name}</h3>
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">{report.description}</p>
                  </div>
                  <ArrowRight className={`h-4 w-4 shrink-0 transition ${selectedReport === report.id ? 'text-teal-700' : 'text-slate-300 group-hover:text-slate-500'}`} aria-hidden="true" />
                </button>
              ))}
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
          {(selectedReport === 'contracts' || selectedReport === 'payments') && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-800"><Filter className="h-5 w-5" /></span>
                  <div><h2 className="text-sm font-bold text-slate-900">Report parameters</h2><p className="mt-0.5 text-xs text-slate-500">Narrow results by status and date range.</p></div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{selectedReport === 'contracts' ? 'Contracts' : 'Payments'}</span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-600">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-50"
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
                  <label className="mb-2 block text-xs font-semibold text-slate-600">From date</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-600">To date</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-50"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => generateReport(selectedReport)}
                    className="w-full rounded-xl bg-teal-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {!selectedReport ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-100"><BarChart3 className="h-7 w-7" /></span>
                <p className="mt-5 text-lg font-bold text-slate-900">Report workspace</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Choose a report from the library to generate data, review summaries, and export results.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600"><FileText className="h-3.5 w-3.5 text-teal-700" />Operational data</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600"><Download className="h-3.5 w-3.5 text-teal-700" />Exportable reports</span>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex min-h-72 items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50"><div className="loading-spinner" aria-hidden="true" /></div>
                  <p className="mt-4 text-sm font-semibold text-slate-700">Generating report...</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><FileText className="h-5 w-5" /></span>
                    <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {reports.find((r) => r.id === selectedReport)?.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Generated on {new Date().toLocaleString()}
                    </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleExport('pdf')}
                      disabled={isExporting || !reportData}
                      aria-busy={isExporting}
                      title="Download this report as a PDF"
                      className="group inline-flex min-w-[148px] items-center gap-3 rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 transition group-hover:bg-rose-200">
                        {isExporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-rose-900">{isExporting ? 'Preparing file…' : 'Export PDF'}</span>
                        <span className="mt-0.5 block text-[10px] font-medium text-rose-700/75">Print-ready document</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('csv')}
                      disabled={isExporting || !reportData}
                      aria-busy={isExporting}
                      title="Download this report as a CSV spreadsheet"
                      className="group inline-flex min-w-[148px] items-center gap-3 rounded-xl border border-emerald-200 bg-white px-3.5 py-2.5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-200">
                        {isExporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-emerald-900">{isExporting ? 'Preparing file…' : 'Export CSV'}</span>
                        <span className="mt-0.5 block text-[10px] font-medium text-emerald-700/75">Spreadsheet data</span>
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-5 p-5 sm:p-6">{renderReportContent()}</div>
              </div>
            )}
          </section>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
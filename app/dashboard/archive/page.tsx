'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import Pagination from '@/components/Pagination'
import apiClient from '@/lib/api-client'
import { Archive, CalendarDays, CreditCard, Eye, FileText, RotateCcw } from 'lucide-react'
import { formatCalendarDate } from '@/lib/date-format'

type ArchiveStatus = 'terminated' | 'expired'

const extractContracts = (response: any): any[] => {
  const data = response?.data ?? response
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  return []
}

const getContractLabel = (contract: any) =>
  contract.contractNumber || contract.contract_number || `Contract ${contract.id}`

const getTenantLabel = (contract: any) =>
  contract.tenant?.contactPerson ||
  contract.tenant?.contact_person ||
  contract.tenant?.user?.name ||
  'N/A'

const getSpaceLabel = (contract: any) => {
  const space = contract.rentalSpace || contract.rental_space
  return space?.spaceCode || space?.space_code || space?.name || space?.spaceNumber || 'N/A'
}

export default function ArchivePage() {
  const { user } = useAuth()
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN'
  const canRestorePayment = user?.role?.toUpperCase() === 'CASHIER'
  const [status, setStatus] = useState<ArchiveStatus>('terminated')
  const [contracts, setContracts] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [paymentPage, setPaymentPage] = useState(1)

  const loadArchive = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [contractsResponse, paymentsResponse] = await Promise.all([
        apiClient.getContracts({ status }),
        apiClient.getArchivedPayments(),
      ])
      setContracts(extractContracts(contractsResponse))
      setPayments(extractContracts(paymentsResponse))
      setCurrentPage(1)
      setPaymentPage(1)
    } catch (err: any) {
      setContracts([])
      setError(err.message || 'Unable to load archived records')
    } finally {
      setIsLoading(false)
    }
  }, [status])

  const restorePayment = async (paymentId: string) => {
    if (!canRestorePayment) return
    try {
      await apiClient.restorePayment(paymentId)
      setPayments((current) => current.filter((payment) => String(payment.id) !== paymentId))
    } catch (err: any) {
      setError(err.message || 'Unable to restore payment')
    }
  }

  const resumeContract = async (contractId: string) => {
    if (!isAdmin) return
    try {
      await apiClient.activateContract(contractId)
      setContracts((current) => current.filter((contract) => String(contract.id) !== contractId))
    } catch (err: any) {
      setError(err.message || 'Unable to resume contract')
    }
  }

  useEffect(() => {
    void loadArchive()
    const interval = window.setInterval(() => void loadArchive(), 30000)
    return () => window.clearInterval(interval)
  }, [loadArchive])

  const visibleContracts = useMemo(
    () => contracts.slice((currentPage - 1) * 10, currentPage * 10),
    [contracts, currentPage],
  )
  const visiblePayments = useMemo(
    () => payments.slice((paymentPage - 1) * 10, paymentPage * 10),
    [payments, paymentPage],
  )

  return (
    <ProtectedRoute>
      <div className="space-y-6 pb-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200">
              <Archive className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">Records management</p>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Archive</h1>
              <p className="mt-1 text-sm text-slate-500">Browse closed contracts and archived payments.</p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500" aria-live="polite">Updates automatically</span>
        </div>

        <section aria-label="Archive summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ArchiveMetric icon={<FileText className="h-4 w-4" />} label="Contract records" value={contracts.length} tone="text-slate-900" />
          <ArchiveMetric icon={<CreditCard className="h-4 w-4" />} label="Archived payments" value={payments.length} tone="text-sky-800" />
          <ArchiveMetric icon={<CalendarDays className="h-4 w-4" />} label="Contract archive view" value={status} tone="text-teal-800" />
        </section>

        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="Contract archive status">
          {(['terminated', 'expired'] as ArchiveStatus[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              role="tab"
              aria-selected={status === option}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold capitalize transition ${status === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {option}
            </button>
          ))}
        </div>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${status === 'terminated' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}><FileText className="h-5 w-5" /></span>
              <div><h2 className="text-sm font-bold capitalize text-slate-900">{status} contracts</h2><p className="mt-0.5 text-xs text-slate-500">Closed agreements and their rental periods.</p></div>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold tabular-nums text-slate-600">{contracts.length} records</span>
          </div>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center gap-3 text-sm text-slate-500"><span className="loading-spinner" aria-hidden="true" />Loading contracts...</div>
          ) : visibleContracts.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Archive className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-semibold text-slate-700">No {status} contracts found</p>
              <p className="mt-1 text-xs text-slate-500">Archived contract records will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50/80">
                  <tr>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Contract</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Tenant</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Rental space</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Rental period</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Status</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleContracts.map((contract) => (
                    <tr key={contract.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-slate-900">{getContractLabel(contract)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{getTenantLabel(contract)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{getSpaceLabel(contract)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs font-medium text-slate-600">
                        {formatCalendarDate(contract.startDate || contract.start_date)} to {formatCalendarDate(contract.endDate || contract.end_date)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold capitalize text-slate-600">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${String(contract.status || status).toLowerCase() === 'terminated' ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                          {contract.status || status}
                        </span>
                      </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/contracts/${contract.id}`}
                              title="View contract"
                              aria-label="View contract"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            </Link>
                            {isAdmin && status === 'terminated' && (
                              <button type="button" onClick={() => void resumeContract(String(contract.id))} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"><RotateCcw className="h-3.5 w-3.5" />Resume</button>
                            )}
                          </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {!isLoading && <Pagination currentPage={currentPage} totalItems={contracts.length} onPageChange={setCurrentPage} />}

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-800"><CreditCard className="h-5 w-5" /></span>
              <div><h2 className="text-lg font-bold text-slate-900">Archived payments</h2><p className="text-sm text-slate-500">Payments archived from cashier and payment records.</p></div>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold tabular-nums text-slate-600">{payments.length} records</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center gap-3 text-sm text-slate-500"><span className="loading-spinner" aria-hidden="true" />Loading archived payments...</div>
            ) : payments.length === 0 ? (
              <div className="flex min-h-36 flex-col items-center justify-center px-4 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><CreditCard className="h-5 w-5" /></span>
                <p className="mt-3 text-sm font-semibold text-slate-700">No archived payments found</p>
                <p className="mt-1 text-xs text-slate-500">Archived payment records will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left">
                  <thead className="border-b border-slate-100 bg-slate-50/80">
                    <tr>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Payment</th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Contract</th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Amount</th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visiblePayments.map((payment) => (
                      <tr key={payment.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-5 py-4 text-sm font-bold text-slate-900">{payment.paymentNumber || payment.payment_number || `Payment ${payment.id}`}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{payment.contract?.contractNumber || payment.contract?.contract_number || 'N/A'}</td>
                        <td className="px-5 py-4 text-sm font-semibold tabular-nums text-slate-800">₱{Number(payment.totalAmount || payment.total_amount || payment.amountDue || payment.amount_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-4">
                          {canRestorePayment && <button type="button" onClick={() => void restorePayment(String(payment.id))} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"><RotateCcw className="h-3.5 w-3.5" />Restore</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!isLoading && <Pagination currentPage={paymentPage} totalItems={payments.length} onPageChange={setPaymentPage} />}
        </section>
      </div>
    </ProtectedRoute>
  )
}

function ArchiveMetric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className={`mt-1 truncate text-lg font-bold capitalize ${tone}`}>{value}</p>
      </div>
    </div>
  )
}

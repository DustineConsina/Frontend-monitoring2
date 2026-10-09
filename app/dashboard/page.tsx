'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import apiClient from '@/lib/api-client'
import { Contract, DashboardStats, Payment } from '@/types'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ArrowUpRight, Banknote, Building2, CalendarClock, FileText, RefreshCw, Users } from 'lucide-react'

function extractDashboardList<T>(response: unknown): T[] {
  const payload = response && typeof response === 'object' ? response as Record<string, unknown> : null
  const nestedData = payload?.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : null
  const candidates: unknown[] = [nestedData?.data, payload?.data, response]
  return (candidates.find(Array.isArray) || []) as T[]
}

function getDaysUntil(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  const targetDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const currentDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((targetDay - currentDay) / 86400000)
}

function formatDashboardDate(value?: string | number | Date | null): string {
  if (value === null || value === undefined || value === '') return 'Date unavailable'

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString()
}

function getContractSpaceLabel(contract: Contract | null | undefined): string {
  if (!contract) return 'Space not assigned'

  const space = contract.rentalSpace || contract.rental_space
  if (!space) return 'Space not assigned'

  return space.name || space.spaceCode || space.space_code || space.spaceNumber || space.space_number || 'Space not assigned'
}

function parseDashboardAmount(value?: string | number): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const text = String(value).trim()
  if (!text) return null

  const normalized = text.startsWith('(') && text.endsWith(')') ? `-${text.slice(1, -1)}` : text
  const cleaned = normalized.replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, '').replace(/,/g, '')
  const amount = Number.parseFloat(cleaned)

  return Number.isFinite(amount) ? amount : null
}

function formatDashboardAmount(value?: string | number): string {
  const amount = parseDashboardAmount(value)
  return amount !== null ? `₱${amount.toLocaleString()}` : 'Amount unavailable'
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    let isMounted = true

    if (user?.role && user.role.toUpperCase() === 'CASHIER') {
      router.push('/dashboard/cashier')
      return () => {
        isMounted = false
      }
    }

    fetchDashboardStats(isMounted)
    const interval = setInterval(() => fetchDashboardStats(isMounted), 30000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [user, router])

  const fetchDashboardStats = async (isMounted = true) => {
    try {
      if (!isMounted || !localStorage.getItem('auth_token')) return

      setIsRefreshing(true)
      const [statsResult, contractsResult, paymentsResult] = await Promise.allSettled([
        apiClient.getDashboardStats(),
        apiClient.getContracts({ per_page: 1000 }),
        apiClient.getPayments(undefined, { per_page: 1000 }),
      ])
      if (!isMounted) return

      if (statsResult.status === 'rejected') throw statsResult.reason
      setStats(statsResult.value)
      if (contractsResult.status === 'fulfilled') setContracts(extractDashboardList<Contract>(contractsResult.value))
      if (paymentsResult.status === 'fulfilled') setPayments(extractDashboardList<Payment>(paymentsResult.value))
      setLastUpdated(new Date())
      setError(null)
    } catch (err: unknown) {
      const status = err instanceof Error ? (err as Error & { status?: number }).status : undefined
      if (!isMounted || (status === 401 && !localStorage.getItem('auth_token'))) return

      const message = err instanceof Error ? err.message : 'Failed to load dashboard statistics'
      setError(message)
      console.warn('Dashboard stats unavailable; displaying empty state.', message)
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }

  const agenda = [
    ...payments.map((payment) => {
      const dueDate = payment.dueDate || payment.due_date
      const days = getDaysUntil(dueDate)
      const status = String(payment.status || '').toLowerCase()
      const amount = payment.balance ?? payment.amountDue ?? payment.amount_due ?? payment.totalAmount ?? payment.total_amount
      return days !== null && days >= 0 && days <= 30 && status !== 'paid'
        ? { id: `due-${payment.id}`, date: dueDate, title: payment.paymentFor || payment.payment_for || 'Rent payment', detail: `Due ${days === 0 ? 'today' : `in ${days} days`} · ${formatDashboardAmount(amount)}`, href: payment.id ? `/dashboard/payments/${payment.id}` : '/dashboard/payments' }
        : null
    }),
    ...contracts.map((contract) => {
      const endDate = contract.endDate || contract.end_date
      const days = getDaysUntil(endDate)
      return days !== null && days >= 0 && days <= 30 && !['terminated', 'expired', 'renewed'].includes(String(contract.status || '').toLowerCase())
        ? { id: `expiry-${contract.id}`, date: endDate, title: `Lease expires · ${contract.contractNumber || contract.contract_number || 'Contract'}`, detail: `${days === 0 ? 'Today' : `In ${days} days`} · ${getContractSpaceLabel(contract)}`, href: contract.id ? `/dashboard/contracts/${contract.id}` : '/dashboard/contracts' }
        : null
    }),
  ].filter((event): event is { id: string; date: string; title: string; detail: string; href: string } => Boolean(event))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6)

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-[55vh] items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50"><div className="loading-spinner" aria-hidden="true" /></div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Loading dashboard</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6 pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800"><Building2 className="h-3.5 w-3.5" /> Operations overview</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">Contracts, collections, and day-to-day portfolio activity.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {lastUpdated && <span className="text-xs text-slate-500">Updated {lastUpdated.toLocaleTimeString()}</span>}
            <button
              type="button"
              onClick={() => fetchDashboardStats()}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 text-teal-700 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isRefreshing ? 'Refreshing…' : 'Refresh dashboard'}
            </button>
          </div>
        </div>

        <section aria-label="Dashboard summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryMetric icon={<FileText className="h-4 w-4" />} label="Active contracts" value={stats?.activeContracts || 0} />
          <SummaryMetric icon={<Banknote className="h-4 w-4" />} label="Total revenue" value={formatDashboardAmount(stats?.totalRevenue)} />
          <SummaryMetric icon={<Users className="h-4 w-4" />} label="Tenants" value={stats?.totalTenants || 0} />
        </section>

        {error && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            <p className="text-sm font-medium">{error}</p>
            <button type="button" aria-label="Dismiss dashboard error" onClick={() => setError(null)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-rose-600 transition hover:bg-rose-100 hover:text-rose-800">×</button>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><CalendarClock className="h-5 w-5" /></span><div><h2 className="text-sm font-bold text-slate-900">Next 30 days</h2><p className="text-xs text-slate-500">Upcoming rent due dates and lease expirations</p></div></div>
            <Link href="/dashboard/reports" className="rounded-lg px-3 py-2 text-xs font-semibold text-teal-800 transition hover:bg-teal-50">Open reports</Link>
          </div>
          {agenda.length ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{agenda.map((event) => (
            <Link href={event.href} key={event.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-sky-200 hover:bg-sky-50/60 hover:shadow-sm">
              <div className="flex h-12 min-w-12 flex-col items-center justify-center rounded-lg bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-100"><span className="text-[9px] font-bold uppercase">{new Date(event.date).toLocaleDateString(undefined, { month: 'short' })}</span><span className="text-base font-black leading-4">{new Date(event.date).getDate()}</span></div>
              <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{event.title}</p><p className="mt-1 truncate text-[11px] text-slate-500">{event.detail}</p></div>
            </Link>
          ))}</div> : <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Nothing scheduled in the next 30 days.</p>}
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.85fr]">
          <AnalyticsPanel title="Total Revenue" subtitle="Revenue from recent payments" action="View Report" href="/dashboard/reports">
            <div className="mb-3 text-2xl font-bold tracking-tight text-slate-900">{formatDashboardAmount(stats?.totalRevenue)}</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={(stats?.recentPayments || []).slice(0, 8).map((payment, index) => ({
                label: payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-US', { month: 'short' }) : `P${index + 1}`,
                current: parseDashboardAmount(payment.totalAmount ?? payment.amount) ?? 0,
              }))}>
                <CartesianGrid stroke="#eef0f5" vertical={false} strokeDasharray="3 4" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#a3a9b8', fontSize: 10 }} />
                <YAxis hide />
                <Tooltip formatter={(value) => [formatDashboardAmount(typeof value === 'string' || typeof value === 'number' ? value : undefined), 'Revenue']} />
                <Bar dataKey="current" fill="#087f8c" radius={[2, 2, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
            <ChartLegend items={[['#087f8c', 'Current'], ['#cbd7da', 'Previous period']]} />
          </AnalyticsPanel>

          <AnalyticsPanel title="Total Tenant" subtitle="Registered tenants" action="View" href="/dashboard/tenants">
            <div className="relative flex items-center justify-center py-2">
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={[{ name: 'Active contracts', value: stats?.activeContracts || 0 }, { name: 'Other contracts', value: Math.max((stats?.totalContracts || 0) - (stats?.activeContracts || 0), 0) }]} innerRadius={52} outerRadius={70} paddingAngle={3} dataKey="value">
                    <Cell fill="#087f8c" />
                    <Cell fill="#cbd7da" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute text-center"><div className="text-2xl font-bold text-slate-900">{stats?.totalTenants || 0}</div><div className="text-[10px] font-medium text-slate-500">Tenants</div></div>
            </div>
          </AnalyticsPanel>

          <AnalyticsPanel title="Current contract and payment status" subtitle="Current portfolio activity" action="View" href="/dashboard/contracts">
            <div className="flex min-h-[190px] items-center justify-center gap-3">
              <ActivityBubble value={stats?.overduePayments || 0} label="Overdue" color="#b94755" />
              <ActivityBubble value={stats?.activeContracts || 0} label="Active" color="#0b5963" large />
              <ActivityBubble value={stats?.pendingPayments || 0} label="Pending" color="#527c9f" />
            </div>
          </AnalyticsPanel>

          <AnalyticsPanel title="Number of Transactions" subtitle="Recent payment activity" action="View" href="/dashboard/payments">
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={(stats?.recentPayments || []).slice(0, 8).map((payment, index) => ({ label: index + 1, value: payment.totalAmount || payment.amount || 0 }))}>
                <CartesianGrid stroke="#eef0f5" vertical={false} strokeDasharray="3 4" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#a3a9b8', fontSize: 10 }} />
                <YAxis hide />
                <Tooltip formatter={(value) => [`₱${Number(value).toLocaleString()}`, 'Amount']} />
                <Line type="monotone" dataKey="value" stroke="#087f8c" strokeWidth={2} dot={{ r: 3, fill: '#087f8c' }} />
              </LineChart>
            </ResponsiveContainer>
            <ChartLegend items={[['#087f8c', 'Current'], ['#cbd7da', 'Previous period']]} />
          </AnalyticsPanel>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <PanelCard
            title="Recent Payments"
            viewAllHref="/dashboard/payments"
            items={stats?.recentPayments?.slice(0, 5).map((payment) => ({
              id: payment.id ?? payment.paymentFor ?? 'payment',
              primary: payment.paymentFor || 'Payment',
              secondary: formatDashboardDate(payment.paymentDate || payment.payment_date || payment.dueDate || payment.due_date || payment.createdAt || payment.created_at),
              value: formatDashboardAmount(payment.totalAmount ?? payment.total_amount ?? payment.amountPaid ?? payment.amount_paid ?? payment.amount),
            })) || []}
            emptyText="No recent payments"
          />

          <PanelCard
            title="Expiring Soon"
            viewAllHref="/dashboard/contracts"
            items={stats?.expiringContracts?.slice(0, 5).map((contract) => ({
              id: contract.id ?? contract.contractNumber ?? 'contract',
              primary: contract.contractNumber || 'Contract',
              secondary: getContractSpaceLabel(contract),
              value: `Expires: ${formatDashboardDate(contract.endDate || contract.end_date)}`,
            })) || []}
            emptyText="No expiring contracts"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h3 className="text-base font-bold text-slate-900">Quick actions</h3>
            <p className="mt-1 text-xs text-slate-500">Shortcuts to common tasks.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <QuickActionButton href="/dashboard/contracts/new" label="New Contract" icon={<FileText className="h-5 w-5" />} />
            <QuickActionButton href="/dashboard/payments/new" label="Record Payment" icon={<Banknote className="h-5 w-5" />} />
            <QuickActionButton href="/dashboard/tenants/new" label="Add Tenant" icon={<Users className="h-5 w-5" />} />
            <QuickActionButton href="/dashboard/reports" label="Generate Report" icon={<ArrowUpRight className="h-5 w-5" />} />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

function SummaryMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">{value}</p>
      </div>
    </div>
  )
}

function AnalyticsPanel({
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <Link href={href} className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-[10px] font-bold text-teal-800 transition hover:border-teal-200 hover:bg-teal-100">
          {action}
        </Link>
      </div>
      {children}
    </section>
  )
}

function ChartLegend({ items }: { items: string[][] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-[#8d95a8]">
      {items.map(([color, label]) => (
        <span key={label} className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>
      ))}
    </div>
  )
}

function ActivityBubble({ value, label, color, large = false }: { value: number; label: string; color: string; large?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-white/20 text-white shadow-sm ring-1 ring-black/5 ${large ? 'h-32 w-32' : 'h-24 w-24'}`}
      style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)` }}
    >
      <span className={large ? 'text-2xl font-black' : 'text-lg font-bold'}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</span>
    </div>
  )
}

function PanelCard({
  title,
  viewAllHref,
  items,
  emptyText,
}: {
  title: string
  viewAllHref: string
  items: Array<{ id: string | number; primary: string; secondary: string; value: string }>
  emptyText: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <Link href={viewAllHref} className="rounded-lg px-3 py-2 text-[11px] font-semibold text-teal-800 transition hover:bg-teal-50">
              View All
        </Link>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-3 transition hover:border-slate-200 hover:bg-slate-50">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800">{item.primary}</div>
                <div className="mt-1 text-[11px] text-slate-500">{item.secondary}</div>
              </div>
              <div className="shrink-0 text-right text-[11px] font-semibold text-teal-800">{item.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-slate-500">{emptyText}</p>
      )}
    </div>
  )
}

function QuickActionButton({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/50 hover:shadow-sm"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-teal-100 group-hover:text-teal-800">{icon}</span>
      <span className="text-xs font-bold text-slate-700 transition group-hover:text-teal-900">{label}</span>
      <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-teal-700" aria-hidden="true" />
    </Link>
  )
}

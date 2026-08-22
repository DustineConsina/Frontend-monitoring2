'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import apiClient from '@/lib/api-client'
import { PFDALogo } from '@/components/PFDALogo'
import { DashboardStats } from '@/types'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

function formatDashboardDate(value?: string | number): string {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString()
}

function formatDashboardAmount(value?: string | number): string {
  const amount = typeof value === 'number' ? value : Number.parseFloat(String(value || '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(amount) ? `₱${amount.toLocaleString()}` : 'Amount unavailable'
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
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
      const data = await apiClient.getDashboardStats()
      if (!isMounted) return

      setStats(data)
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

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-9 w-9 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Loading dashboard</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="border-b border-[#e8eaf1] pb-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="mb-2 text-[11px] font-semibold text-[#5663c4]">Dashboard</div>
                <h1 className="text-2xl font-medium tracking-tight text-[#354057]">Dashboard Overview</h1>
                <p className="mt-1 text-xs text-[#9aa1b3]">Welcome to the PFDA Contract Monitoring System</p>
                {lastUpdated && (
                  <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[#9aa1b3]">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => fetchDashboardStats()}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#5148e5] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#4038c7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
                  Refreshing...
                </>
              ) : (
                'Refresh'
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-md border border-[#ed5b69]/20 bg-[#fff2f4] p-4 text-[#c44d5b]">
            <p className="text-sm font-medium">{error}</p>
            <button onClick={() => setError(null)} className="text-xl leading-none text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.85fr]">
          <AnalyticsPanel title="Total Revenue" subtitle="Revenue from recent payments" action="View Report" href="/dashboard/reports">
            <div className="mb-3 text-lg font-semibold text-[#28334b]">₱{(stats?.totalRevenue || 0).toLocaleString()}</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={(stats?.recentPayments || []).slice(0, 8).map((payment, index) => ({
                label: payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-US', { month: 'short' }) : `P${index + 1}`,
                current: payment.totalAmount || payment.amount || 0,
              }))}>
                <CartesianGrid stroke="#eef0f5" vertical={false} strokeDasharray="3 4" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#a3a9b8', fontSize: 10 }} />
                <YAxis hide />
                <Tooltip formatter={(value) => [`₱${Number(value).toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="current" fill="#5c68c9" radius={[2, 2, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
            <ChartLegend items={[['#5c68c9', 'Current'], ['#d9dce7', 'Previous period']]} />
          </AnalyticsPanel>

          <AnalyticsPanel title="Total Tenant" subtitle="Registered tenants" action="View" href="/dashboard/tenants">
            <div className="relative flex items-center justify-center py-2">
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={[{ name: 'Active contracts', value: stats?.activeContracts || 0 }, { name: 'Other contracts', value: Math.max((stats?.totalContracts || 0) - (stats?.activeContracts || 0), 0) }]} innerRadius={52} outerRadius={70} paddingAngle={3} dataKey="value">
                    <Cell fill="#5c68c9" />
                    <Cell fill="#d9dcef" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute text-center"><div className="text-2xl font-semibold text-[#28334b]">{stats?.totalTenants || 0}</div><div className="text-[10px] text-[#9aa1b3]">Tenants</div></div>
            </div>
          </AnalyticsPanel>

          <AnalyticsPanel title="Recent Activities" subtitle="Current contract status" action="View" href="/dashboard/contracts">
            <div className="flex min-h-[190px] items-center justify-center gap-2">
              <ActivityBubble value={stats?.delinquentContracts || 0} label="Overdue" color="#ed5b69" />
              <ActivityBubble value={stats?.activeContracts || 0} label="Active" color="#f5a43b" large />
              <ActivityBubble value={stats?.pendingPayments || 0} label="Pending" color="#42bdd9" />
            </div>
          </AnalyticsPanel>

          <AnalyticsPanel title="Number of Transactions" subtitle="Recent payment activity" action="View" href="/dashboard/payments">
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={(stats?.recentPayments || []).slice(0, 8).map((payment, index) => ({ label: index + 1, value: payment.totalAmount || payment.amount || 0 }))}>
                <CartesianGrid stroke="#eef0f5" vertical={false} strokeDasharray="3 4" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#a3a9b8', fontSize: 10 }} />
                <YAxis hide />
                <Tooltip formatter={(value) => [`₱${Number(value).toLocaleString()}`, 'Amount']} />
                <Line type="monotone" dataKey="value" stroke="#5c68c9" strokeWidth={2} dot={{ r: 3, fill: '#5c68c9' }} />
              </LineChart>
            </ResponsiveContainer>
            <ChartLegend items={[['#5c68c9', 'Current'], ['#d9dce7', 'Previous period']]} />
          </AnalyticsPanel>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <PanelCard
            title="Recent Payments"
            viewAllHref="/dashboard/payments"
            items={stats?.recentPayments?.slice(0, 5).map((payment) => ({
              id: payment.id ?? payment.paymentFor ?? 'payment',
              primary: payment.paymentFor || 'Payment',
              secondary: formatDashboardDate(payment.paymentDate || payment.payment_date || payment.createdAt || payment.created_at),
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
              secondary: contract.rentalSpace?.spaceNumber || 'Space not assigned',
              value: `Expires: ${formatDashboardDate(contract.endDate || contract.end_date)}`,
            })) || []}
            emptyText="No expiring contracts"
          />
        </div>

        <div className="rounded-md border border-[#e8eaf1] bg-white p-5 shadow-[0_10px_28px_rgba(39,48,80,0.04)]">
          <h3 className="mb-5 text-base font-semibold text-[#28334b]">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <QuickActionButton href="/dashboard/contracts/new" label="New Contract" />
            <QuickActionButton href="/dashboard/payments/new" label="Record Payment" />
            <QuickActionButton href="/dashboard/tenants/new" label="Add Tenant" />
            <QuickActionButton href="/dashboard/reports" label="Generate Report" />
          </div>
        </div>
      </div>
    </ProtectedRoute>
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
    <section className="rounded-md border border-[#e8eaf1] bg-white p-5 shadow-[0_10px_28px_rgba(39,48,80,0.04)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#28334b]">{title}</h2>
          <p className="mt-1 text-[10px] text-[#9aa1b3]">{subtitle}</p>
        </div>
        <Link href={href} className="rounded-md border border-[#e8eaf1] px-3 py-1.5 text-[10px] font-semibold text-[#5964c7] transition hover:bg-[#eef0ff]">
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
    <div className={`flex flex-col items-center justify-center rounded-full text-white shadow-[0_4px_10px_rgba(39,48,80,0.12)] ${large ? 'h-32 w-32' : 'h-20 w-20'}`} style={{ backgroundColor: color }}>
      <span className={large ? 'text-2xl' : 'text-lg'}>{value}</span>
      <span className="text-[10px]">{label}</span>
    </div>
  )
}

function StatsCard({ title, value, link }: { title: string; value: string | number; link?: string }) {
  const card = (
    <div className="rounded-md border border-[#e8eaf1] bg-white p-5 shadow-[0_8px_22px_rgba(39,48,80,0.04)] transition-transform duration-200 hover:-translate-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5663c4]">{title}</p>
      <p className="mt-3 text-2xl font-semibold text-[#28334b]">{value}</p>
    </div>
  )

  if (link) {
    return <Link href={link}>{card}</Link>
  }

  return card
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[#e8eaf1] bg-[#fafaff] p-4">
      <span className="text-xs text-[#7d8699]">{label}</span>
      <span className="text-base font-semibold text-[#28334b]">{value}</span>
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
    <div className="rounded-md border border-[#e8eaf1] bg-white p-5 shadow-[0_10px_28px_rgba(39,48,80,0.04)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[#28334b]">{title}</h3>
        <Link href={viewAllHref} className="text-[11px] font-semibold text-[#5148e5] hover:text-[#4038c7]">
          View All →
        </Link>
      </div>

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 border-b border-[#eef0f5] px-1 py-3 last:border-0">
              <div>
                <div className="text-xs font-semibold text-[#46516b]">{item.primary}</div>
                <div className="mt-1 text-[11px] text-[#9aa1b3]">{item.secondary}</div>
              </div>
              <div className="text-[11px] font-semibold text-[#5148e5]">{item.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-slate-500">{emptyText}</p>
      )}
    </div>
  )
}

function QuickActionButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[88px] items-center justify-center rounded-md border border-[#e8eaf1] bg-[#fafaff] px-4 text-center text-xs font-semibold text-[#657089] transition hover:border-[#bfc4f4] hover:bg-[#eef0ff] hover:text-[#5148e5]"
    >
      {label}
    </Link>
  )
}

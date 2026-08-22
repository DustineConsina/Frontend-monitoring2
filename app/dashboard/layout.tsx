'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLoading } from '@/contexts/LoadingContext'
import { PFDALogo } from '@/components/PFDALogo'
import { useState } from 'react'
import { Bell, Menu, X } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { setIsLoading } = useLoading()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await logout()
    } finally {
      setIsLoading(false)
    }
  }

  let navigation = []

  if (user?.role && user.role.toUpperCase() === 'CASHIER') {
    navigation = [
      { name: 'Collection Dashboard', href: '/dashboard/cashier' },
      { name: 'Payments', href: '/dashboard/payments' },
      { name: 'Messages', href: '/dashboard/messages' },
      { name: 'Notifications', href: '/dashboard/notifications' },
    ]
  } else if (user?.role && (user.role.toUpperCase() === 'ADMIN' || user.role.toUpperCase() === 'STAFF')) {
    navigation = [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'Contracts', href: '/dashboard/contracts' },
      { name: 'Payments', href: '/dashboard/payments' },
      { name: 'Tenants', href: '/dashboard/tenants' },
      { name: 'Rental Spaces', href: '/dashboard/spaces' },
      { name: 'Messages', href: '/dashboard/messages' },
      { name: 'Reports', href: '/dashboard/reports' },
      { name: 'Notifications', href: '/dashboard/notifications' },
      { name: 'Audit Logs', href: '/dashboard/audit-logs' },
    ]
  } else {
    navigation = [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'My Contracts', href: '/dashboard/contracts' },
      { name: 'Payments', href: '/dashboard/payments' },
      { name: 'Messages', href: '/dashboard/messages' },
      { name: 'Notifications', href: '/dashboard/notifications' },
    ]
  }

  return (
    <div className="flex h-screen bg-[#f7f8fc] text-[#28334b]">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-[#e3e5ee] bg-[#f0f1f7] shadow-[8px_0_24px_rgba(39,48,80,0.03)] transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[#e3e5ee] px-4 py-5">
            <Link href="/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-90">
              <div className="rounded-full bg-[#5c68c9] p-1 shadow-[0_5px_12px_rgba(92,104,201,0.24)]">
                <div className="h-12 w-12" style={{ transform: 'scale(0.8)' }}>
                  <PFDALogo />
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold tracking-[0.1em] text-[#5663c4]">PFDA</div>
                <div className="text-[9px] uppercase tracking-[0.16em] text-[#9ba2b3]">Contract Monitor</div>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-6">
            <div className="space-y-1">
              <div className="mb-3 px-3 text-[9px] uppercase tracking-[0.18em] text-[#9aa1b3]">Menu</div>
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center rounded-md px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-[#dfe2f8] text-[#5964c7] shadow-[0_6px_14px_rgba(81,72,229,0.08)]'
                        : 'text-[#858da0] hover:bg-white hover:text-[#5964c7]'
                    }`}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </nav>

          <div className="border-t border-[#e3e5ee] bg-[#eaebf2] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5c68c9] text-xs font-bold text-white">
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-[#46516b]">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="truncate text-[9px] uppercase tracking-[0.15em] text-[#9ba2b3]">{user?.role}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full rounded-md border border-[#d9dce7] bg-white px-4 py-2 text-[11px] font-semibold text-[#7b8397] transition hover:bg-[#f6f6fa]"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex min-h-16 items-center border-b border-[#e5e7ef] bg-white px-4 lg:px-8">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="mr-4 rounded-md border border-[#e1e3ed] p-2 text-[#6d7690] hover:bg-[#f2f3f8] lg:hidden"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="ml-auto flex items-center gap-4 text-[#7d8699]">
            <Bell className="h-4 w-4" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#eef0f7] p-5 lg:p-8">
          {children}
        </main>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  )
}

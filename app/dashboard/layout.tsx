'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLoading } from '@/contexts/LoadingContext'
import { PFDALogo } from '@/components/PFDALogo'
import QRScannerModal from '@/components/QRScannerModal'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellRing, CheckCheck, CircleCheck, CreditCard, FileText, Inbox, Menu, ScanLine, X } from 'lucide-react'
import apiClient from '@/lib/api-client'

interface HeaderNotification {
  id: string
  type: string
  title: string
  message: string
  createdAt?: string
  isRead?: boolean
}

const NOTIFICATION_PAGE_SIZE = 8

const getNotificationTimestamp = (value?: string) => {
  if (!value) return new Date().toISOString()
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) {
    return new Date().toISOString()
  }
  return timestamp.toISOString()
}

const formatRelativeTime = (value?: string) => {
  if (!value) return 'Just now'

  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) {
    return 'Just now'
  }

  const diffInSeconds = Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 1000))

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minute${Math.floor(diffInSeconds / 60) === 1 ? '' : 's'} ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) === 1 ? '' : 's'} ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) === 1 ? '' : 's'} ago`

  return timestamp.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: timestamp.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

const normalizeNotification = (notification: Record<string, unknown> | null | undefined): HeaderNotification => {
  const source = notification ?? {}
  const id = String(source.id ?? source.notification_id ?? source.notificationId ?? source.uuid ?? `${source.type ?? 'notification'}-${source.createdAt ?? Date.now()}`)

  const rawType = String(source.type ?? source.notificationType ?? 'GENERAL')
  const rawTitle = String(source.title ?? source.subject ?? rawType ?? 'New notification')
  const rawMessage = String(source.message ?? source.content ?? source.body ?? 'You have a new notification.')

  const typeKey = rawType.toLowerCase()
  const isOverdueNotification = typeKey.includes('overdue') || /overdue/i.test(rawTitle) || /overdue/i.test(rawMessage)

  const title = isOverdueNotification
    ? (rawTitle.toLowerCase().includes('due') ? 'Payment is overdue' : rawTitle || 'Payment is overdue')
    : rawTitle

  const message = isOverdueNotification
    ? rawMessage.replace(/payment is due/gi, 'Payment is overdue').replace(/payment due/gi, 'Payment is overdue').replace(/payment overdue/gi, 'Payment is overdue') || 'This payment is overdue.'
    : rawMessage

  return {
    id,
    type: rawType,
    title,
    message,
    createdAt: getNotificationTimestamp(String(source.createdAt ?? source.created_at ?? source.sentDate ?? source.sent_date ?? new Date().toISOString())),
    isRead: Boolean(source.isRead ?? source.is_read ?? source.read ?? false),
  }
}

const sortNotifications = (items: HeaderNotification[]) => [...items].sort((a, b) => {
  const unreadDiff = Number(!!a.isRead) - Number(!!b.isRead)
  if (unreadDiff !== 0) return unreadDiff

  return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
})

const getNotificationCategory = (notification: HeaderNotification) => {
  const content = `${notification.type} ${notification.title} ${notification.message}`.toLowerCase()
  if (content.includes('payment') || content.includes('overdue') || content.includes('due')) {
    return { label: 'Payment', icon: CreditCard, color: 'bg-amber-50 text-amber-700 ring-amber-100' }
  }
  if (content.includes('contract') || content.includes('renewal') || content.includes('expir')) {
    return { label: 'Contract', icon: FileText, color: 'bg-sky-50 text-sky-700 ring-sky-100' }
  }
  return { label: 'Update', icon: BellRing, color: 'bg-teal-50 text-teal-700 ring-teal-100' }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { setIsLoading } = useLoading()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all')
  const [notifications, setNotifications] = useState<HeaderNotification[]>([])
  const [selectedNotification, setSelectedNotification] = useState<HeaderNotification | null>(null)
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false)
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(true)
  const [notificationError, setNotificationError] = useState('')
  const [visibleNotificationCount, setVisibleNotificationCount] = useState(NOTIFICATION_PAGE_SIZE)
  const [unreadComplaintCount, setUnreadComplaintCount] = useState(0)
  const seenNotificationIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (user?.role?.toUpperCase() === 'TENANT') {
      router.replace('/tenant/dashboard')
    }
  }, [router, user?.role])

  useEffect(() => {
    setIsSidebarOpen(false)
    setIsNotificationsOpen(false)
    setSelectedNotification(null)
    setIsQrScannerOpen(false)
  }, [pathname])

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.isRead),
    [notifications],
  )

  const visibleNotifications = useMemo(
    () => notifications
      .filter((notification) => notificationFilter === 'all' || !notification.isRead)
      .slice(0, visibleNotificationCount),
    [notifications, notificationFilter, visibleNotificationCount],
  )
  const filteredNotificationCount = notificationFilter === 'unread' ? unreadNotifications.length : notifications.length

  const applyNotificationSet = useCallback((incoming: Array<Record<string, unknown>>) => {
    const normalized = incoming.map((notification) => normalizeNotification(notification))

    setNotifications((current) => {
      const currentMap = new Map(current.map((notification) => [notification.id, notification]))

      normalized.forEach((notification) => {
        const existing = currentMap.get(notification.id)
        if (existing) {
          currentMap.set(notification.id, {
            ...existing,
            ...notification,
            isRead: existing.isRead || notification.isRead,
          })
          return
        }
        currentMap.set(notification.id, notification)
      })

      return sortNotifications(Array.from(currentMap.values()))
    })

    normalized.forEach((notification) => seenNotificationIds.current.add(notification.id))
  }, [])

  const loadNotifications = useCallback(async (isBackgroundRefresh = false) => {
    if (!user?.id) {
      setNotifications([])
      setIsNotificationsLoading(false)
      return
    }

    if (!isBackgroundRefresh) {
      setIsNotificationsLoading(true)
    }

    try {
      const response = await apiClient.getNotifications()
      const payload = response?.data ?? response
      const data = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []

      applyNotificationSet(data)
      setNotificationError('')
    } catch {
      setNotificationError('Notifications could not be loaded right now.')
      if (!isBackgroundRefresh) {
        setNotifications([])
      }
    } finally {
      if (!isBackgroundRefresh) {
        setIsNotificationsLoading(false)
      }
    }
  }, [applyNotificationSet, user?.id])

  const loadUnreadComplaintCount = useCallback(async () => {
    if (!user?.id || !['ADMIN', 'STAFF'].includes(user.role?.toUpperCase() || '')) {
      setUnreadComplaintCount(0)
      return
    }

    try {
      const response = await apiClient.getUnreadComplaintCount()
      setUnreadComplaintCount(Number(response?.count ?? response?.data?.count ?? 0))
    } catch {
      setUnreadComplaintCount(0)
    }
  }, [user?.id, user?.role])

  useEffect(() => {
    const loadInitialNotifications = async () => {
      await loadNotifications(false)
      setVisibleNotificationCount(NOTIFICATION_PAGE_SIZE)
    }

    void loadInitialNotifications()

    const interval = window.setInterval(() => {
      void loadNotifications(true)
    }, 30000)

    return () => {
      window.clearInterval(interval)
    }
  }, [loadNotifications])

  useEffect(() => {
    void loadUnreadComplaintCount()
    const interval = window.setInterval(() => void loadUnreadComplaintCount(), 15000)
    return () => window.clearInterval(interval)
  }, [loadUnreadComplaintCount])

  useEffect(() => {
    if (!user?.id) {
      setNotifications([])
      setIsNotificationsLoading(false)
      return
    }
  }, [user?.id])

  const markOneNotificationAsRead = useCallback(async (notification: HeaderNotification) => {
    const notificationId = String(notification.id)

    setNotifications((current) => sortNotifications(
      current.map((item) => item.id === notificationId ? { ...item, isRead: true } : item),
    ))

    try {
      await apiClient.markNotificationAsRead(notificationId)
    } catch {
      setNotifications((current) => sortNotifications(
        current.map((item) => item.id === notificationId ? { ...item, isRead: false } : item),
      ))
      setNotificationError('Unable to save this notification as read.')
    }
  }, [])

  const handleNotificationClick = async (notification: HeaderNotification) => {
    setSelectedNotification(notification)
    setIsNotificationsOpen(false)

    if (!notification.isRead) {
      await markOneNotificationAsRead(notification)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (unreadNotifications.length === 0) return

    setNotifications((current) => sortNotifications(current.map((notification) => ({
      ...notification,
      isRead: true,
    }))))

    try {
      await apiClient.markAllNotificationsAsRead()
    } catch {
      setNotifications((current) => sortNotifications(current.map((notification) => ({
        ...notification,
        isRead: notification.isRead ?? false,
      }))))
      setNotificationError('Unable to mark all notifications as read.')
    }
  }

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await logout()
    } finally {
      setIsLoading(false)
    }
  }

  if (user?.role?.toUpperCase() === 'TENANT') return null

  let navigation: Array<{ name: string; href: string }> = []

  if (user?.role && user.role.toUpperCase() === 'CASHIER') {
    navigation = [
      { name: 'Collection Dashboard', href: '/dashboard/cashier' },
      { name: 'Payments', href: '/dashboard/payments' },
      { name: 'Archive', href: '/dashboard/archive' },
    ]
  } else if (user?.role && (user.role.toUpperCase() === 'ADMIN' || user.role.toUpperCase() === 'STAFF')) {
    navigation = [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'Contracts', href: '/dashboard/contracts' },
      { name: 'Payments', href: '/dashboard/payments' },
      { name: 'Tenants', href: '/dashboard/tenants' },
      { name: 'Rental Spaces', href: '/dashboard/spaces' },
      { name: 'Messages & Complaints', href: '/dashboard/messages' },
      { name: 'Reports', href: '/dashboard/reports' },
      { name: 'Archive', href: '/dashboard/archive' },
      { name: 'Audit Logs', href: '/dashboard/audit-logs' },
    ]
  } else {
    navigation = []
  }

  return (
    <div className="flex h-screen bg-[#eef3f2] text-[#142b32]">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[17rem] border-r border-[#214d56] bg-[linear-gradient(180deg,#102f36_0%,#091f25_100%)] shadow-[18px_0_40px_rgba(15,34,43,0.18)] transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[#2d5961] px-5 py-6">
            <Link href="/dashboard" className="flex items-center gap-3 transition-all duration-200 hover:opacity-95">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 p-1 shadow-[0_10px_18px_rgba(0,0,0,0.12)]">
                <PFDALogo className="h-10 w-10" size={40} />
              </div>
              <div>
                <div className="text-[11px] font-black tracking-[0.16em] text-[#f0c27b]">PFDA</div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-[#a9c3c6]">Contract Monitoring</div>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-7">
            <div className="space-y-1.5">
              <div className="mb-3 px-3 text-[9px] uppercase tracking-[0.18em] text-[#8fb0b5]">Menu</div>
              {navigation.map((item) => {
                const isActive = item.href === '/dashboard'
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-[#e4f3f1] text-[#0b4a54] shadow-[0_8px_18px_rgba(0,0,0,0.12)]'
                        : 'text-[#c6d8da] hover:bg-[#183f47] hover:text-white'
                    }`}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3"><span>{item.name}</span>{item.href === '/dashboard/messages' && unreadComplaintCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d9535a] px-1.5 text-[10px] font-bold text-white" aria-label={`${unreadComplaintCount} unread complaints`}>{unreadComplaintCount > 99 ? '99+' : unreadComplaintCount}</span>}</span>
                  </Link>
                )
              })}
            </div>
          </nav>

          <div className="border-t border-[#2d5961] bg-[#0f313a] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d28b32] text-[11px] font-black text-white shadow-[0_8px_16px_rgba(210,139,50,0.35)]">
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-white">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="truncate text-[9px] uppercase tracking-[0.15em] text-[#a9c3c6]">{user?.role}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full rounded-xl border border-[#4a7078] bg-transparent px-4 py-2 text-[11px] font-semibold text-[#d6e5e6] transition hover:bg-[#1e5361]"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="relative z-50 flex min-h-16 shrink-0 items-center border-b border-[#d5e1df] bg-white px-4 shadow-[0_8px_24px_rgba(18,34,43,0.08)] lg:px-8">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="mr-4 rounded-lg border border-[#e5e9ef] bg-[#f8fafc] p-2 text-[#6c7b8c] transition hover:bg-[#edf2f7] lg:hidden"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="relative ml-auto flex items-center gap-3 text-[#7d8699]">
            {user?.role && ['ADMIN', 'STAFF'].includes(user.role.toUpperCase()) && (
              <button
                type="button"
                title="Scan QR code"
                aria-label="Scan QR code"
                onClick={() => setIsQrScannerOpen(true)}
                className="rounded-xl border border-[#e7edf3] bg-[#f7fafc] p-2.5 transition hover:border-[#cfe4e9] hover:bg-[#edf9fb] hover:text-[#0a7d8d]"
              >
                <ScanLine className="h-5 w-5" />
              </button>
            )}

            <button
              type="button"
              title="Notifications"
              aria-label="Notifications"
              onClick={() => setIsNotificationsOpen((open) => !open)}
              aria-expanded={isNotificationsOpen}
              aria-haspopup="dialog"
              className={`relative rounded-xl border p-2.5 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 ${isNotificationsOpen ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-[#e7edf3] bg-[#f7fafc] text-[#7d8699] hover:border-[#cfe4e9] hover:bg-[#edf9fb] hover:text-[#0a7d8d]'}`}
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d9535a] px-1 text-[9px] font-bold text-white" aria-live="polite">
                  {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <section
                role="dialog"
                aria-label="Notifications"
                className="absolute right-0 top-[calc(100%+0.75rem)] z-[100] flex max-h-[min(38rem,calc(100dvh-5.5rem))] w-[min(27rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_24px_70px_rgba(10,35,42,0.24)] ring-1 ring-black/5"
              >
                <div className="relative overflow-hidden bg-[linear-gradient(125deg,#102f36_0%,#0b5963_62%,#12817f_100%)] px-5 pb-5 pt-4 text-white">
                  <div className="pointer-events-none absolute -right-7 -top-14 h-40 w-40 rounded-full border border-white/10" />
                  <div className="pointer-events-none absolute -bottom-24 right-20 h-36 w-36 rounded-full border border-white/10" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                          <BellRing className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-100">Activity center</p>
                          <h2 className="mt-0.5 text-lg font-bold tracking-tight">Notifications</h2>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-white/75">
                        {unreadNotifications.length === 0 ? 'Everything is up to date.' : `${unreadNotifications.length} unread item${unreadNotifications.length === 1 ? '' : 's'} need your attention.`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsNotificationsOpen(false)}
                      aria-label="Close notifications"
                      className="rounded-lg p-2 text-white/75 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
                  <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Notification filter">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={notificationFilter === 'all'}
                      onClick={() => { setNotificationFilter('all'); setVisibleNotificationCount(NOTIFICATION_PAGE_SIZE) }}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${notificationFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      All <span className="ml-1 text-[10px] opacity-70">{notifications.length}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={notificationFilter === 'unread'}
                      onClick={() => { setNotificationFilter('unread'); setVisibleNotificationCount(NOTIFICATION_PAGE_SIZE) }}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${notificationFilter === 'unread' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Unread <span className={`ml-1 text-[10px] ${unreadNotifications.length ? 'text-teal-700' : 'opacity-70'}`}>{unreadNotifications.length}</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleMarkAllAsRead()}
                    disabled={unreadNotifications.length === 0 || isNotificationsLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-teal-800 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Mark all read
                  </button>
                </div>

                {notificationError && (
                  <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">{notificationError}</p>
                )}

                {isNotificationsLoading && notifications.length === 0 ? (
                  <div className="flex min-h-48 items-center justify-center gap-3 px-4 py-8 text-sm text-slate-500">
                    <span className="loading-spinner" aria-hidden="true" />
                    <span>Loading your latest activity…</span>
                  </div>
                ) : filteredNotificationCount === 0 ? (
                  <div className="flex min-h-52 flex-col items-center justify-center px-6 py-8 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <Inbox className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-sm font-bold text-slate-800">{notificationFilter === 'unread' ? 'You’re all caught up' : 'No notifications yet'}</p>
                    <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{notificationFilter === 'unread' ? 'New unread activity will appear here.' : 'When there’s activity to review, you’ll find it here.'}</p>
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-2.5">
                    {visibleNotifications.map((notification) => (
                      <article
                        key={notification.id}
                        className={`group relative mb-2 overflow-hidden rounded-xl border p-3.5 transition last:mb-0 ${notification.isRead ? 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm' : 'border-teal-300 bg-teal-50 shadow-[0_4px_14px_rgba(15,118,110,0.12)] ring-1 ring-teal-100 hover:border-teal-400 hover:bg-teal-100/70 hover:shadow-md'}`}
                      >
                        {!notification.isRead && <span className="absolute inset-y-0 left-0 w-1 bg-teal-600" aria-hidden="true" />}
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(notification)}
                          className="block w-full rounded-lg pl-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                        >
                          <div className="flex items-start gap-3">
                            {(() => {
                              const category = getNotificationCategory(notification)
                              const CategoryIcon = category.icon
                              return <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${category.color}`}><CategoryIcon className="h-4 w-4" aria-hidden="true" /></span>
                            })()}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className={`min-w-0 break-words text-xs leading-5 ${notification.isRead ? 'font-semibold text-slate-700' : 'font-extrabold text-teal-950'}`}>{notification.title}</p>
                                {!notification.isRead && <span className="shrink-0 rounded-full bg-teal-700 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em] text-white">New</span>}
                              </div>
                              <p className={`mt-1 line-clamp-2 text-xs leading-5 ${notification.isRead ? 'text-slate-500' : 'font-medium text-teal-900/80'}`}>{notification.message}</p>
                              <div className="mt-2.5 flex items-center justify-between gap-2">
                                <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{getNotificationCategory(notification).label}</span>
                                <span className="text-[10px] font-medium text-slate-400">{formatRelativeTime(notification.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </button>

                        {!notification.isRead && (
                          <div className="mt-2.5 flex justify-end border-t border-slate-100 pt-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void markOneNotificationAsRead(notification)
                              }}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-teal-800 transition hover:bg-teal-50"
                            >
                              <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              Mark as read
                            </button>
                          </div>
                        )}
                      </article>
                    ))}

                    {filteredNotificationCount > visibleNotificationCount && (
                      <button
                        type="button"
                        onClick={() => setVisibleNotificationCount((count) => count + NOTIFICATION_PAGE_SIZE)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-teal-800 transition hover:border-teal-200 hover:bg-teal-50"
                      >
                        Show more notifications
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-2.5 text-[10px] text-slate-400">
                  <span>Updates refresh automatically</span>
                  <span>{filteredNotificationCount} {notificationFilter === 'unread' ? 'unread' : 'total'}</span>
                </div>
              </section>
            )}
          </div>
        </header>

        <main className="relative z-0 flex-1 overflow-y-auto bg-transparent p-5 lg:p-8">
          {children}
        </main>
      </div>

      {selectedNotification && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#28334b]/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notification-dialog-title"
          onClick={() => setSelectedNotification(null)}
        >
          <div className="w-full max-w-sm rounded-xl border border-[#dce6e8] bg-white shadow-[0_20px_55px_rgba(20,38,48,0.2)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#e8eff1] px-4 py-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#0a7180]">Notification</p>
                <h2 id="notification-dialog-title" className="mt-1 text-sm font-bold text-[#17333c]">{selectedNotification.title}</h2>
              </div>
            </div>
            <div className="px-4 py-4">
              <p className="text-xs leading-5 text-[#596477]">{selectedNotification.message}</p>
              {selectedNotification.createdAt && <p className="mt-3 text-[10px] text-[#9aa1b3]">{new Date(selectedNotification.createdAt).toLocaleString()}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#e8eff1] px-4 py-3">
              {!selectedNotification.isRead && (
                <button
                  type="button"
                  onClick={() => {
                    void markOneNotificationAsRead(selectedNotification)
                    setSelectedNotification(null)
                  }}
                  className="rounded-md border border-[#cfe1e4] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#0a7180] hover:bg-[#edf9fb]"
                >
                  Mark as Read
                </button>
              )}
              <button type="button" onClick={() => setSelectedNotification(null)} className="rounded-md bg-[#0a7180] px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-[#075b67]">Close</button>
            </div>
          </div>
        </div>
      )}

      {isQrScannerOpen && <QRScannerModal onClose={() => setIsQrScannerOpen(false)} />}

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLoading } from '@/contexts/LoadingContext'
import { PFDALogo } from '@/components/PFDALogo'
import QRScannerModal from '@/components/QRScannerModal'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Menu, ScanLine, X } from 'lucide-react'
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { setIsLoading } = useLoading()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<HeaderNotification[]>([])
  const [selectedNotification, setSelectedNotification] = useState<HeaderNotification | null>(null)
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false)
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(true)
  const [notificationError, setNotificationError] = useState('')
  const [visibleNotificationCount, setVisibleNotificationCount] = useState(NOTIFICATION_PAGE_SIZE)
  const seenNotificationIds = useRef<Set<string>>(new Set())
  const reconnectAttemptsRef = useRef(0)
  const streamUnavailableRef = useRef(false)

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.isRead),
    [notifications],
  )

  const visibleNotifications = useMemo(
    () => notifications.slice(0, visibleNotificationCount),
    [notifications, visibleNotificationCount],
  )

  const applyNotificationSet = useCallback((incoming: Array<Record<string, unknown>>) => {
    const normalized = incoming.map((notification) => normalizeNotification(notification))

    setNotifications((current) => {
      const currentMap = new Map(current.map((notification) => [notification.id, notification]))

      normalized.forEach((notification) => {
        const existing = currentMap.get(notification.id)
        if (existing) {
          currentMap.set(notification.id, { ...existing, ...notification })
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
    if (!user?.id) {
      setNotifications([])
      setIsNotificationsLoading(false)
      reconnectAttemptsRef.current = 0
      streamUnavailableRef.current = false
      return
    }

    let eventSource: EventSource | null = null
    let reconnectTimer: number | undefined

    const connectStream = () => {
      if (streamUnavailableRef.current) {
        return
      }

      try {
        const streamUrl = apiClient.buildNotificationStreamUrl()
        if (!streamUrl) return

        eventSource = new EventSource(streamUrl)

        eventSource.onopen = () => {
          reconnectAttemptsRef.current = 0
          streamUnavailableRef.current = false
          setNotificationError('')
        }

        eventSource.onmessage = (event) => {
          const rawMessage = event.data
          if (!rawMessage || rawMessage === 'ping') return

          try {
            const payload = JSON.parse(rawMessage)
            const notificationData = payload?.notification ?? payload?.data ?? payload
            if (!notificationData || !notificationData.id) return

            const notification = normalizeNotification(notificationData)
            setNotifications((current) => {
              const next = current.some((item) => item.id === notification.id)
                ? current.map((item) => (item.id === notification.id ? { ...item, ...notification } : item))
                : [notification, ...current]
              return sortNotifications(next)
            })
            seenNotificationIds.current.add(notification.id)
            setNotificationError('')
          } catch {
            setNotificationError('An incoming notification could not be processed.')
          }
        }

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close()
          }

          const nextAttempt = reconnectAttemptsRef.current + 1
          reconnectAttemptsRef.current = nextAttempt

          if (nextAttempt <= 3) {
            setNotificationError('Real-time connection lost. Reconnecting…')
            if (reconnectTimer) {
              window.clearTimeout(reconnectTimer)
            }
            reconnectTimer = window.setTimeout(() => {
              connectStream()
            }, 4000)
            return
          }

          streamUnavailableRef.current = true
          setNotificationError('Real-time notifications are unavailable right now. We will keep polling for new updates.')
        }
      } catch {
        streamUnavailableRef.current = true
        setNotificationError('Real-time notifications are unavailable. Polling for updates.')
      }
    }

    connectStream()

    return () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer)
      }
      if (eventSource) {
        eventSource.close()
      }
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

  let navigation = []

  if (user?.role && user.role.toUpperCase() === 'CASHIER') {
    navigation = [
      { name: 'Collection Dashboard', href: '/dashboard/cashier' },
      { name: 'Payments', href: '/dashboard/payments' },
      { name: 'Messages', href: '/dashboard/messages' },
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
      { name: 'Audit Logs', href: '/dashboard/audit-logs' },
    ]
  } else {
    navigation = [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'My Contracts', href: '/dashboard/contracts' },
      { name: 'Payments', href: '/dashboard/payments' },
      { name: 'Messages', href: '/dashboard/messages' },
    ]
  }

  return (
    <div className="flex h-screen bg-[#f3f5f8] text-[#172b35]">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-[#214d56] bg-[linear-gradient(180deg,#123f49_0%,#0d2f38_100%)] shadow-[18px_0_40px_rgba(15,34,43,0.18)] transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[#2d5961] px-4 py-5">
            <Link href="/dashboard" className="flex items-center gap-3 transition-all duration-200 hover:opacity-95">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 p-1 shadow-[0_10px_18px_rgba(0,0,0,0.12)]">
                <PFDALogo className="h-10 w-10" size={40} />
              </div>
              <div>
                <div className="text-[11px] font-black tracking-[0.16em] text-[#f0c27b]">PFDA</div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-[#a9c3c6]">Contract Monitoring</div>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-6">
            <div className="space-y-1.5">
              <div className="mb-3 px-3 text-[9px] uppercase tracking-[0.18em] text-[#8fb0b5]">Menu</div>
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-white text-[#0b4a54] shadow-[0_10px_18px_rgba(0,0,0,0.10)]'
                        : 'text-[#d5e4e7] hover:bg-[#1d4e5a] hover:text-white'
                    }`}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <span>{item.name}</span>
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
        <header className="flex min-h-16 items-center border-b border-[#dfe6eb] bg-white/90 px-4 shadow-[0_4px_14px_rgba(18,34,43,0.04)] backdrop-blur-sm lg:px-8">
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
              className="relative rounded-xl border border-[#e7edf3] bg-[#f7fafc] p-2.5 transition hover:border-[#cfe4e9] hover:bg-[#edf9fb] hover:text-[#0a7d8d]"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d9535a] px-1 text-[9px] font-bold text-white" aria-live="polite">
                  {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-[#e5eaf1] bg-white shadow-[0_18px_45px_rgba(20,38,48,0.14)]">
                <div className="flex items-center justify-between border-b border-[#eef2f5] px-4 py-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#354057]">Notifications</h2>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#9aa1b3]">
                      {unreadNotifications.length} unread
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    disabled={unreadNotifications.length === 0 || isNotificationsLoading}
                    className="rounded-md border border-[#dde7ef] bg-[#f8fafc] px-2 py-1 text-[10px] font-semibold text-[#0a7d8d] transition hover:bg-[#edf9fb] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Mark All as Read
                  </button>
                </div>

                {notificationError && (
                  <p className="border-b border-[#eed7d7] bg-[#fff6f6] px-4 py-2 text-xs text-[#b33a35]">{notificationError}</p>
                )}

                {isNotificationsLoading && notifications.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-[#7d8699]">
                    <span className="loading-spinner" aria-hidden="true" />
                    Loading notifications…
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm font-medium text-[#354057]">No notifications yet</p>
                    <p className="mt-1 text-xs text-[#9aa1b3]">You’re all caught up.</p>
                  </div>
                ) : (
                  <div className="max-h-[26rem] overflow-y-auto">
                    {visibleNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`border-b border-[#f0f1f5] border-l-4 px-4 py-3 transition ${notification.isRead ? 'border-l-transparent bg-[#f7faf9] opacity-75' : 'border-l-[#d28b32] bg-[#fff8ed]'}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(notification)}
                          className="block w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className={`flex items-center gap-2 text-xs font-bold ${notification.isRead ? 'text-[#70858a]' : 'text-[#17333c]'}`}>
                              {!notification.isRead && <span className="h-2 w-2 rounded-full bg-[#d28b32]" aria-label="Unread" />}
                              {notification.title}
                            </p>
                            <span className="text-[10px] text-[#9aa1b3]">{formatRelativeTime(notification.createdAt)}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#7d8699]">{notification.message}</p>
                        </button>

                        {!notification.isRead && (
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void markOneNotificationAsRead(notification)
                              }}
                              className="rounded-md border border-[#e4e9f2] px-2 py-1 text-[10px] font-semibold text-[#5964c7] hover:bg-[#f5f7ff]"
                            >
                              Mark as Read
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {notifications.length > visibleNotificationCount && (
                      <button
                        type="button"
                        onClick={() => setVisibleNotificationCount((count) => count + NOTIFICATION_PAGE_SIZE)}
                        className="w-full border-t border-[#eef0f5] bg-[#f9fafc] px-4 py-3 text-xs font-semibold text-[#5964c7] transition hover:bg-[#f1f4ff]"
                      >
                        Load more notifications
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#f4f6f7] p-5 lg:p-8">
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
          <div className="w-full max-w-md rounded-2xl border border-[#e3e5ee] bg-white shadow-[0_24px_70px_rgba(39,48,80,0.2)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#eef0f5] px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5964c7]">Notification</p>
                <h2 id="notification-dialog-title" className="mt-1 text-lg font-bold text-[#354057]">{selectedNotification.title}</h2>
              </div>
            </div>
            <div className="px-5 py-6">
              <p className="text-sm leading-6 text-[#596477]">{selectedNotification.message}</p>
              {selectedNotification.createdAt && <p className="mt-4 text-xs text-[#9aa1b3]">{new Date(selectedNotification.createdAt).toLocaleString()}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#eef0f5] px-5 py-3">
              {!selectedNotification.isRead && (
                <button
                  type="button"
                  onClick={() => {
                    void markOneNotificationAsRead(selectedNotification)
                    setSelectedNotification(null)
                  }}
                  className="rounded-md border border-[#dfe5ef] bg-white px-4 py-2 text-xs font-semibold text-[#5964c7] hover:bg-[#f5f7ff]"
                >
                  Mark as Read
                </button>
              )}
              <button type="button" onClick={() => setSelectedNotification(null)} className="rounded-md bg-[#5964c7] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4652b5]">Close</button>
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

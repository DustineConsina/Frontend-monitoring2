'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'

interface NotificationData {
  id: number
  type: string
  title: string
  message: string
  data?: any
  isRead: boolean
  createdAt: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [selectedNotif, setSelectedNotif] = useState<NotificationData | null>(null)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const response = await apiClient.getNotifications()
      const notificationsData = response.data?.data || response.data || []
      setNotifications(Array.isArray(notificationsData) ? notificationsData : [])
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications')
      setNotifications([])
    } finally {
      setIsLoading(false)
    }
  }

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === 'all') return true
    const filterType = filter.toUpperCase().replace(/-/g, '_')
    return notif.type === filterType
  })

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'contract_renewal': 'Contract Renewal',
      'contract_activated': 'Contract Activated',
      'contract_terminated': 'Contract Terminated',
      'payment_due': 'Payment Due',
      'payment_overdue': 'Payment Overdue',
    }
    return labels[type] || type.replace(/_/g, ' ')
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'contract_renewal': 'text-blue-600 bg-blue-50',
      'contract_activated': 'text-green-600 bg-green-50',
      'contract_terminated': 'text-red-600 bg-red-50',
      'payment_due': 'text-yellow-600 bg-yellow-50',
      'payment_overdue': 'text-red-600 bg-red-50',
    }
    return colors[type] || 'text-gray-600 bg-gray-50'
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
          <p className="text-gray-600">System notifications and reminders</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="bg-white rounded-lg shadow p-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="all">All Notifications</option>
            <option value="payment-due">Payment Due</option>
            <option value="payment-overdue">Payment Overdue</option>
            <option value="contract-renewal">Contract Renewal</option>
            <option value="contract-activated">Contract Activated</option>
          </select>
        </div>

        {/* Notifications Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
              <p className="mt-4 text-gray-600">Loading notifications...</p>
            </div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">No notifications</p>
            <p className="text-gray-400 text-sm mt-2">You're all caught up!</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 w-1/4">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 flex-1">Message</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 w-1/5">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 w-24">Status</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredNotifications.map((notification) => (
                  <tr
                    key={notification.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(notification.type)}`}
                      >
                        {getTypeLabel(notification.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="line-clamp-2">{notification.message}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(notification.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          notification.isRead
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {notification.isRead ? 'Read' : 'New'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedNotif(notification)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filteredNotifications.length > 0 && (
          <div className="text-sm text-gray-600">
            Showing {filteredNotifications.length} of {notifications.length} notifications
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-50 border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">{selectedNotif.title}</h3>
              <button
                onClick={() => setSelectedNotif(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Type Badge */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">Type:</span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(selectedNotif.type)}`}
                >
                  {getTypeLabel(selectedNotif.type)}
                </span>
              </div>

              {/* Message */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Message</h4>
                <p className="text-gray-700 leading-relaxed">{selectedNotif.message}</p>
              </div>

              {/* Details Grid */}
              {selectedNotif.data && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  {selectedNotif.data.contractNumber && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Contract Number</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">{selectedNotif.data.contractNumber}</p>
                    </div>
                  )}
                  {selectedNotif.data.tenantName && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tenant</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">{selectedNotif.data.tenantName}</p>
                    </div>
                  )}
                  {selectedNotif.data.rentalSpace && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Rental Space</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">{selectedNotif.data.rentalSpace}</p>
                    </div>
                  )}
                  {selectedNotif.data.expiryDate && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Expiry Date</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {new Date(selectedNotif.data.expiryDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                  {selectedNotif.data.daysUntilExpiry !== undefined && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Days Until Expiry</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {Math.ceil(selectedNotif.data.daysUntilExpiry)} {selectedNotif.data.daysUntilExpiry === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Timestamp */}
              <div className="pt-4 border-t">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Received</p>
                <p className="text-sm text-gray-600">
                  {new Date(selectedNotif.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setSelectedNotif(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

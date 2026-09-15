'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import apiClient from '@/lib/api-client'
import { Message } from '@/types'
import Pagination from '@/components/Pagination'

export default function MessagesPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [newMessage, setNewMessage] = useState({
    subject: '',
    content: '',
    receiverId: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const paginatedMessages = messages.slice((currentPage - 1) * 15, currentPage * 15)

  const getDeliveryStatus = (message: Message) => {
    const status = message.deliveryStatus || message.delivery_status || message.smsStatus || message.sms_status
    const normalizedStatus = String(status || 'pending').toLowerCase()

    if (['delivered', 'sent', 'queued', 'failed', 'pending'].includes(normalizedStatus)) {
      return normalizedStatus
    }

    return 'pending'
  }

  const getDeliveryStatusStyle = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'sent':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'queued':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  useEffect(() => {
    fetchMessages()

    const refreshTimer = window.setInterval(() => {
      void fetchMessages()
    }, 15000)

    return () => window.clearInterval(refreshTimer)
  }, [])

  const fetchMessages = async () => {
    try {
      const data = await apiClient.getMessages()
      setMessages(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load messages')
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.sendMessage(newMessage)
      setNewMessage({ subject: '', content: '', receiverId: '' })
      setShowCompose(false)
      fetchMessages()
    } catch (err: any) {
      setError(err.message || 'Message could not be sent')
    }
  }

  const handleSelectMessage = async (message: Message) => {
    setSelectedMessage(message)
    if (!message.isRead && message.id) {
      try {
        await apiClient.markMessageAsRead(message.id)
        fetchMessages()
      } catch (err) {
        console.error('Failed to mark as read:', err)
      }
    }
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
            <p className="text-gray-600">Communication between staff and tenants</p>
          </div>
          <button
            onClick={() => setShowCompose(!showCompose)}
            title="New Message"
            className="action-primary inline-flex h-10 w-10 items-center justify-center rounded-lg border"
          >
            +
          </button>
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

        {/* Compose Message Modal */}
        {showCompose && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#28334b]/40 p-4 backdrop-blur-sm">
            <div className="modal-shell w-full max-w-2xl">
              <div className="modal-body">
                <div className="modal-header -mx-6 -mt-6 mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">New Message</h3>
                </div>
                <form onSubmit={handleSendMessage} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recipient user ID
                    </label>
                    <input
                      type="text"
                      value={newMessage.receiverId}
                      required
                      onChange={(e) =>
                        setNewMessage({ ...newMessage, receiverId: e.target.value })
                      }
                      placeholder="Recipient ID"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={newMessage.subject}
                      onChange={(e) =>
                        setNewMessage({ ...newMessage, subject: e.target.value })
                      }
                      placeholder="Message subject"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message
                    </label>
                    <textarea
                      value={newMessage.content}
                      onChange={(e) =>
                        setNewMessage({ ...newMessage, content: e.target.value })
                      }
                      placeholder="Type your message here..."
                      required
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      onClick={() => setShowCompose(false)}
                      title="Cancel"
                      className="action-secondary rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      title="Send Message"
                      className="action-primary rounded-lg border px-4 py-2 text-sm font-semibold"
                    >
                      Send Message
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Messages Content */}
        <div className="space-y-6">
          {/* Inbox Messages Grid */}
          {isLoading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="loading-spinner" aria-hidden="true" />
              <p className="mt-4 text-gray-600">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600">No messages</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedMessages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => handleSelectMessage(message)}
                  className="text-left bg-white rounded-lg shadow hover:shadow-lg p-6 border-l-4 border-blue-600 transition-all"
                >
                  {/* Header with read indicator */}
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-bold text-blue-600 flex-1">
                      {message.subject || 'No subject'}
                    </h3>
                    <span className={`ml-2 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${getDeliveryStatusStyle(getDeliveryStatus(message))}`}>
                      {getDeliveryStatus(message)}
                    </span>
                    {!message.isRead && (
                      <span className="w-3 h-3 bg-blue-600 rounded-full flex-shrink-0 ml-2 mt-1"></span>
                    )}
                  </div>

                  {/* Sender Info */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">From</div>
                    <div className="text-sm font-medium text-gray-900">
                      {message.sender?.firstName} {message.sender?.lastName}
                    </div>
                  </div>

                  {/* Message preview */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="text-xs text-gray-600 mb-2">Message</div>
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {message.content}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-gray-500">
                    {new Date(message.createdAt || '').toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
          {messages.length > 0 && <Pagination currentPage={currentPage} totalItems={messages.length} onPageChange={setCurrentPage} />}

          {/* Message Detail View */}
          {selectedMessage && (
            <div className="bg-white rounded-lg shadow p-8">
              <div className="mb-6 pb-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedMessage.subject || 'No subject'}
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">
                    From: {selectedMessage.sender?.firstName}{' '}
                    {selectedMessage.sender?.lastName}
                  </span>
                  <span>•</span>
                  <span>{new Date(selectedMessage.createdAt || '').toLocaleString()}</span>
                  {!selectedMessage.isRead && (
                    <>
                      <span>•</span>
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">Unread</span>
                    </>
                  )}
                </div>
              </div>
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selectedMessage.content}
                </p>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="back-action mt-6"
              >
                Back to Inbox
              </button>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

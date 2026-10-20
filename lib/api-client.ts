// API Client for communicating with backend
import type { User } from '@/types'

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || (
  process.env.NODE_ENV === 'production'
    ? 'https://backend-monitoring2.onrender.com/api'
    : 'http://localhost:8000/api'
)

const isPrivateNetworkHost = (hostname: string) => {
  return /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(hostname)
}

export const resolveApiBaseUrl = () => {
  const configuredUrl = DEFAULT_API_URL
  if (!configuredUrl) {
    return ''
  }

  try {
    const url = new URL(configuredUrl)
    if (typeof window !== 'undefined') {
      const browserHost = window.location.hostname.toLowerCase()
      const configuredHost = url.hostname.toLowerCase()
      const configuredHostIsLocal = /^(localhost|127\.0\.0\.1|::1)$/i.test(configuredHost)

      if (
        configuredHostIsLocal &&
        !/^(localhost|127\.0\.0\.1|::1)$/i.test(browserHost)
      ) {
        url.hostname = browserHost
      } else if (isPrivateNetworkHost(configuredHost) && isPrivateNetworkHost(browserHost)) {
        url.hostname = browserHost
      }
    }

    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/api'
    }

    url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString().replace(/\/$/, '')
  } catch {
    return configuredUrl.replace(/\/$/, '')
  }
}

interface ApiError {
  message: string
  status: number
}

function showGlobalConnectionNotice(title: string, message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:notice', { detail: { title, message } }))
  }
}

function sanitizeErrorMessage(message: string): string {
  const normalizedMessage = message.toLowerCase()
  const containsTechnicalAddress = /localhost|127\.0\.0\.1|0\.0\.0\.0|https?:\/\//.test(normalizedMessage)

  if (containsTechnicalAddress || normalizedMessage.includes('backend endpoint')) {
    return 'The service is temporarily unavailable. Please try again in a moment.'
  }

  return message
}

// Convert camelCase to snake_case
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

// Transform object keys from camelCase to snake_case
function transformKeysToSnakeCase(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map((item) => transformKeysToSnakeCase(item))

  const transformed: Record<string, unknown> = {}
  for (const key in obj as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = toSnakeCase(key)
      const value = (obj as Record<string, unknown>)[key]
      transformed[snakeKey] = transformKeysToSnakeCase(value)
    }
  }
  return transformed
}

// Convert snake_case to camelCase
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
}

// Transform object keys from snake_case to camelCase
function transformKeysToCAmelCase(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map((item) => transformKeysToCAmelCase(item))

  const transformed: Record<string, unknown> = {}
  for (const key in obj as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = toCamelCase(key)
      const value = (obj as Record<string, unknown>)[key]
      transformed[camelKey] = transformKeysToCAmelCase(value)
    }
  }
  return transformed
}

class ApiClient {
  private token: string | null = null

  private get baseUrl() {
    const baseUrl = resolveApiBaseUrl()
    if (!baseUrl) {
      throw new Error('The backend is not connected yet. Set NEXT_PUBLIC_API_URL after deploying the backend.')
    }
    return baseUrl
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token')
    }
  }

  setToken(token: string) {
    this.token = token
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token)
    }
  }

  clearToken() {
    this.token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
    }
  }

  async request<T>(
    endpoint: string,
    options: RequestInit & { skipKeyTransform?: boolean } = {}
  ): Promise<T> {
    const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData
    const headers: Record<string, string> = isFormDataBody ? {} : { 'Content-Type': 'application/json' }

    if (options.headers) {
      Object.assign(headers, options.headers)
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    try {
      // Convert request body from camelCase to snake_case
      let body = options.body
      if (body && typeof body === 'string' && !options.skipKeyTransform) {
        try {
          const parsedBody = JSON.parse(body)
          const convertedBody = transformKeysToSnakeCase(parsedBody)
          body = JSON.stringify(convertedBody)
        } catch (e) {
          // If it's not valid JSON, leave it as is
        }
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        body,
        headers,
        cache: options.cache || 'no-store',
      })

      // Get content type
      const contentType = response.headers.get('content-type')

      if (!response.ok) {
        // Check if response is HTML (404 page, etc.)
        if (contentType?.includes('text/html')) {
          const err = new Error('The requested service is currently unavailable.')
          ;(err as any).status = response.status
          showGlobalConnectionNotice('Service unavailable', err.message)
          throw err
        }

        // Read the raw body once so we can handle JSON, text, or empty error responses safely.
        const rawErrorText = await response.text()
        let errorData: any = null

        if (rawErrorText) {
          try {
            errorData = JSON.parse(rawErrorText)
          } catch {
            errorData = null
          }
        }

        const rawMessage =
          errorData?.message ||
          errorData?.error ||
          (rawErrorText ? rawErrorText.trim() : 'Request failed') ||
          `Error ${response.status}: ${response.statusText}`
        const message = sanitizeErrorMessage(String(rawMessage))

        const err = new Error(message) as Error & { errors?: unknown; debug?: unknown; status?: number }
        err.errors = errorData?.errors || null
        err.debug = errorData?.debug || null
        err.status = response.status
        if (message !== rawMessage) {
          showGlobalConnectionNotice('Request could not be completed', message)
        }
        throw err
      }

      // Check if successful response is HTML (shouldn't be)
      if (contentType?.includes('text/html')) {
        throw {
          message: 'Backend returned HTML instead of JSON. Check backend configuration.',
          status: 500,
        }
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T
      }

      const data = await response.json()
      // Transform snake_case keys to camelCase
      return transformKeysToCAmelCase(data) as T
    } catch (error: any) {
      // Network errors (backend not running)
      if (error.name === 'TypeError' && error.message?.includes('fetch')) {
        const err = new Error('Unable to connect to the service. Please try again in a moment.') as Error & { status?: number }
        err.status = 0
        showGlobalConnectionNotice('Connection problem', err.message)
        throw err
      }
      // Re-throw our formatted errors
      throw error
    }
  }

  // Authentication
  async login(email: string, password: string) {
    return this.request<{ token: string; user: any }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async logout() {
    return this.request('/logout', { method: 'POST' })
  }

  async getCurrentUser() {
    return this.request<any>('/me')
  }

  // Contracts
  async getContracts(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return this.request<any>(`/contracts${query}`)
  }

  async getContract(id: string) {
    return this.request<any>(`/contracts/${id}`)
  }

  async createContract(data: any) {
    return this.request<any>('/contracts', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateContract(id: string, data: any) {
    return this.request<any>(`/contracts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteContract(id: string) {
    return this.request<any>(`/contracts/${id}`, {
      method: 'DELETE',
    })
  }

  async activateContract(id: string) {
    return this.request<any>(`/contracts/${id}/activate`, {
      method: 'POST',
    })
  }

  async terminateContract(id: string, reason: string) {
    return this.request<any>(`/contracts/${id}/terminate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async renewContract(id: string, data: { duration_months: number; monthly_rental?: number }) {
    return this.request<any>(`/contracts/${id}/renew`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getContractQRCode(id: string) {
    return this.request<{ qrCode: string }>(`/contracts/${id}/qr-code`)
  }

  // Payments
  async getPayments(contractId?: string, params: Record<string, string | number> = {}) {
    const queryParams = new URLSearchParams()
    if (contractId) queryParams.set('contractId', contractId)
    Object.entries(params).forEach(([key, value]) => queryParams.set(key, String(value)))
    const query = queryParams.toString() ? `?${queryParams.toString()}` : ''
    return this.request<any>(`/payments${query}`)
  }

  async createPayment(data: any) {
    return this.request<any>('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updatePayment(id: string, data: any) {
    return this.request<any>(`/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deletePayment(id: string) {
    return this.request<any>(`/payments/${id}`, {
      method: 'DELETE',
    })
  }

  async getArchivedPayments(params: Record<string, string | number> = {}) {
    return this.getPayments(undefined, { ...params, archived: 1 })
  }

  async restorePayment(id: string) {
    return this.request<any>(`/payments/${id}/restore`, {
      method: 'POST',
    })
  }

  // Rental Spaces
  async getRentalSpaces(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return this.request<any>(`/rental-spaces${query}`)
  }

  async getRentalSpace(id: string) {
    return this.request<any>(`/rental-spaces/${id}`)
  }

  async createRentalSpace(data: any) {
    return this.request<any>('/rental-spaces', {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    })
  }

  async updateRentalSpace(id: string, data: any) {
    if (data instanceof FormData) {
      data.set('_method', 'PUT')
      return this.request<any>(`/rental-spaces/${id}`, {
        method: 'POST',
        body: data,
      })
    }

    return this.request<any>(`/rental-spaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteRentalSpace(id: string) {
    return this.request<any>(`/rental-spaces/${id}`, {
      method: 'DELETE',
    })
  }

  // Get only available rental spaces (unoccupied)
  async getAvailableRentalSpaces(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return this.request<any>(`/rental-spaces-available${query}`)
  }

  // Messages/Chat
  async getChatConversations() {
    return this.request<any>('/chat/conversations')
  }

  async getSmsMessages() {
    return this.request<any>('/sms-messages')
  }

  async refreshSmsMessageStatus(id: number) {
    return this.request<any>(`/sms-messages/${id}/refresh-status`, {
      method: 'POST',
    })
  }

  async getConversationMessages(userId: string) {
    return this.request<any>(`/chat/messages/${encodeURIComponent(userId)}`)
  }

  async getAvailableChatUsers() {
    return this.request<any>('/chat/available-users')
  }

  async getMessages(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    const response = await this.request<any>(`/chat/conversations${query}`)
    const conversations = Array.isArray(response) ? response : response?.data || []

    return conversations
      .map((conversation: any) => {
        const lastMessage = conversation.lastMessage || conversation.last_message
        if (!lastMessage) return null

        return {
          ...lastMessage,
          subject: lastMessage.subject || 'Message',
          content: lastMessage.content || lastMessage.message || '',
          isRead: lastMessage.isRead ?? lastMessage.is_read ?? false,
          createdAt: lastMessage.createdAt || lastMessage.created_at,
          sender: lastMessage.sender,
          receiver: lastMessage.receiver,
        }
      })
      .filter(Boolean)
  }

  async sendMessage(data: any) {
    return this.request<any>('/chat/send', {
      method: 'POST',
      body: JSON.stringify({
        receiver_id: data.receiverId || data.receiver_id,
        message: data.content || data.message,
      }),
    })
  }

  async markMessageAsRead(id: string) {
    return this.request<any>(`/chat/${id}/read`, {
      method: 'PATCH',
    })
  }

  async sendSms(phoneNumber: string, message: string) {
    return this.request<any>('/sms-messages', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, message }),
    })
  }

  // Reports
  async getContractsReport(params?: any) {
    const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) : null
    const query = cleanParams ? `?${new URLSearchParams(cleanParams as Record<string, string>)}` : ''
    return this.request<any>(`/reports/contracts${query}`)
  }

  async getPaymentsReport(params?: any) {
    const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) : null
    const query = cleanParams ? `?${new URLSearchParams(cleanParams as Record<string, string>)}` : ''
    return this.request<any>(`/reports/payments${query}`)
  }

  async getDelinquencyReport(params?: any) {
    const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) : null
    const query = cleanParams ? `?${new URLSearchParams(cleanParams as Record<string, string>)}` : ''
    return this.request<any>(`/reports/delinquency${query}`)
  }

  async getRevenueReport(params?: any) {
    const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) : null
    const query = cleanParams ? `?${new URLSearchParams(cleanParams as Record<string, string>)}` : ''
    return this.request<any>(`/reports/revenue${query}`)
  }

  async getTenantsReport(params?: any) {
    const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) : null
    const query = cleanParams ? `?${new URLSearchParams(cleanParams as Record<string, string>)}` : ''
    return this.request<any>(`/reports/tenants${query}`)
  }

  async getExpiringContractsReport(params?: any) {
    const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) : null
    const query = cleanParams ? `?${new URLSearchParams(cleanParams as Record<string, string>)}` : ''
    return this.request<any>(`/reports/expiring-contracts${query}`)
  }

  async getAuditLogReport(params?: any) {
    const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) : null
    const query = cleanParams ? `?${new URLSearchParams(cleanParams as Record<string, string>)}` : ''
    return this.request<any>(`/reports/audit-log${query}`)
  }

  // Audit Logs
  async getAuditLogs(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return this.request<any>(`/audit-logs${query}`)
  }

  async getActiveContracts() {
    return this.request<any>('/reports/active-contracts')
  }

  async getExpiredContracts() {
    return this.request<any>('/reports/expired-contracts')
  }

  async getDelinquentContracts() {
    return this.request<any>('/reports/delinquent-contracts')
  }

  async getPaymentHistory(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return this.request<any>(`/reports/payment-history${query}`)
  }

  async getDashboardStats() {
    const response = await this.request<any>('/reports/dashboard-stats')
    // Extract data from response structure
    return response.data || response
  }

  // Generic methods for flexible API calls
  async get<T = any>(endpoint: string) {
    return this.request<T>(endpoint)
  }

  async post<T = any>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    })
  }

  // Notifications
  async getNotifications() {
    return this.request<any>('/notifications')
  }

  async getUnreadNotifications() {
    return this.request<any>('/notifications/unread')
  }

  async markNotificationAsRead(id: string) {
    return this.request<any>(`/notifications/${id}/read`, {
      method: 'PUT',
    })
  }

  async markAllNotificationsAsRead() {
    const endpointCandidates = [
      '/notifications/read-all',
      '/notifications/mark-all-read',
      '/notifications/mark-all-as-read',
      '/notifications/read',
    ]

    let lastError: any = null

    for (const endpoint of endpointCandidates) {
      try {
        return await this.request<any>(endpoint, { method: 'PUT' })
      } catch (error) {
        lastError = error
      }
    }

    for (const endpoint of ['/notifications/read-all', '/notifications/mark-all-read', '/notifications/mark-all-as-read', '/notifications/read']) {
      try {
        return await this.request<any>(endpoint, { method: 'POST' })
      } catch (error) {
        lastError = error
      }
    }

    throw lastError || new Error('Unable to mark all notifications as read.')
  }

  buildNotificationStreamUrl() {
    const baseUrl = this.baseUrl.replace(/\/$/, '')
    const streamCandidates = [
      `${baseUrl}/notifications/stream`,
      `${baseUrl}/notifications/live`,
      `${baseUrl}/notifications/events`,
    ]

    const token = this.token
    if (!token) {
      return streamCandidates[0]
    }

    return streamCandidates.map((candidate) => {
      const url = new URL(candidate)
      url.searchParams.set('token', token)
      return url.toString()
    })[0]
  }

  // Tenants/Users
  async getTenants(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return this.request<any>(`/tenants${query}`)
  }

  async getAllTenants(): Promise<User[]> {
    const pageSize = 100
    const tenants: User[] = []
    let page = 1

    while (true) {
      const response = await this.getTenants({ per_page: pageSize, page })
      const pageData = response.data?.data ?? response.data

      if (Array.isArray(pageData)) {
        tenants.push(...pageData)
        return tenants
      }

      if (!Array.isArray(pageData?.data)) {
        throw new Error('The server returned an invalid tenant list.')
      }

      tenants.push(...pageData.data)

      const lastPage = Number(pageData.lastPage ?? pageData.last_page)
      if (Number.isFinite(lastPage) && lastPage > 0) {
        if (page >= lastPage) return tenants
      } else if (pageData.data.length < pageSize) {
        return tenants
      }

      page += 1
    }
  }

  async getTenant(id: string) {
    return this.request<any>(`/tenants/${id}`)
  }

  async getTenantById(id: number) {
    return this.request<any>(`/tenants/${id}`)
  }

  async createTenant(data: any) {
    return this.request<any>('/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async resetTenantPassword(id: string) {
    return this.request<any>(`/tenants/${id}/reset-password`, { method: 'POST' })
  }

  async getMyTenantPortal() {
    return this.request<any>('/tenant/portal')
  }

  async getMyComplaints() {
    return this.request<any>('/tenant/complaints')
  }

  async createComplaint(data: { category: string; subject: string; message: string }) {
    return this.request<any>('/tenant/complaints', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async replyToComplaint(id: string, message: string) {
    return this.request<any>(`/tenant/complaints/${id}/replies`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  }

  async getComplaints() {
    return this.request<any>('/complaints')
  }

  async getUnreadComplaintCount() {
    return this.request<any>('/complaints/unread-count')
  }

  async markComplaintRead(id: string) {
    return this.request<any>(`/complaints/${id}/read`, { method: 'PATCH' })
  }

  async updateComplaint(id: string, data: { status: string; reply?: string }) {
    return this.request<any>(`/complaints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async updateTenant(id: string, data: any) {
    return this.request<any>(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async uploadTenantProfilePicture(id: string, file: File) {
    const formData = new FormData()
    formData.append('profile_picture', file)

    const response = await fetch(`${this.baseUrl}/tenants/${id}/upload-picture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      let message = 'Failed to upload profile picture.'
      try {
        const errorData = await response.clone().json()
        message = errorData?.message || errorData?.error || message
      } catch {
        message = `Upload failed with status ${response.status}.`
      }
      throw new Error(message)
    }

    return response.json()
  }

  // Demand Letters
  async getDemandLetters(contractId: string) {
    return this.request<any>(`/contracts/${contractId}/demand-letters`)
  }

  async downloadDemandLetter(demandLetterId: string) {
    const response = await fetch(`${this.baseUrl}/demand-letters/${demandLetterId}/download`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to download demand letter')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `demand-letter-${demandLetterId}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  async printDemandLetter(demandLetterId: string) {
    const printWindow = window.open('', '_blank')
    if (!printWindow) throw new Error('Allow pop-ups to print the demand letter.')

    try {
      const response = await fetch(`${this.baseUrl}/demand-letters/${demandLetterId}/download`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
      })
      if (!response.ok) throw new Error('Failed to load demand letter')

      const blobUrl = window.URL.createObjectURL(await response.blob())
      printWindow.location.href = blobUrl
      printWindow.onload = () => printWindow.print()
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000)
    } catch (error) {
      printWindow.close()
      throw error
    }
  }

  // Export reports
  async exportReportPDF(reportType: string, params?: any) {
    const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) : {}
    const queryParams = new URLSearchParams(cleanParams as Record<string, string>)
    queryParams.append('format', 'pdf')
    const query = `?${queryParams.toString()}`

    const response = await fetch(`${this.baseUrl}/reports/${reportType}${query}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    })

    if (!response.ok) {
      let message = 'Failed to export PDF report.'
      try {
        const errorData = await response.clone().json()
        message = errorData?.message || errorData?.error || message
      } catch {
        message = `HTTP ${response.status}: ${response.statusText || 'Unable to export PDF.'}`
      }
      throw new Error(message)
    }

    const blob = await response.blob()
    const fileName = `${reportType.replace(/_/g, '-')}-report-${new Date().toISOString().slice(0, 10)}.pdf`
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  async exportReportCSV(reportType: string, params?: any) {
    const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) : {}
    const queryParams = new URLSearchParams(cleanParams as Record<string, string>)
    queryParams.append('format', 'csv')
    const query = `?${queryParams.toString()}`

    const response = await fetch(`${this.baseUrl}/reports/${reportType}${query}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    })

    if (!response.ok) {
      let message = 'Failed to export CSV report.'
      try {
        const errorData = await response.clone().json()
        message = errorData?.message || errorData?.error || message
      } catch {
        message = `HTTP ${response.status}: ${response.statusText || 'Unable to export CSV.'}`
      }
      throw new Error(message)
    }

    const blob = await response.blob()
    const fileName = `${reportType.replace(/_/g, '-')}-report-${new Date().toISOString().slice(0, 10)}.csv`
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }
}

export const apiClient = new ApiClient()
export default apiClient

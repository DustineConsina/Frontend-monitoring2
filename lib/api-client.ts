// API Client for communicating with backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://contractmonitoringbackend-production.up.railway.app/api'

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
function transformKeysToSnakeCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map((item) => transformKeysToSnakeCase(item))

  const transformed: any = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = toSnakeCase(key)
      const value = obj[key]
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
function transformKeysToCAmelCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map((item) => transformKeysToCAmelCase(item))

  const transformed: any = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = toCamelCase(key)
      const value = obj[key]
      transformed[camelKey] = transformKeysToCAmelCase(value)
    }
  }
  return transformed
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
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
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (options.headers) {
      Object.assign(headers, options.headers)
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    try {
      // Convert request body from camelCase to snake_case
      let body = options.body
      if (body && typeof body === 'string') {
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

        const err = new Error(message)
        ;(err as any).errors = errorData?.errors || null
        ;(err as any).debug = errorData?.debug || null
        ;(err as any).status = response.status
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
        const err = new Error('Unable to connect to the service. Please try again in a moment.')
        ;(err as any).status = 0
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

  async register(data: any) {
    return this.request<{ token: string; user: any }>('/register', {
      method: 'POST',
      body: JSON.stringify(data),
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
  async getPayments(contractId?: string) {
    const query = contractId ? `?contractId=${contractId}` : ''
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

  // Rental Spaces
  async getRentalSpaces(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return this.request<any>(`/rental-spaces${query}`)
  }

  async getRentalSpace(id: string) {
    return this.request<any>(`/rental-spaces/${id}`)
  }

  // Get only available rental spaces (unoccupied)
  async getAvailableRentalSpaces(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return this.request<any>(`/rental-spaces-available${query}`)
  }

  // Messages/Chat
  async getMessages(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return this.request<any>(`/messages${query}`)
  }

  async sendMessage(data: any) {
    return this.request<any>('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async markMessageAsRead(id: string) {
    return this.request<any>(`/messages/${id}/read`, {
      method: 'PUT',
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

  async markNotificationAsRead(id: string) {
    return this.request<any>(`/notifications/${id}/read`, {
      method: 'PUT',
    })
  }

  // Tenants/Users
  async getTenants(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return this.request<any>(`/tenants${query}`)
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

  async updateTenant(id: string, data: any) {
    return this.request<any>(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
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
    
    if (!response.ok) throw new Error('Failed to export PDF')
    
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`
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
      // Try to get error message from response
      try {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      } catch (e: any) {
        // If not JSON, use status text
        if (e instanceof Error && e.message) {
          throw e
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    }
    
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }
}

export const apiClient = new ApiClient(API_URL)
export default apiClient

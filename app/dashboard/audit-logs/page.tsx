'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import Pagination from '@/components/Pagination'

interface AuditLog {
  id: number
  user_id?: number
  userId?: number
  action: string
  model_type?: string
  modelType?: string
  model_id?: number | null
  modelId?: number | null
  description: string
  old_values?: Record<string, unknown> | string | null
  oldValues?: Record<string, unknown> | string | null
  new_values?: Record<string, unknown> | string | null
  newValues?: Record<string, unknown> | string | null
  ip_address?: string | null
  ipAddress?: string | null
  created_at?: string
  createdAt?: string
  user?: {
    id: number
    name: string
    email: string
    role: string
  }
}

function parseAuditValues(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return {}

  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterAction, setFilterAction] = useState('all')
  const [filterEntity, setFilterEntity] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    // Initial load
    const initialFetch = async () => {
      try {
        setIsLoading(true)
        const response = await apiClient.getAuditLogs()
        
        console.log('🔍 RAW Audit Response:', response)
        console.log('🔍 Response.data:', response.data)
        
        // The backend returns: { success: true, data: { auditLogs: [...], summary: {...} } }
        // After camelCase transformation, audit_logs becomes auditLogs
        const logsData = response.data?.auditLogs || response.data?.audit_logs || []
        
        console.log('✅ Extracted Logs:', logsData)
        console.log('✅ Is Array:', Array.isArray(logsData))
        
        setLogs(Array.isArray(logsData) ? logsData : [])
        setError(null)
      } catch (err: unknown) {
        console.error('❌ Audit Logs Error:', err)
        setError(getErrorMessage(err, 'Failed to load audit logs'))
        setLogs([])
      } finally {
        setIsLoading(false)
      }
    }
    
    initialFetch()
  }, [])

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get('search')
    if (query) setSearchTerm(query)
  }, [])

  const fetchLogs = async () => {
    try {
      setIsRefreshing(true)
      const response = await apiClient.getAuditLogs()
      // After camelCase transformation: audit_logs becomes auditLogs
      const logsData = response.data?.auditLogs || response.data?.audit_logs || []
      setLogs(Array.isArray(logsData) ? logsData : [])
      setError(null)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load audit logs'))
      setLogs([])
    } finally {
      setIsRefreshing(false)
    }
  }

  const filteredLogs = (Array.isArray(logs) ? logs : [])
    .filter((log) => {
      const matchesAction = filterAction === 'all' || log.action.toLowerCase() === filterAction.toLowerCase()
      const entityType = log.modelType || log.model_type || 'Unknown'
      const matchesEntity = filterEntity === 'all' || entityType === filterEntity
      const searchValue = searchTerm.toLowerCase()
      const searchableText = [
        log.description,
        log.user?.name,
        log.user?.email,
        log.modelId,
        log.model_id,
        log.modelType,
        log.model_type,
      ].join(' ').toLowerCase()
      const matchesSearch = searchableText.includes(searchValue)
      return matchesAction && matchesEntity && matchesSearch
    })
    .sort((a, b) => {
      const aTime = new Date(a.createdAt || a.created_at || '').getTime()
      const bTime = new Date(b.createdAt || b.created_at || '').getTime()
      return sortOrder === 'desc' ? bTime - aTime : aTime - bTime
    })

  // Get unique actions and entity types for filters
  const uniqueActions = Array.from(new Set(logs.map((log) => log.action).filter(Boolean)))
  const uniqueEntities = Array.from(new Set(logs.map((log) => log.modelType || log.model_type).filter(Boolean)))
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * 10, currentPage * 10)

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      create: 'status-badge status-active', update: 'status-badge status-pending', delete: 'status-badge status-terminated', view: 'status-badge status-default', system: 'status-badge status-for-renewal',
      CREATE: 'status-badge status-active', UPDATE: 'status-badge status-pending', DELETE: 'status-badge status-terminated', VIEW: 'status-badge status-default', SYSTEM: 'status-badge status-for-renewal',
    }
    return colors[action] || 'bg-gray-100 text-gray-800'
  }

  const getEntityBadge = (entity: string) => {
    const colors: Record<string, string> = {
      Contract: 'bg-indigo-100 text-indigo-800',
      Payment: 'status-badge status-paid',
      Tenant: 'status-badge status-maintenance',
      RentalSpace: 'bg-cyan-100 text-cyan-800',
      User: 'bg-violet-100 text-violet-800',
      Report: 'bg-yellow-100 text-yellow-800',
    }
    return colors[entity] || 'bg-gray-100 text-gray-800'
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Audit Trails</h2>
            <p className="text-gray-600">Track all system changes and user actions</p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={isRefreshing}
            className="action-primary inline-flex items-center justify-center rounded-lg border px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by description, user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Action Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="all">All Actions</option>
                {uniqueActions.map((action, idx) => (
                  <option key={`action-${idx}-${action}`} value={action}>
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="all">All Types</option>
                {uniqueEntities.map((entity, idx) => (
                  <option key={`entity-${idx}-${entity}`} value={entity}>
                    {entity}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold">{filteredLogs.length}</span> of{' '}
            <span className="font-semibold">{logs.length}</span> audit logs
          </p>
        </div>

        {/* Audit Logs List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Loading audit logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-[#e8eaf1] bg-white divide-y divide-[#eef0f5]">
            {paginatedLogs.map((log) => (
              <div key={log.id} className="grid grid-cols-1 gap-5 px-5 py-5 transition-colors hover:bg-[#fafaff] lg:grid-cols-[180px_150px_minmax(0,1fr)_220px] lg:items-start">
                {/* Header with timestamp and badges */}
                <div className="lg:border-r lg:border-[#eef0f5] lg:pr-4">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[#9aa1b3] mb-1">Timestamp</div>
                  <div className="text-xs font-semibold text-[#46516b]">
                        {(log.createdAt || log.created_at) ? new Date(log.createdAt || log.created_at!).toLocaleDateString() : 'N/A'}
                  </div>
                  <div className="text-[11px] text-[#9aa1b3]">
                        {(log.createdAt || log.created_at) ? new Date(log.createdAt || log.created_at!).toLocaleTimeString() : 'N/A'}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[#9aa1b3]">Event</div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${getActionBadge(log.action)}`}>
                      {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${getEntityBadge(log.modelType || log.model_type || 'N/A')}`}>
                      {log.modelType || log.model_type || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* User Information */}
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[#9aa1b3]">Description</div>
                  <p className="break-words text-xs text-[#46516b]">{log.description}</p>
                </div>

                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[#9aa1b3]">User</div>
                  <div className="text-xs font-medium text-[#46516b]">{log.user?.name || 'Unknown'}</div>
                  <div className="text-[11px] text-[#9aa1b3]">{log.user?.email || 'N/A'}</div>
                </div>

                {/* Changes Details */}
                {Object.keys(parseAuditValues(log.oldValues || log.old_values)).length > 0 && (
                  <details className="text-xs text-gray-600 cursor-pointer">
                    <summary className="font-semibold hover:text-gray-900 mb-3">View changes</summary>
                    <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200 space-y-2 max-h-48 overflow-y-auto">
                      {Object.entries(parseAuditValues(log.oldValues || log.old_values))
                        .filter(([key, oldValue]) => {
                          const newValue = parseAuditValues(log.newValues || log.new_values)[key]
                          return JSON.stringify(oldValue) !== JSON.stringify(newValue)
                        })
                        .map(([key, oldValue]) => {
                          const newValue = parseAuditValues(log.newValues || log.new_values)[key]
                          const displayOld = oldValue === null || oldValue === undefined ? '(empty)' : String(oldValue)
                          const displayNew = newValue === null || newValue === undefined ? '(empty)' : String(newValue)

                          return (
                            <div key={key} className="py-1 border-b border-gray-200 last:border-0">
                              <div className="font-medium text-gray-700 capitalize mb-1">{key.replace(/_/g, ' ')}</div>
                              <div className="ml-2 space-y-1 text-xs">
                                <div className="text-red-600"><span className="font-semibold">Before:</span> {displayOld}</div>
                                <div className="text-green-600"><span className="font-semibold">After:</span> {displayNew}</div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </details>
                )}

              </div>
            ))}
          </div>
        )}
        {!isLoading && <Pagination currentPage={currentPage} totalItems={filteredLogs.length} onPageChange={setCurrentPage} hidePageNumbers />}
      </div>
    </ProtectedRoute>
  )
}

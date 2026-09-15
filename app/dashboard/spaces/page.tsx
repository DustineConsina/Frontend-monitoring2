'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { RentalSpace } from '@/types'
import Pagination from '@/components/Pagination'

export default function RentalSpacesPage() {
  const [spaces, setSpaces] = useState<RentalSpace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchData()
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchData()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      setIsRefreshing(true)
      const spacesData = await apiClient.getRentalSpaces({ include_all: true })
      const rawSpaces = (spacesData?.data?.data ?? spacesData?.data ?? []) as Record<string, unknown>[]

      console.log('📊 Rental Spaces API Response:')
      console.log('Total spaces received:', rawSpaces.length)
      if (rawSpaces.length > 0) {
        console.log('First space object keys:', Object.keys(rawSpaces[0]))
        console.log('First space full object:', rawSpaces[0])
        console.log('First space status:', rawSpaces[0]?.status)
        console.log('First space occupancyStatus:', rawSpaces[0]?.occupancyStatus)
        console.log('First space active_contracts_count:', rawSpaces[0]?.activeContractsCount)
        console.log('First space is_occupied:', rawSpaces[0]?.isOccupied)
      }

      setSpaces(rawSpaces.map((space) => space as unknown as RentalSpace))
      setError(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load rental spaces'
      setError(message)
      setSpaces([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const formatSpaceType = (type: string) => {
    if (!type) return ''
    const labels: Record<string, string> = {
      food_stall: 'Food Stall',
      market_hall: 'Market Hall',
      banera_warehouse: 'Banera Warehouse',
    }
    return labels[type.toLowerCase()] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const distinctTypes = Array.from(
    new Set(
      spaces.length > 0
        ? spaces
            .map((space: RentalSpace) => space.spaceType || space.space_type)
            .filter((type): type is string => typeof type === 'string' && type.trim().length > 0)
        : ['banera_warehouse', 'food_stall', 'market_hall']
    )
  )

  const getNormalizedSpaceStatus = (space: RentalSpace) => {
    const record = space as unknown as Record<string, unknown>
    const directStatus = String(record?.occupancyStatus || record?.occupancy_status || record?.status || '').trim().toLowerCase()

    if (directStatus === 'available' || directStatus === 'vacant') return 'available'
    if (directStatus === 'occupied' || directStatus === 'rented' || directStatus === 'reserved' || directStatus === 'renewed') return 'occupied'
    if (directStatus === 'maintenance' || directStatus === 'unavailable') return 'maintenance'

    const activeContracts = Number(record?.activeContractsCount ?? record?.active_contracts_count ?? 0)
    if (activeContracts > 0) return 'occupied'

    return 'available'
  }

  const filteredSpaces = Array.isArray(spaces) ? spaces.filter((space: RentalSpace) => {
    const rawType = String(space.spaceType || space.space_type || '').toLowerCase().trim()
    const filterType = String(selectedType || '').toLowerCase().trim()

    const matchesType = filterType === 'all' || 
      rawType === filterType || 
      rawType.replace(/_/g, ' ') === filterType.replace(/_/g, ' ') ||
      rawType.replace(/\s+/g, '_') === filterType.replace(/\s+/g, '_')

    const normalizedStatus = getNormalizedSpaceStatus(space)
    const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter.toLowerCase()
    return matchesType && matchesStatus
  }) : []
  const paginatedSpaces = filteredSpaces.slice((currentPage - 1) * 15, currentPage * 15)

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedType, statusFilter])

  const getStatusBadge = (status: string) => {
    const statusKey = String(status || '').toUpperCase()
    const colors = {
      AVAILABLE: 'bg-green-100 text-green-800',
      OCCUPIED: 'bg-blue-100 text-blue-800',
      MAINTENANCE: 'bg-orange-100 text-orange-800',
    }
    return colors[statusKey as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getStatusIcon = (status: string) => {
    const statusKey = String(status || '').toUpperCase()
    const icons = {
      AVAILABLE: '✅',
      OCCUPIED: '🔒',
      MAINTENANCE: '🔧',
    }
    return icons[statusKey as keyof typeof icons] || '❓'
  }

  const stats = {
    total: spaces.length,
    available: Array.isArray(spaces) ? spaces.filter((space: RentalSpace) => getNormalizedSpaceStatus(space) === 'available').length : 0,
    occupied: Array.isArray(spaces) ? spaces.filter((space: RentalSpace) => getNormalizedSpaceStatus(space) === 'occupied').length : 0,
    maintenance: Array.isArray(spaces) ? spaces.filter((space: RentalSpace) => getNormalizedSpaceStatus(space) === 'maintenance').length : 0,
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Rental Spaces</h2>
            <p className="text-gray-600">Manage rental spaces and availability</p>
          </div>
          <button
            onClick={() => fetchData()}
            disabled={isRefreshing}
            title="Refresh Spaces"
            className="action-primary inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 disabled:cursor-not-allowed"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="rounded-2xl border border-[#d9e7f1] bg-[linear-gradient(135deg,#1d5d8c_0%,#3d7db7_100%)] p-6 text-white shadow-[0_18px_38px_rgba(29,93,140,0.18)]">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#e7f3ff]">Total Spaces</p>
            <p className="text-3xl font-black tracking-tight">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-[#d8efe3] bg-[linear-gradient(135deg,#1d7b66_0%,#2ca47d_100%)] p-6 text-white shadow-[0_18px_38px_rgba(29,123,102,0.18)]">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ebfff4]">Available</p>
            <p className="text-3xl font-black tracking-tight">{stats.available}</p>
          </div>
          <div className="rounded-2xl border border-[#e1dff7] bg-[linear-gradient(135deg,#5047a3_0%,#6a5dd6_100%)] p-6 text-white shadow-[0_18px_38px_rgba(80,71,163,0.18)]">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#f0eeff]">Occupied</p>
            <p className="text-3xl font-black tracking-tight">{stats.occupied}</p>
          </div>
          <div className="rounded-2xl border border-[#f2e4cf] bg-[linear-gradient(135deg,#ba6b1f_0%,#d8892a_100%)] p-6 text-white shadow-[0_18px_38px_rgba(186,107,31,0.18)]">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#fff5e9]">Maintenance</p>
            <p className="text-3xl font-black tracking-tight">{stats.maintenance}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Space Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="all">All Types</option>
                {distinctTypes.map((type: string, index: number) => (
                  <option key={`${type}-${index}`} value={type}>
                    {formatSpaceType(type)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>
        </div>

        {/* Spaces Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center h-64">
              <div className="text-center">
                <div className="loading-spinner" aria-hidden="true" />
                <p className="mt-4 text-gray-600">Loading spaces...</p>
              </div>
            </div>
          ) : filteredSpaces.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">No rental spaces found</p>
            </div>
          ) : (
            paginatedSpaces.map((space: RentalSpace) => {
              const occupancyStatus = getNormalizedSpaceStatus(space)
              return (
              <div
                key={space.id}
                className={`bg-white rounded-lg shadow hover:shadow-lg transition p-4 border-2 ${
                  occupancyStatus === 'available'
                    ? 'border-green-200'
                    : occupancyStatus === 'occupied'
                    ? 'border-blue-200'
                    : 'border-orange-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{space.space_code || space.spaceCode || 'N/A'}</h3>
                  <span className="text-2xl">{getStatusIcon(occupancyStatus)}</span>
                </div>
                <div className="space-y-2 text-sm mb-4">
                  <div className="text-gray-700 font-medium">
                    {formatSpaceType(space.spaceType || space.space_type || '') || 'Space Type N/A'}
                  </div>
                  <div className="text-gray-600">
                    📏 {space.size_sqm || space.sizeSqm || space.squareMeters || 'N/A'} m²
                  </div>
                  {(space.name || space.location) && (
                    <div className="text-gray-600 text-xs">
                      📍 {space.name || space.location}
                    </div>
                  )}
                  {space.base_rental_rate && (
                    <div className="text-gray-900 font-medium">
                      ₱{Number(space.base_rental_rate).toLocaleString()}/month
                    </div>
                  )}
                </div>
                <div>
                  <span
                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                      occupancyStatus
                    )}`}
                  >
                    {String(occupancyStatus || '').toUpperCase()}
                  </span>
                </div>
              </div>
            )})
          )}
        </div>

        {!isLoading && filteredSpaces.length > 0 && (
          <Pagination currentPage={currentPage} totalItems={filteredSpaces.length} onPageChange={setCurrentPage} />
        )}

        {!isLoading && filteredSpaces.length > 0 && (
          <div className="text-sm text-gray-600">
            Showing {filteredSpaces.length} of {spaces.length} spaces
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

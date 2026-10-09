'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { RentalSpace } from '@/types'
import Pagination from '@/components/Pagination'
import { Ban, LayoutGrid, MapPinned, Pencil, Plus, Search, X } from 'lucide-react'

type SpaceForm = {
  space_type: string
  name: string
  size_sqm: string
  description: string
  base_rental_rate: string
  status: string
}

const emptyForm: SpaceForm = {
  space_type: 'food_stall',
  name: '',
  size_sqm: '',
  description: '',
  base_rental_rate: '',
  status: 'available',
}

const normalizeSpace = (space: Record<string, unknown>): RentalSpace => ({
  ...space,
  name: String(space.name || space.location || ''),
  spaceCode: String(space.spaceCode || space.space_code || ''),
  spaceType: String(space.spaceType || space.space_type || ''),
  sizeSqm: Number(space.sizeSqm || space.size_sqm || space.squareMeters || 0),
  baseRentalRate: Number(space.baseRentalRate || space.base_rental_rate || 0),
}) as RentalSpace

export default function RentalSpacesPage() {
  const [spaces, setSpaces] = useState<RentalSpace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<'cards' | 'map'>('cards')
  const [showForm, setShowForm] = useState(false)
  const [editingSpace, setEditingSpace] = useState<RentalSpace | null>(null)
  const [formData, setFormData] = useState<SpaceForm>(emptyForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [spaceToDelete, setSpaceToDelete] = useState<RentalSpace | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const spacesData = await apiClient.getRentalSpaces({ include_all: true })
      const rawSpaces = (spacesData?.data?.data ?? spacesData?.data ?? []) as Record<string, unknown>[]

      setSpaces(rawSpaces.map(normalizeSpace))
      setError(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load rental spaces'
      setError(message)
      setSpaces([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

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
    const storedStatus = String(record?.status || '').trim().toLowerCase()
    if (['available', 'occupied', 'maintenance', 'inactive'].includes(storedStatus)) return storedStatus

    const directStatus = String(record?.occupancyStatus || record?.occupancy_status || storedStatus || '').trim().toLowerCase()

    if (directStatus === 'inactive') return 'inactive'
    if (directStatus === 'available' || directStatus === 'vacant') return 'available'
    if (directStatus === 'occupied' || directStatus === 'rented' || directStatus === 'reserved' || directStatus === 'renewed') return 'occupied'
    if (directStatus === 'maintenance' || directStatus === 'unavailable') return 'maintenance'

    const activeContracts = Number(record?.activeContractsCount ?? record?.active_contracts_count ?? 0)
    if (activeContracts > 0) return 'occupied'

    return 'available'
  }

  const getSpaceImage = (space: RentalSpace) => {
    const record = space as unknown as Record<string, unknown>
    const image = String(record.mapImageUrl || record.map_image_url || record.mapImage || record.map_image || '').trim()
    if (!image) return '/loginbg.png'
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
    const apiLocation = new URL(apiUrl)
    if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i.test(apiLocation.hostname) && !/^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i.test(window.location.hostname) && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(window.location.hostname)) {
      apiLocation.hostname = window.location.hostname
    }
    const backendOrigin = apiLocation.origin
    const cacheBust = encodeURIComponent(String(record.updatedAt || record.updated_at || image))
    if (/^https?:\/\//i.test(image)) return `${image}${image.includes('?') ? '&' : '?'}v=${cacheBust}`
    if (image.startsWith('/storage/')) return `${backendOrigin}${image}?v=${cacheBust}`
    if (image.startsWith('/')) return image
    return `${backendOrigin}/storage/${image.replace(/^\/+/, '')}?v=${cacheBust}`
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
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch = !query || [
      space.name,
      space.location,
      space.spaceCode,
      space.space_code,
      space.spaceNumber,
      space.space_number,
      space.spaceType,
      space.space_type,
    ].some((value) => String(value || '').toLowerCase().includes(query))
    return matchesType && matchesStatus && matchesSearch
  }) : []
  const paginatedSpaces = filteredSpaces.slice((currentPage - 1) * 10, currentPage * 10)

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedType, statusFilter, searchQuery])

  const openCreateForm = () => {
    setEditingSpace(null)
    setFormData(emptyForm)
    setImageFile(null)
    setError(null)
    setShowForm(true)
  }

  const openEditForm = (space: RentalSpace) => {
    setEditingSpace(space)
    setFormData({
      space_type: String(space.spaceType || space.space_type || 'food_stall'),
      name: String(space.name || ''),
      size_sqm: String(space.size_sqm || space.sizeSqm || space.squareMeters || ''),
      description: String((space as RentalSpace & { description?: string }).description || ''),
      base_rental_rate: String(space.base_rental_rate || space.baseRentalRate || ''),
      status: String(space.status || 'available').toLowerCase(),
    })
    setImageFile(null)
    setError(null)
    setShowForm(true)
  }

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (!formData.name.trim() || !Number.isFinite(Number(formData.size_sqm)) || Number(formData.size_sqm) < 0 || !Number.isFinite(Number(formData.base_rental_rate)) || Number(formData.base_rental_rate) < 0) {
        throw new Error('Enter a valid name, size, and rental rate.')
      }

      if (editingSpace) {
        if (imageFile) {
          const payload = new FormData()
          payload.append('name', formData.name.trim())
          payload.append('size_sqm', formData.size_sqm)
          payload.append('base_rental_rate', formData.base_rental_rate)
          payload.append('status', formData.status)
          payload.append('map_image', imageFile)
          const response = await apiClient.updateRentalSpace(String(editingSpace.id), payload)
          const updatedSpace = response?.data?.data || response?.data || response
          if (updatedSpace?.id) {
            setSpaces((current) => current.map((space) => String(space.id) === String(updatedSpace.id)
              ? normalizeSpace({ ...space, ...updatedSpace })
              : space))
          } else {
            await fetchData()
          }
        } else {
          const response = await apiClient.updateRentalSpace(String(editingSpace.id), {
            name: formData.name.trim(),
            size_sqm: Number(formData.size_sqm),
            base_rental_rate: Number(formData.base_rental_rate),
            status: formData.status,
          })
          const updatedSpace = response?.data?.data || response?.data || response
          if (updatedSpace?.id) {
            setSpaces((current) => current.map((space) => String(space.id) === String(updatedSpace.id)
              ? normalizeSpace({ ...space, ...updatedSpace })
              : space))
          } else {
            await fetchData()
          }
        }
      } else {
        const payload = new FormData()
        payload.append('space_type', formData.space_type)
        payload.append('name', formData.name.trim())
        payload.append('size_sqm', formData.size_sqm)
        payload.append('base_rental_rate', formData.base_rental_rate)
        if (imageFile) payload.append('map_image', imageFile)
        await apiClient.createRentalSpace(payload)
        await fetchData()
      }

      setShowForm(false)
    } catch (err: unknown) {
      const failure = err && typeof err === 'object' ? err as { errors?: unknown; message?: string } : {}
      const validationErrors = failure.errors && typeof failure.errors === 'object'
        ? Object.values(failure.errors).flat().join(' ')
        : ''
      setError(validationErrors || failure.message || 'Failed to save rental space')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeactivate = async (space: RentalSpace) => {
    setSpaceToDelete(space)
  }

  const confirmDeactivate = async () => {
    if (!spaceToDelete) return

    setIsDeleting(true)
    try {
      await apiClient.updateRentalSpace(String(spaceToDelete.id), { status: 'inactive' })
      setSpaceToDelete(null)
      await fetchData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate rental space')
    } finally {
      setIsDeleting(false)
    }
  }

  const stats = {
    total: spaces.length,
    available: Array.isArray(spaces) ? spaces.filter((space: RentalSpace) => getNormalizedSpaceStatus(space) === 'available').length : 0,
    occupied: Array.isArray(spaces) ? spaces.filter((space: RentalSpace) => getNormalizedSpaceStatus(space) === 'occupied').length : 0,
    maintenance: Array.isArray(spaces) ? spaces.filter((space: RentalSpace) => getNormalizedSpaceStatus(space) === 'maintenance').length : 0,
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6 pb-8">
        <header className="relative overflow-hidden rounded-3xl bg-[linear-gradient(118deg,#102f36_0%,#0b5963_58%,#12817f_100%)] p-5 text-white shadow-[0_18px_42px_rgba(13,76,83,0.14)] sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-40 right-28 h-72 w-72 rounded-full border border-white/10" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-100/80">Property operations</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Rental spaces</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Manage rental inventory, availability, and space details.</p>
              {isRefreshing && <p className="mt-2 text-xs font-medium text-teal-100">Updating inventory…</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-white/20 bg-white/10 p-1 backdrop-blur-sm" aria-label="Space display mode">
                <button type="button" onClick={() => setViewMode('cards')} aria-pressed={viewMode === 'cards'} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${viewMode === 'cards' ? 'bg-white text-teal-900 shadow-sm' : 'text-white/85 hover:bg-white/10'}`}><LayoutGrid className="h-4 w-4" />Cards</button>
                <button type="button" onClick={() => setViewMode('map')} aria-pressed={viewMode === 'map'} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${viewMode === 'map' ? 'bg-white text-teal-900 shadow-sm' : 'text-white/85 hover:bg-white/10'}`}><MapPinned className="h-4 w-4" />Map</button>
              </div>
              <button type="button" onClick={openCreateForm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-teal-900 shadow-sm transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30">
                <Plus className="h-4 w-4" aria-hidden="true" />Add space
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <span className="mt-0.5 text-lg" aria-hidden="true">⚠</span><p>{error}</p>
          </div>
        )}

        <section aria-label="Rental space summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Total spaces', value: stats.total, tone: 'text-slate-950', dot: 'bg-slate-400' },
            { label: 'Available', value: stats.available, tone: 'text-emerald-700', dot: 'bg-emerald-500' },
            { label: 'Occupied', value: stats.occupied, tone: 'text-sky-700', dot: 'bg-sky-500' },
            { label: 'Maintenance', value: stats.maintenance, tone: 'text-amber-700', dot: 'bg-amber-500' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
                <span className={`h-2.5 w-2.5 rounded-full ${stat.dot}`} />
              </div>
              <p className={`mt-3 text-3xl font-bold tracking-tight ${stat.tone}`}>{stat.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-sm font-bold text-slate-900">Find a space</h2><p className="mt-0.5 text-xs text-slate-500">Search and filter the rental inventory.</p></div>
            <p className="text-xs font-medium text-slate-500">{filteredSpaces.length} of {spaces.length} spaces</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)]">
            <label className="relative block">
              <span className="sr-only">Search rental spaces</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by space name, code, or type" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-50" />
            </label>
            <label className="block">
              <span className="sr-only">Filter by space type</span>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-50"
              >
                <option value="all">All Types</option>
                {distinctTypes.map((type: string, index: number) => (
                  <option key={`${type}-${index}`} value={type}>
                    {formatSpaceType(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Filter by availability status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-50"
              >
                <option value="all">All Statuses</option>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
        </section>

        {/* Space map / cards */}
        {viewMode === 'map' ? (
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><h3 className="text-base font-bold text-slate-900">Space inventory map</h3><p className="mt-1 text-xs text-slate-500">Schematic grouped by space type; tiles are not to scale because floor-plan coordinates are not available.</p></div>
              <div className="flex flex-wrap gap-3 text-[11px] font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Available</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-sky-500" />Occupied</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Maintenance</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-slate-400" />Inactive</span>
              </div>
            </div>
            {isLoading ? <div className="flex h-40 items-center justify-center"><div className="loading-spinner" aria-hidden="true" /></div> : filteredSpaces.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">No spaces match these filters.</p>
            ) : (
              <div className="space-y-5">
                {Array.from(new Set(filteredSpaces.map((space) => String(space.spaceType || space.space_type || 'Other')))).map((type) => {
                  const group = filteredSpaces.filter((space) => String(space.spaceType || space.space_type || 'Other') === type)
                  return <div key={type}>
                    <div className="mb-2 flex items-center gap-2"><span className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{formatSpaceType(type)} · {group.length}</span><span className="h-px flex-1 bg-slate-200" /></div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                      {group.map((space) => {
                        const status = getNormalizedSpaceStatus(space)
                        const color = status === 'available' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100' : status === 'occupied' ? 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100' : status === 'inactive' ? 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200' : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                        return <button key={space.id} type="button" onClick={() => openEditForm(space)} title={`Edit ${space.spaceCode || space.space_code || space.name || 'space'}`} className={`min-h-[86px] rounded-lg border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${color}`}>
                          <span className="block truncate text-xs font-extrabold">{space.spaceCode || space.space_code || space.spaceNumber || space.space_number || space.name || 'Space'}</span>
                          <span className="mt-1 block truncate text-[10px] opacity-75">{space.name || space.location || 'Rental unit'}</span>
                          <span className="mt-2 block text-[9px] font-bold uppercase tracking-wide">{status}</span>
                        </button>
                      })}
                    </div>
                  </div>
                })}
              </div>
            )}
          </section>
        ) : (
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
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-slate-900/10"
              >
                <div className="relative h-44 bg-slate-100">
                  <Image
                    src={getSpaceImage(space)}
                    alt={`${space.name || space.spaceCode || 'Rental space'} photo`}
                    fill
                    unoptimized
                    onError={(event) => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src = '/loginbg.png'
                    }}
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-slate-950/10" />
                  <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold capitalize shadow-sm backdrop-blur ${occupancyStatus === 'available' ? 'border-emerald-100/70 bg-emerald-50/95 text-emerald-800' : occupancyStatus === 'occupied' ? 'border-sky-100/70 bg-sky-50/95 text-sky-800' : occupancyStatus === 'inactive' ? 'border-slate-200 bg-slate-100/95 text-slate-700' : 'border-amber-100/70 bg-amber-50/95 text-amber-800'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${occupancyStatus === 'available' ? 'bg-emerald-500' : occupancyStatus === 'occupied' ? 'bg-sky-500' : occupancyStatus === 'inactive' ? 'bg-slate-400' : 'bg-amber-500'}`} />{occupancyStatus}
                  </span>
                  <span className="absolute bottom-3 left-4 right-4 truncate text-xs font-semibold text-white drop-shadow">{formatSpaceType(space.spaceType || space.space_type || '') || 'Rental unit'}</span>
                </div>

                <div className="flex min-h-[210px] flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Space code</p>
                      <h3 className="mt-1 truncate text-lg font-bold text-slate-900">{space.spaceCode || space.space_code || space.spaceNumber || space.space_number || 'Uncoded space'}</h3>
                      <p className="mt-1 truncate text-xs text-slate-500">{space.name || space.location || 'No space name provided'}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3.5">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Floor area</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">{space.size_sqm || space.sizeSqm || space.squareMeters || '—'} <span className="text-xs font-medium text-slate-500">m²</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Monthly rent</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">{(space.base_rental_rate || space.baseRentalRate) ? `₱${Number(space.base_rental_rate || space.baseRentalRate).toLocaleString()}` : '—'}</p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEditForm(space)} title="Edit rental space" aria-label="Edit rental space" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-800 transition hover:border-sky-300 hover:bg-sky-100 hover:text-sky-900"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button>
                      {occupancyStatus !== 'inactive' && <button type="button" onClick={() => void handleDeactivate(space)} title="Deactivate rental space" aria-label="Deactivate rental space" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800"><Ban className="h-4 w-4" aria-hidden="true" /></button>}
                    </div>
                  </div>
                </div>
              </div>
            )})
          )}
        </div>
        )}

        {viewMode === 'cards' && !isLoading && filteredSpaces.length > 0 && (
          <Pagination currentPage={currentPage} totalItems={filteredSpaces.length} onPageChange={setCurrentPage} />
        )}

        {!isLoading && filteredSpaces.length > 0 && (
          <div className="text-sm text-gray-600">
            Showing {filteredSpaces.length} of {spaces.length} spaces
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && !isSubmitting && setShowForm(false)}>
          <form onSubmit={handleFormSubmit} className="w-full max-w-xl space-y-5 rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="text-xl font-semibold text-slate-900">{editingSpace ? 'Edit Rental Space' : 'Add Rental Space'}</h2>
              <button type="button" onClick={() => setShowForm(false)} disabled={isSubmitting} title="Close" aria-label="Close" className="text-slate-500 hover:text-slate-900"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Space Type<select required value={formData.space_type} onChange={(e) => setFormData({ ...formData, space_type: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="food_stall">Food Stall</option><option value="market_hall">Market Hall</option><option value="banera_warehouse">Banera Warehouse</option></select></label>
              <label className="text-sm font-medium text-slate-700">Name<input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="text-sm font-medium text-slate-700">Size (m²)<input required type="number" min="0" step="0.01" value={formData.size_sqm} onChange={(e) => setFormData({ ...formData, size_sqm: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="text-sm font-medium text-slate-700">Base Rental Rate<input required type="number" min="0" step="0.01" value={formData.base_rental_rate} onChange={(e) => setFormData({ ...formData, base_rental_rate: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              {editingSpace && <label className="text-sm font-medium text-slate-700">Status<select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="available">Available</option><option value="occupied">Occupied</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></select></label>}
            </div>
            <label className="block text-sm font-medium text-slate-700">Space Picture<input type="file" accept="image/jpeg,image/png,image/jpg,image/gif" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4"><button type="button" onClick={() => setShowForm(false)} disabled={isSubmitting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" disabled={isSubmitting} className="action-primary rounded-lg border px-4 py-2 text-sm font-semibold">{isSubmitting ? 'Saving...' : 'Save Space'}</button></div>
          </form>
        </div>
      )}

      {spaceToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && !isDeleting && setSpaceToDelete(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-900">Deactivate Rental Space?</h2>
            <p className="mt-3 text-sm text-slate-600">
              Mark <span className="font-semibold text-slate-900">{spaceToDelete.spaceCode || spaceToDelete.space_code || spaceToDelete.name || 'this rental space'}</span> as inactive? It will remain in the rental spaces list.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setSpaceToDelete(null)} disabled={isDeleting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button type="button" onClick={() => void confirmDeactivate()} disabled={isDeleting} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isDeleting ? 'Updating...' : 'Set Inactive'}</button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { RentalSpace } from '@/types'

type SearchableRentalSpaceSelectProps = {
  spaces: RentalSpace[]
  value: string
  onChange: (spaceId: string) => void
  disabled?: boolean
  label?: string
  placeholder?: string
}

function getSpaceLabel(space: RentalSpace): string {
  const identifier = space.spaceCode || space.space_code || space.spaceNumber || space.space_number || 'Uncoded space'
  const name = space.name || space.location || 'Rental space'
  return `${identifier} - ${name}`
}

export default function SearchableRentalSpaceSelect({
  spaces,
  value,
  onChange,
  disabled = false,
  label = 'Search rental spaces',
  placeholder = 'Search by space code, name, or type...',
}: SearchableRentalSpaceSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedSpace = spaces.find((space) => String(space.id) === value)
  const filteredSpaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return spaces

    return spaces.filter((space) => [
      space.spaceCode,
      space.space_code,
      space.spaceNumber,
      space.space_number,
      space.name,
      space.location,
      space.spaceType,
      space.space_type,
      space.sizeSqm,
      space.size_sqm,
      space.squareMeters,
    ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery))
  }, [query, spaces])

  useEffect(() => {
    const handleOutsidePointer = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointer)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer)
  }, [])

  const selectSpace = (space: RentalSpace) => {
    onChange(String(space.id))
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls="rental-space-options"
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={isOpen ? query : selectedSpace ? getSpaceLabel(selectedSpace) : ''}
        onFocus={() => {
          setQuery('')
          setIsOpen(true)
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
          if (value) onChange('')
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false)
            setQuery('')
          }
          if (event.key === 'Enter' && isOpen && filteredSpaces.length === 1) {
            event.preventDefault()
            selectSpace(filteredSpaces[0])
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-100"
      />
      <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />

      {isOpen && !disabled && (
        <div
          id="rental-space-options"
          role="listbox"
          aria-label="Available rental spaces"
          className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          {filteredSpaces.length ? filteredSpaces.map((space) => {
            const selected = String(space.id) === value
            const type = space.spaceType || space.space_type
            const size = space.size_sqm || space.sizeSqm || space.squareMeters
            return (
              <button
                key={space.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectSpace(space)}
                className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-blue-50 ${selected ? 'bg-blue-50/70' : ''}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">{getSpaceLabel(space)}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">
                    {[type, size ? `${size} m²` : null].filter(Boolean).join(' · ') || 'Rental space'}
                  </span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />}
              </button>
            )
          }) : (
            <p className="px-4 py-5 text-center text-sm text-slate-500">No matching spaces found.</p>
          )}
        </div>
      )}
    </div>
  )
}

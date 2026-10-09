'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { User } from '@/types'

type SearchableTenantSelectProps = {
  tenants: User[]
  value: string
  onChange: (tenantId: string) => void
  disabled?: boolean
  label?: string
  placeholder?: string
}

function getTenantName(tenant: User): string {
  return tenant.businessName || tenant.business_name || tenant.contactPerson || tenant.contact_person || tenant.user?.name || tenant.name || 'Unnamed tenant'
}

function getTenantMeta(tenant: User): string {
  return [
    tenant.tenantCode || tenant.tenant_code,
    tenant.user?.email || tenant.email,
    tenant.contactNumber || tenant.contact_number || tenant.phone || tenant.user?.phone,
  ].filter(Boolean).join(' · ')
}

export default function SearchableTenantSelect({
  tenants,
  value,
  onChange,
  disabled = false,
  label = 'Search tenants',
  placeholder = 'Search by tenant, business, email, or code...',
}: SearchableTenantSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedTenant = tenants.find((tenant) => String(tenant.id) === value)
  const filteredTenants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return tenants

    return tenants.filter((tenant) => [
      tenant.businessName,
      tenant.business_name,
      tenant.contactPerson,
      tenant.contact_person,
      tenant.name,
      tenant.user?.name,
      tenant.email,
      tenant.user?.email,
      tenant.tenantCode,
      tenant.tenant_code,
      tenant.contactNumber,
      tenant.contact_number,
      tenant.phone,
      tenant.businessType,
      tenant.business_type,
    ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery))
  }, [query, tenants])

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

  const selectTenant = (tenant: User) => {
    if (tenant.id === undefined || tenant.id === null) return
    onChange(String(tenant.id))
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
        aria-controls="tenant-options"
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={isOpen ? query : selectedTenant ? getTenantName(selectedTenant) : ''}
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
          if (event.key === 'Enter' && isOpen && filteredTenants.length === 1) {
            event.preventDefault()
            selectTenant(filteredTenants[0])
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-100"
      />
      <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />

      {isOpen && !disabled && (
        <div
          id="tenant-options"
          role="listbox"
          aria-label="Tenant options"
          className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          {filteredTenants.length ? filteredTenants.map((tenant) => {
            const selected = String(tenant.id) === value
            return (
              <button
                key={tenant.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectTenant(tenant)}
                className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-blue-50 ${selected ? 'bg-blue-50/70' : ''}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">{getTenantName(tenant)}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{getTenantMeta(tenant) || 'Tenant'}</span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />}
              </button>
            )
          }) : (
            <p className="px-4 py-5 text-center text-sm text-slate-500">No matching tenants found.</p>
          )}
        </div>
      )}
    </div>
  )
}

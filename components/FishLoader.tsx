'use client'

export function FishLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loading-shell" role="status" aria-label={label}>
      <span className="loading-spinner" aria-hidden="true" />
      <span className="loading-label">{label}</span>
    </div>
  )
}

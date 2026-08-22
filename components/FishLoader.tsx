'use client'

export function FishLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="fish-loader" role="status" aria-label={label}>
      <div className="fish-loader-scene" aria-hidden="true">
        <span className="fish-loader-bubble fish-loader-bubble-one" />
        <span className="fish-loader-bubble fish-loader-bubble-two" />
        <span className="fish-loader-fish">
          <span className="fish-loader-eye" />
          <span className="fish-loader-gill" />
          <span className="fish-loader-fin fish-loader-fin-top" />
          <span className="fish-loader-fin fish-loader-fin-bottom" />
          <span className="fish-loader-highlight" />
          <span className="fish-loader-tail" />
        </span>
        <span className="fish-loader-wave fish-loader-wave-one" />
        <span className="fish-loader-wave fish-loader-wave-two" />
      </div>
      <span className="fish-loader-label">{label}</span>
    </div>
  )
}

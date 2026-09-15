import Image from 'next/image'

interface PFDALogoProps {
  className?: string
  size?: number
}

export function PFDALogo({ className = 'w-16 h-16', size = 64 }: PFDALogoProps) {
  return (
    <div className="flex shrink-0 items-center justify-center bg-transparent leading-none">
      <Image
        src="/logo.png"
        alt="PFDA Logo"
        width={size}
        height={size}
        priority
        className={`block object-contain ${className}`}
        style={{ backgroundColor: 'transparent' }}
      />
    </div>
  )
}


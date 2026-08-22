'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FishLoader } from '@/components/FishLoader'
import { useAuth } from '@/contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#eef0f7]">
        <FishLoader label="Swimming to your dashboard" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}

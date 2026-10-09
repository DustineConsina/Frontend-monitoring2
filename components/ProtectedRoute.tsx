'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { FishLoader } from '@/components/FishLoader'
import { useAuth } from '@/contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isAdminRoute = pathname.startsWith('/dashboard')

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
    if (!isLoading && user?.role?.toUpperCase() === 'TENANT' && isAdminRoute) {
      router.replace('/tenant/dashboard')
    }
  }, [user, isLoading, router, isAdminRoute])

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

  if (user.role?.toUpperCase() === 'TENANT' && isAdminRoute) return null

  return <>{children}</>
}

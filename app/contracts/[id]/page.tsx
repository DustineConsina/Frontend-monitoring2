'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ContractPublicRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const contractId = params.id as string

  useEffect(() => {
    if (!contractId) return
    router.replace(`/dashboard/contracts/${contractId}`)
  }, [contractId, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#eef0f7] text-gray-700">
      Redirecting to contract details...
    </div>
  )
}

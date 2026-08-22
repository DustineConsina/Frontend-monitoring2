'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FishLoader } from '@/components/FishLoader'

interface LoadingContextType {
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

interface GlobalNotice {
  title: string
  message: string
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const [notice, setNotice] = useState<GlobalNotice | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Track route changes
    const handleStart = () => setIsLoading(true)
    const handleStop = () => setIsLoading(false)

    // Listen for route changes
    window.addEventListener('beforeunload', handleStart)

    const handleNotice = (event: Event) => {
      const customEvent = event as CustomEvent<GlobalNotice>
      setNotice(customEvent.detail)
    }
    window.addEventListener('app:notice', handleNotice)

    const nativeAlert = window.alert
    window.alert = (message?: string) => {
      setNotice({
        title: 'Notice',
        message: message || 'Please check the details and try again.',
      })
    }

    return () => {
      window.removeEventListener('beforeunload', handleStart)
      window.removeEventListener('app:notice', handleNotice)
      window.alert = nativeAlert
    }
  }, [])

  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
      {/* Global Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#28334b]/35 backdrop-blur-sm">
          <FishLoader label="Please wait" />
        </div>
      )}

      {notice && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#28334b]/30 px-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="global-notice-title">
          <div className="w-full max-w-sm rounded-2xl border border-[#f3c8ce] bg-white p-6 shadow-[0_24px_70px_rgba(39,48,80,0.2)]">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0f2] text-lg font-bold text-[#d94b5a]">!</div>
              <div>
                <h2 id="global-notice-title" className="text-base font-semibold text-[#28334b]">{notice.title}</h2>
                <p className="mt-1 text-sm leading-6 text-[#7d8699]">{notice.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="w-full rounded-md bg-[#5148e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4038c7]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {children}
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error('useLoading must be used within LoadingProvider')
  }
  return context
}

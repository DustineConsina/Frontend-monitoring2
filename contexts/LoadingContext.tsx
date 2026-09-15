'use client'

import { createContext, useContext, useState, useEffect } from 'react'

interface LoadingContextType {
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

type NoticeTone = 'info' | 'success' | 'error'

interface GlobalNotice {
  title: string
  message: string
  tone?: NoticeTone
}

const loadingToneStyles: Record<NoticeTone, { shell: string; icon: string; iconText: string; button: string }> = {
  info: {
    shell: 'border-[#dfe7ff] bg-white',
    icon: 'bg-[#eef2ff] text-[#4f46e5]',
    iconText: 'i',
    button: 'bg-[#5148e5] hover:bg-[#4038c7]',
  },
  success: {
    shell: 'border-[#d9f6ea] bg-white',
    icon: 'bg-[#ecfdf5] text-[#148a5d]',
    iconText: '✓',
    button: 'bg-[#0d9b67] hover:bg-[#0d8459]',
  },
  error: {
    shell: 'border-[#f3c8ce] bg-white',
    icon: 'bg-[#fff0f2] text-[#d94b5a]',
    iconText: '!',
    button: 'bg-[#5148e5] hover:bg-[#4038c7]',
  },
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const [notice, setNotice] = useState<GlobalNotice | null>(null)

  useEffect(() => {
    const handleNotice = (event: Event) => {
      const customEvent = event as CustomEvent<GlobalNotice>
      setNotice({
        title: customEvent.detail?.title || 'Notice',
        message: customEvent.detail?.message || 'Please check the details and try again.',
        tone: customEvent.detail?.tone || 'info',
      })
    }
    window.addEventListener('app:notice', handleNotice)

    const nativeAlert = window.alert
    window.alert = (message?: string) => {
      setNotice({
        title: 'Notice',
        message: message || 'Please check the details and try again.',
        tone: 'info',
      })
    }

    return () => {
      window.removeEventListener('app:notice', handleNotice)
      window.alert = nativeAlert
    }
  }, [])

  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
      {/* Global Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#28334b]/35 backdrop-blur-sm" role="status" aria-label="Loading">
          <div className="loading-shell" aria-hidden="true">
            <span className="loading-spinner" />
            <span className="loading-label">Loading</span>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#28334b]/30 px-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="global-notice-title">
          <div className={`w-full max-w-sm rounded-2xl border p-6 shadow-[0_24px_70px_rgba(39,48,80,0.2)] ${loadingToneStyles[notice.tone || 'info'].shell}`}>
            <div className="mb-4 flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${loadingToneStyles[notice.tone || 'info'].icon}`}>
                {loadingToneStyles[notice.tone || 'info'].iconText}
              </div>
              <div>
                <h2 id="global-notice-title" className="text-base font-semibold text-[#28334b]">{notice.title}</h2>
                <p className="mt-1 text-sm leading-6 text-[#7d8699]">{notice.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className={`w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition ${loadingToneStyles[notice.tone || 'info'].button}`}
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

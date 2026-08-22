'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLoading } from '@/contexts/LoadingContext'
import { PFDALogo } from '@/components/PFDALogo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const { setIsLoading: setPageLoading } = useLoading()
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    setPageLoading(true)

    try {
      await login(email, password)
      setPageLoading(false)
    } catch (err: any) {
      setPageLoading(false)
      const message = err.message || 'Invalid email or password'
      const isServiceNotice = message === 'Unable to connect to the service. Please try again in a moment.' ||
        message === 'The requested service is currently unavailable.' ||
        message === 'The service is temporarily unavailable. Please try again in a moment.'
      setError(isServiceNotice ? '' : message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_32%),linear-gradient(180deg,#f8fbff_0%,#edf5ff_100%)] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="rounded-[28px] border border-sky-100 bg-white/90 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 shadow-sm">
                <PFDALogo />
              </div>
            </div>
            <div className="mb-2 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-700">
              PFDA
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Contract Management</h1>
            <p className="mt-2 text-sm text-slate-600">Philippine Fisheries Development Authority</p>
            <p className="mt-1 text-xs text-slate-500">Bulan, Sorsogon Fish Port</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(37,99,235,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
                  <span>Signing in...</span>
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
            <p>Contact your administrator for account access</p>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] uppercase tracking-[0.18em] text-slate-500">
          <p>© 2026 PFDA Bulan, Sorsogon</p>
        </div>
      </div>

      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#28334b]/30 px-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="login-error-title">
          <div className="w-full max-w-sm rounded-2xl border border-[#f3c8ce] bg-white p-6 shadow-[0_24px_70px_rgba(39,48,80,0.2)]">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0f2] text-lg text-[#d94b5a]">!</div>
              <div>
                <h2 id="login-error-title" className="text-base font-semibold text-[#28334b]">Sign-in unavailable</h2>
                <p className="mt-1 text-sm leading-6 text-[#7d8699]">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="w-full rounded-md bg-[#5148e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4038c7]"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

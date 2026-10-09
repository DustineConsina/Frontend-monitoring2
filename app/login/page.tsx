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
    <div className="flex min-h-screen flex-col overflow-hidden bg-[#eef3f2] lg:flex-row">
      <section
        className="relative min-h-[42vh] overflow-hidden bg-cover bg-center lg:min-h-screen lg:w-[58%] lg:rounded-r-[18%]"
        style={{ backgroundImage: "url('/loginbg.png')" }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(8,54,62,0.88),rgba(10,79,86,0.52)_52%,rgba(11,31,45,0.88))]" />
        <div className="relative flex h-full min-h-[42vh] items-end p-7 text-white sm:p-10 lg:min-h-screen lg:items-end lg:p-20">
          <div className="max-w-md">
            <div className="mb-5 inline-flex rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.28em] text-white backdrop-blur-sm">
              PFDA
            </div>
            <h2 className="max-w-xl text-3xl font-black leading-tight sm:text-4xl lg:text-6xl">Bulan Fish Port Complex</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/85 lg:text-base">Philippine Fisheries Development Authority</p>
          </div>
        </div>
      </section>

      <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#f7faf9] px-4 py-10 sm:px-8 lg:w-[42%] lg:px-10 xl:px-16">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.72)_44%,transparent_45%,transparent_100%)]" />
        <div className="relative z-10 w-full max-w-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_24px_70px_rgba(8,54,62,0.12)] sm:p-8">
            <div className="mb-8 text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-xl border border-[#dbeef2] bg-[#edf9fb] p-3 shadow-sm">
                  <PFDALogo />
                </div>
              </div>
              <div className="mb-2 inline-flex items-center rounded-full border border-[#bfdbf2] bg-[#eef6ff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#0f5d8d]">
                PFDA
              </div>
              <h1 className="text-3xl font-black tracking-tight text-[#0f1c2d]">Contract Management</h1>
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
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0a7d8d] focus:bg-white focus:ring-4 focus:ring-[#d8f0f2]"
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
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0a7d8d] focus:bg-white focus:ring-4 focus:ring-[#d8f0f2]"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-6 w-full rounded-lg bg-[#0a7d8d] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_22px_rgba(10,125,141,0.22)] transition hover:bg-[#075c66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="loading-spinner" aria-hidden="true" />
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
      </section>

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
              className="w-full rounded-md bg-[#0a7d8d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a5f6c]"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

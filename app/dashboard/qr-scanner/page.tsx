'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Camera, ScanLine } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike
  }
}

export default function QrScannerPage() {
  const router = useRouter()
  const { user } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanFrameRef = useRef<number | null>(null)
  const [manualValue, setManualValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    if (user?.role && user.role.toUpperCase() !== 'ADMIN') {
      router.replace('/dashboard')
    }
  }, [router, user])

  useEffect(() => () => {
    if (scanFrameRef.current !== null) cancelAnimationFrame(scanFrameRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const openScannedValue = (value: string) => {
    try {
      const url = new URL(value, window.location.origin)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Invalid QR code')
      window.location.assign(url.toString())
    } catch {
      setError('The QR code does not contain a valid link.')
    }
  }

  const scan = async () => {
    setError(null)
    const Detector = window.BarcodeDetector
    if (!Detector) {
      setError('QR scanning is not supported by this browser. Paste the QR link below instead.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setIsScanning(true)
      const detector = new Detector({ formats: ['qr_code'] })

      const detect = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          scanFrameRef.current = requestAnimationFrame(detect)
          return
        }
        const codes = await detector.detect(videoRef.current)
        const value = codes[0]?.rawValue
        if (value) {
          stopScanning()
          openScannedValue(value)
          return
        }
        scanFrameRef.current = requestAnimationFrame(detect)
      }

      scanFrameRef.current = requestAnimationFrame(detect)
    } catch {
      setError('Camera access was denied or is unavailable. Paste the QR link below instead.')
    }
  }

  const stopScanning = () => {
    if (scanFrameRef.current !== null) cancelAnimationFrame(scanFrameRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setIsScanning(false)
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#e8eaf1] pb-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold text-[#5663c4]">Admin Tool</p>
            <h1 className="text-2xl font-medium tracking-tight text-[#354057]">QR Code Scanner</h1>
            <p className="mt-1 text-xs text-[#9aa1b3]">Scan a tenant or contract QR code to open its information.</p>
          </div>
          <Link href="/dashboard" title="Back to dashboard" aria-label="Back to dashboard" className="back-action">
            Back to Dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-[#e8eaf1] bg-white p-5 shadow-[0_10px_28px_rgba(39,48,80,0.04)]">
          <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-md bg-[#eef0f7]">
            <video ref={videoRef} className={`${isScanning ? 'block' : 'hidden'} h-full max-h-[28rem] w-full object-cover`} muted playsInline />
            {!isScanning && (
              <div className="text-center text-[#7d8699]"><ScanLine className="mx-auto mb-3 h-12 w-12 text-[#5964c7]" /><p className="text-sm">Camera scanner is ready</p></div>
            )}
          </div>

          {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <div className="mt-5 flex gap-3">
            <button type="button" onClick={isScanning ? stopScanning : scan} className="inline-flex items-center gap-2 rounded-md bg-[#5148e5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4038c7]">
              <Camera className="h-4 w-4" />
              {isScanning ? 'Stop scanner' : 'Start scanner'}
            </button>
          </div>

          <div className="mt-6 border-t border-[#eef0f5] pt-5">
            <label htmlFor="qr-link" className="text-sm font-semibold text-[#46516b]">Open QR link manually</label>
            <div className="mt-2 flex gap-2">
              <input id="qr-link" value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="Paste the QR link" className="min-w-0 flex-1 rounded-md border border-[#dfe2ec] px-3 py-2 text-sm" />
              <button type="button" onClick={() => openScannedValue(manualValue)} disabled={!manualValue.trim()} className="rounded-md border border-[#d9dce7] px-4 py-2 text-sm font-semibold text-[#5964c7] disabled:cursor-not-allowed disabled:opacity-50">Open</button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
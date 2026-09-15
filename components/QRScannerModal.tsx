'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ScanLine, X } from 'lucide-react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'

export default function QRScannerModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const startPromisesRef = useRef(new Map<Html5Qrcode, Promise<null>>())
  const [manualValue, setManualValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const hasResolvedRef = useRef(false)
  const isMountedRef = useRef(true)

  const cleanupScanner = async (scanner: Html5Qrcode) => {
    await startPromisesRef.current.get(scanner)?.catch(() => undefined)
    startPromisesRef.current.delete(scanner)

    try {
      const state = scanner.getState()
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop()
      }
    } catch {
      // The scanner may already be stopping during modal cleanup.
    }

    try {
      scanner.clear()
    } catch {
      // The scanner may not have finished initializing.
    }
  }

  const stopScanning = async () => {
    const scanner = scannerRef.current
    if (scanner) {
      scannerRef.current = null
      await cleanupScanner(scanner)
    }
    if (isMountedRef.current) setIsScanning(false)
  }

  const openValue = async (value: string) => {
    if (hasResolvedRef.current) return

    try {
      const url = new URL(value, window.location.origin)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Invalid QR code')

      const tenantScanMatch = url.pathname.match(/^\/tenant-scan\/([^/]+)\/?$/)
      hasResolvedRef.current = true
      setIsClosing(true)
      await stopScanning()
      onClose()

      if (tenantScanMatch) {
        router.push(`/tenant-scan/${encodeURIComponent(tenantScanMatch[1])}?admin=1`)
        return
      }

      window.location.assign(url.toString())
    } catch {
      hasResolvedRef.current = false
      if (isMountedRef.current) setError('The QR code does not contain a valid link.')
    }
  }

  const cancelScan = async () => {
    if (hasResolvedRef.current) return
    hasResolvedRef.current = true
    setIsClosing(true)
    await stopScanning()
    onClose()
  }

  const startScanning = async () => {
    setError(null)
    try {
      const scanner = new Html5Qrcode('qr-scanner-reader')
      scannerRef.current = scanner
      const startPromise = scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => { void openValue(decodedText) },
        () => undefined,
      )
      startPromisesRef.current.set(scanner, startPromise)
      await startPromise
      if (hasResolvedRef.current || !isMountedRef.current) {
        await cleanupScanner(scanner)
        return
      }
      if (isMountedRef.current && scannerRef.current === scanner) setIsScanning(true)
    } catch (scanError) {
      const scanner = scannerRef.current
      if (scanner) void cleanupScanner(scanner)
      scannerRef.current = null
      const isExpectedShutdown = hasResolvedRef.current || !isMountedRef.current || (scanError instanceof DOMException && scanError.name === 'AbortError')
      if (isMountedRef.current && !isExpectedShutdown) {
        setIsScanning(false)
        setError('Camera access was denied or is unavailable. Paste the QR link below instead.')
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    const startTimer = window.setTimeout(() => {
      void startScanning()
    }, 0)

    return () => {
      window.clearTimeout(startTimer)
      isMountedRef.current = false
      const scanner = scannerRef.current
      if (scanner) {
        void cleanupScanner(scanner)
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#28334b]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#e3e5ee] bg-white shadow-[0_24px_70px_rgba(39,48,80,0.24)]">
        <div className="flex items-center justify-between border-b border-[#eef0f5] px-5 py-4">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-[#5964c7]" />
            <h2 id="qr-scanner-title" className="text-base font-bold text-[#354057]">Scan QR code</h2>
          </div>
          <button type="button" onClick={() => { void cancelScan() }} disabled={isClosing} title="Cancel scanner" aria-label="Cancel scanner" className="inline-flex items-center gap-1.5 rounded-md border border-[#d9dce7] px-3 py-1.5 text-xs font-semibold text-[#596477] hover:bg-[#f2f3f8] hover:text-[#354057] disabled:cursor-wait disabled:opacity-60"><X className="h-4 w-4" /> {isClosing ? 'Closing...' : 'Cancel'}</button>
        </div>

        <div className="p-5">
          <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-[#eef0f7]">
            <div id="qr-scanner-reader" className="block min-h-64 w-full" />
            {!isScanning && <div className="text-center text-[#7d8699]"><Camera className="mx-auto mb-2 h-10 w-10 text-[#5964c7]" /><p className="text-sm">Opening camera...</p></div>}
          </div>

          {error && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <div className="mt-5 border-t border-[#eef0f5] pt-4">
            <label htmlFor="modal-qr-link" className="text-xs font-semibold text-[#596477]">Or paste the QR link</label>
            <div className="mt-2 flex gap-2">
              <input id="modal-qr-link" value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="Paste QR link" className="min-w-0 flex-1 rounded-md border border-[#dfe2ec] px-3 py-2 text-sm" />
              <button type="button" onClick={() => { void openValue(manualValue) }} disabled={!manualValue.trim()} className="rounded-md bg-[#5148e5] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Open</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
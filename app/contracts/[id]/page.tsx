'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { FishLoader } from '@/components/FishLoader'

interface ContractData {
  id: number
  contractNumber: string
  tenant: {
    id: number
    contactPerson: string
    businessName: string
    contactNumber: string
  }
  rentalSpace: {
    id: number
    spaceCode: string
    spaceType: string
    sizeSqm: number
  }
  startDate: string
  endDate: string
  monthlyRental: number
  securityDeposit: number
  status: string
  terms: string
}

export default function PublicContractPage() {
  const params = useParams()
  const contractId = params.id as string
  const [contract, setContract] = useState<ContractData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    fetchContract()
  }, [contractId])

  const fetchContract = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.1.4:8000/api'
      const response = await fetch(`${apiUrl}/contracts/${contractId}/view`)
      
      if (!response.ok) {
        throw new Error('Contract not found')
      }

      const data = await response.json()
      setContract(data.data)
    } catch (err: any) {
      setError(err.message || 'Failed to load contract')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadLease = async () => {
    if (!contract) return
    
    setIsDownloading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.1.4:8000/api'
      const response = await fetch(`${apiUrl}/contracts/${contract.id}/lease`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response status:', response.status)
        console.error('Response body:', errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `lease-${contract.contractNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Download error:', err)
      alert(`Failed to download lease PDF: ${err.message}`)
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#eef0f7]">
        <FishLoader label="Loading contract details" />
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#eef0f7]">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
          <h1 className="text-2xl font-bold text-red-800 mb-2">Contract Not Found</h1>
          <p className="text-red-700">{error || 'Unable to load contract details'}</p>
        </div>
      </div>
    )
  }

  const isActive = contract.status?.toLowerCase() === 'active'
  const statusBadgeColor = isActive
    ? 'bg-green-100 text-green-800'
    : contract.status?.toLowerCase() === 'terminated'
    ? 'bg-red-100 text-red-800'
    : 'bg-yellow-100 text-yellow-800'

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,rgba(81,72,229,0.08),transparent_24%),linear-gradient(135deg,#f5f6fb_0%,#eef0f7_58%,#e9ecf4_100%)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="rounded-xl border border-[#e3e5ee] bg-white p-8 shadow-[0_16px_38px_rgba(39,48,80,0.09)] mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Contract {contract.contractNumber}
              </h1>
              <p className="text-gray-600 mt-1">View contract details</p>
            </div>
            <span className={`px-4 py-2 rounded-full font-semibold text-sm ${statusBadgeColor}`}>
              {contract.status}
            </span>
          </div>

          {/* Tenant Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pb-6 border-b">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tenant Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Contact Person</p>
                  <p className="text-lg font-medium text-gray-900">{contract.tenant.contactPerson}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Business Name</p>
                  <p className="text-lg font-medium text-gray-900">{contract.tenant.businessName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Contact Number</p>
                  <p className="text-lg font-medium text-gray-900">{contract.tenant.contactNumber}</p>
                </div>
              </div>
            </div>

            {/* Rental Space Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Rental Space</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Space Code</p>
                  <p className="text-lg font-medium text-gray-900">{contract.rentalSpace.spaceCode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  <p className="text-lg font-medium text-gray-900">{contract.rentalSpace.spaceType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Size</p>
                  <p className="text-lg font-medium text-gray-900">{contract.rentalSpace.sizeSqm} sqm</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contract Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pb-6 border-b">
            <div>
              <p className="text-sm text-gray-600 mb-2">Start Date</p>
              <p className="text-xl font-semibold text-gray-900">
                {new Date(contract.startDate).toLocaleDateString('en-US')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">End Date</p>
              <p className="text-xl font-semibold text-gray-900">
                {new Date(contract.endDate).toLocaleDateString('en-US')}
              </p>
            </div>
          </div>

          {/* Financial Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-sm text-gray-600 mb-1">Monthly Rental</p>
              <p className="text-3xl font-bold text-blue-600">
                ₱{parseFloat(contract.monthlyRental.toString()).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <p className="text-sm text-gray-600 mb-1">Security Deposit</p>
              <p className="text-3xl font-bold text-purple-600">
                ₱{parseFloat(contract.securityDeposit.toString()).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Terms Section */}
          {contract.terms && (
            <div className="mt-6 pt-6 border-t">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contract Terms</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 whitespace-pre-wrap">{contract.terms}</p>
              </div>
            </div>
          )}

          {/* Download Section */}
          <div className="mt-6 pt-6 border-t">
            <button
              onClick={handleDownloadLease}
              disabled={isDownloading}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isDownloading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent mr-2" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Download Lease PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-gray-600 text-sm">
          <p>This contract details were scanned via QR code</p>
          <p>Generated on {new Date().toLocaleDateString('en-US')}</p>
        </div>
      </div>
    </div>
  )
}

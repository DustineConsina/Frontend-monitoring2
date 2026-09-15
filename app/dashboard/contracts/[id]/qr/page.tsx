'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'

export default function ContractQRPage() {
  const params = useParams()
  const [contract, setContract] = useState<any>(null)
  const [qrCode, setQrCode] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const qrRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (params.id) {
      fetchContractAndQR()
    }
  }, [params.id])

  const fetchContractAndQR = async () => {
    try {
      // Fetch contract details first
      const contractResponse = await apiClient.getContract(params.id as string)
      const contractData = contractResponse.data || contractResponse
      
      // Log the response structure to debug field mapping
      console.log('🔍 QR Page Contract Response:', {
        keys: Object.keys(contractData),
        rentalSpace: contractData.rentalSpace || contractData.rental_space,
        monthlyRental: contractData.monthlyRental || contractData.monthly_rental,
        sizeData: (contractData.rentalSpace || contractData.rental_space)?.size_sqm
      })
      
      // Ensure proper field mapping
      const mappedData = {
        ...contractData,
        rentalSpace: contractData.rentalSpace || contractData.rental_space,
        contractNumber: contractData.contractNumber || contractData.contract_number,
        startDate: contractData.startDate || contractData.start_date,
        endDate: contractData.endDate || contractData.end_date,
        monthlyRent: contractData.monthlyRental || contractData.monthly_rental || contractData.monthlyRent || 0,
      }
      
      setContract(mappedData)
      
      // Then fetch QR code
      try {
        const qrResponse = await apiClient.getContractQRCode(params.id as string)
        if (qrResponse.qrCode) {
          setQrCode(qrResponse.qrCode)
        } else {
          console.warn('No QR code in response:', qrResponse)
        }
      } catch (qrError) {
        console.error('QR Code fetch error:', qrError)
        // Don't fail completely if QR code fails
      }
    } catch (err) {
      console.error('Failed to fetch contract:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const formatDate = (dateInput: any): string => {
    try {
      if (!dateInput) return 'N/A'
      const date = new Date(dateInput)
      if (isNaN(date.getTime())) return 'Invalid Date'
      return date.toLocaleDateString()
    } catch (e) {
      return 'Invalid Date'
    }
  }

  const handleDownload = () => {
    if (!qrCode) return
    const link = document.createElement('a')
    link.href = qrCode
    link.download = `contract-${contract?.contractNumber}-qr.png`
    link.click()
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="loading-spinner" aria-hidden="true" />
            <p className="mt-4 text-gray-600">Loading QR code...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!contract) {
    return (
      <ProtectedRoute>
        <div className="text-center py-12">
          <p className="text-gray-500">Contract not found</p>
          <Link href="/dashboard/contracts" className="back-action mt-4">
            Back to Contracts
          </Link>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/dashboard/contracts/${contract.id}`}
              className="back-action mb-3"
            >
              Back to Contract
            </Link>
            <h2 className="text-2xl font-bold text-gray-900">Contract QR Code</h2>
            <p className="text-gray-600">{contract.contractNumber}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="action-success rounded-lg border px-4 py-2"
            >
              Download
            </button>
            <button
              onClick={handlePrint}
              className="action-primary rounded-lg border px-4 py-2"
            >
              Print
            </button>
          </div>
        </div>

        {/* QR Code Display */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 print:shadow-none" ref={qrRef}>
            {/* Header */}
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Philippine Fisheries Development Authority
              </h3>
              <p className="text-lg text-gray-700">Bulan, Sorsogon Fish Port</p>
              <p className="text-sm text-gray-500 mt-2">Contract Monitoring System</p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-6">
              {qrCode ? (
                <img src={qrCode} alt="Contract QR Code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-gray-100 rounded">
                  <p className="text-gray-500">QR Code not available</p>
                </div>
              )}
            </div>

            {/* Contract Details */}
            <div className="border-t pt-6">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-medium text-gray-700">Contract Number:</td>
                    <td className="py-2 text-gray-900">{contract.contractNumber || contract.contract_number}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium text-gray-700">Tenant:</td>
                    <td className="py-2 text-gray-900">
                      {contract.tenant && (typeof contract.tenant === 'object' && Object.keys(contract.tenant).length > 0)
                        ? `${contract.tenant.businessName || contract.tenant.business_name || contract.tenant.contactPerson || contract.tenant.contact_person || 'N/A'}`
                        : 'N/A'}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium text-gray-700">Rental Space:</td>
                    <td className="py-2 text-gray-900">
                      {(() => {
                        const rs = contract.rentalSpace || contract.rental_space
                        const code = rs?.spaceCode || rs?.space_code || rs?.spaceNumber || 'N/A'
                        const name = rs?.name || rs?.location || ''
                        const type = rs?.space_type || rs?.type?.name || 'N/A'
                        return `${code}${name ? ' - ' + name : ''}`
                      })()}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium text-gray-700">Type:</td>
                    <td className="py-2 text-gray-900">
                      {contract.rentalSpace && (typeof contract.rentalSpace === 'object' && Object.keys(contract.rentalSpace).length > 0)
                        ? (contract.rentalSpace?.spaceType || contract.rentalSpace?.space_type || contract.rentalSpace?.type?.name || 'N/A')
                        : 'N/A'}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium text-gray-700">Space Size:</td>
                    <td className="py-2 text-gray-900">
                      {contract.rentalSpace && (typeof contract.rentalSpace === 'object' && Object.keys(contract.rentalSpace).length > 0)
                        ? `${(contract.rentalSpace?.sizeSqm || contract.rentalSpace?.size_sqm || contract.rentalSpace?.squareMeters) || 'N/A'} m²`
                        : 'N/A'}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium text-gray-700">Contract Period:</td>
                    <td className="py-2 text-gray-900">
                      {formatDate(contract?.startDate)} to {formatDate(contract?.endDate)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium text-gray-700">Monthly Rent:</td>
                    <td className="py-2 text-gray-900">₱{((contract?.monthlyRent || contract?.monthly_rental || 0) as number).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium text-gray-700">Status:</td>
                    <td className="py-2">
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                        {(contract.status || 'Pending').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Space Map Placeholder */}
            <div className="mt-6 border-t pt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Rental Space Location Map</h4>
              {contract.rentalSpace && (typeof contract.rentalSpace === 'object' && Object.keys(contract.rentalSpace).length > 0) ? (
                <div className="bg-gray-100 rounded p-4 text-center">
                  <div className="border-2 border-dashed border-gray-300 rounded h-48 flex items-center justify-center">
                    <div className="text-gray-500">
                      <p className="mb-2">📍 {contract.rentalSpace?.name || 'Location'}</p>
                      <p className="text-sm">Space: {contract.rentalSpace?.sizeSqm || contract.rentalSpace?.size_sqm || contract.rentalSpace?.squareMeters || 'N/A'} square meters</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-center">
                  <p className="text-yellow-800">⚠️ Rental space information not available</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 text-center text-xs text-gray-500 border-t pt-4">
              <p>Scan this QR code to view complete contract details</p>
              <p className="mt-1">Generated: {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="max-w-2xl mx-auto bg-blue-50 border border-blue-200 rounded-lg p-4 print:hidden">
          <h4 className="font-semibold text-blue-900 mb-2">📱 QR Code Usage</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Scanning this QR code will display full contract details and rental space information</li>
            <li>• Tenants can use this to quickly access their contract information</li>
            <li>• Staff can use it for quick verification during site inspections</li>
            <li>• The QR code contains the contract ID and verification token</li>
          </ul>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none,
          .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </ProtectedRoute>
  )
}

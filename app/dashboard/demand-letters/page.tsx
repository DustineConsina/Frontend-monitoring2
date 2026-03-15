'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import apiClient from '@/lib/api-client'
import { AlertCircle, FileText, Download, Calendar } from 'lucide-react'

interface DemandLetter {
  id: number
  demandNumber: string
  contractId: number
  tenantId: number
  paymentId: number
  outstandingBalance: string
  totalAmountDemanded: string
  issuedDate: string
  dueDate: string
  status: string
  sentDate?: string
  emailSentTo?: string
  remarks?: string
  tenant?: {
    id: number
    name: string
    contactPerson?: string
    email: string
  }
  contract?: {
    id: number
    contractNumber: string
    rentalSpace?: {
      name: string
    }
  }
}

export default function DemandLettersPage() {
  const [demandLetters, setDemandLetters] = useState<DemandLetter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [selectedLetter, setSelectedLetter] = useState<DemandLetter | null>(null)

  useEffect(() => {
    fetchDemandLetters()
  }, [])

  const fetchDemandLetters = async () => {
    try {
      setIsLoading(true)
      // Try to fetch all demand letters via a general endpoint
      // This might need a backend route - fallback to individual contract fetches if needed
      const response = await apiClient.get('/api/demand-letters')
      const lettersData = response.data?.data || response.data || []
      setDemandLetters(Array.isArray(lettersData) ? lettersData : [])
      setError(null)
    } catch (err: any) {
      // Fallback: try to get from contracts
      await fetchDemandLettersFromContracts()
    } finally {
      setIsLoading(false)
    }
  }

  const fetchDemandLettersFromContracts = async () => {
    try {
      const contractsResponse = await apiClient.getContracts()
      const contracts = contractsResponse.data?.data || []
      let allLetters: DemandLetter[] = []

      for (const contract of contracts) {
        try {
          const letterResponse = await apiClient.get(
            `/api/contracts/${contract.id}/demand-letters`
          )
          const letters = letterResponse.data?.data || letterResponse.data || []
          if (Array.isArray(letters)) {
            allLetters = [...allLetters, ...letters]
          }
        } catch (e) {
          // Continue if contract has no demand letters
          continue
        }
      }

      setDemandLetters(allLetters)
    } catch (err: any) {
      setError('Failed to load demand letters')
    }
  }

  const filteredLetters = demandLetters.filter((letter) => {
    if (filter === 'all') return true
    return letter.status === filter
  })

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      issued: 'bg-blue-100 text-blue-800',
      sent: 'bg-green-100 text-green-800',
      settled: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return styles[status] || 'bg-gray-100 text-gray-800'
  }

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(parseFloat(amount as string))
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleDownload = async (demandLetterId: number) => {
    try {
      const response = await apiClient.get(
        `/api/demand-letters/${demandLetterId}/download`,
        { responseType: 'blob' }
      )
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `demand-letter-${demandLetterId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
    } catch (err) {
      alert('Failed to download demand letter')
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading demand letters...</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Demand Letters</h1>
            <p className="mt-2 text-gray-600">
              Manage and track demand letters for overdue payments
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="mb-6 flex gap-2 flex-wrap">
            {['all', 'issued', 'sent', 'settled', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Content */}
          {filteredLetters.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                No demand letters found
              </h3>
              <p className="text-gray-600 mt-1">
                {filter === 'all'
                  ? 'No demand letters have been generated yet'
                  : `No ${filter} demand letters`}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Demand #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Tenant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Contract
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLetters.map((letter) => (
                    <tr
                      key={letter.id}
                      onClick={() => setSelectedLetter(letter)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {letter.demandNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {letter.tenant?.contactPerson || letter.tenant?.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {letter.tenant?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {letter.contract?.contractNumber}
                        </div>
                        <div className="text-xs text-gray-500">
                          {letter.contract?.rentalSpace?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-red-600">
                          {formatCurrency(letter.outstandingBalance)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {formatDate(letter.dueDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            letter.status
                          )}`}
                        >
                          {letter.status.charAt(0).toUpperCase() +
                            letter.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(letter.id)
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal */}
          {selectedLetter && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50"
              onClick={() => setSelectedLetter(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white w-full max-h-screen overflow-y-auto"
              >
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">
                    Demand Letter Details
                  </h2>
                  <button
                    onClick={() => setSelectedLetter(null)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="p-6 grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">
                      Letter Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-600">Demand Number</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedLetter.demandNumber}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Issued Date</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(selectedLetter.issuedDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Due Date</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(selectedLetter.dueDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Status</p>
                        <p className="text-sm font-medium">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                              selectedLetter.status
                            )}`}
                          >
                            {selectedLetter.status.charAt(0).toUpperCase() +
                              selectedLetter.status.slice(1)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">
                      Tenant Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-600">Name</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedLetter.tenant?.contactPerson ||
                            selectedLetter.tenant?.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Email</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedLetter.tenant?.email}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Contract</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedLetter.contract?.contractNumber}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Property</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedLetter.contract?.rentalSpace?.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <h3 className="font-semibold text-gray-900 mb-4">
                      Financial Details
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Outstanding Balance:</span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(selectedLetter.outstandingBalance)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-3">
                        <span className="text-gray-700">Total Demanded:</span>
                        <span className="font-semibold text-red-600 text-lg">
                          {formatCurrency(selectedLetter.totalAmountDemanded)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
                  <button
                    onClick={() => setSelectedLetter(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      handleDownload(selectedLetter.id)
                      setSelectedLetter(null)
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

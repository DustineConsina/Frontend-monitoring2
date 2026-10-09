'use client'

interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize?: number
  onPageChange: (page: number) => void
  hidePageNumbers?: boolean
}

export default function Pagination({ currentPage, totalItems, pageSize = 10, onPageChange, hidePageNumbers = false }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  if (totalItems <= pageSize) return null

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row">
      <p className="text-sm text-gray-500">
        Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <button type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:border-blue-700 hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400">Previous</button>
        {!hidePageNumbers && pageNumbers.map((page) => (
          <button key={page} type="button" onClick={() => onPageChange(page)} className={`min-w-8 rounded-md px-2.5 py-1.5 text-sm ${page === currentPage ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            {page}
          </button>
        ))}
        <button type="button" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:border-blue-700 hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400">Next</button>
      </div>
    </div>
  )
}

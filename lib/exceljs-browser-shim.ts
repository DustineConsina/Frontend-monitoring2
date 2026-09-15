import * as XLSX from 'xlsx'

type Cell = { value: unknown; numFmt?: string; [key: string]: unknown }

class WorksheetShim {
  private cells = new Map<string, Cell>()
  private merges: XLSX.Range[] = []
  private maxRow = 0
  private maxColumn = 0
  private widths: Array<{ wch: number }> = []
  private autoFilterRange = ''

  views: unknown[] = []
  properties: Record<string, unknown> = {}
  autoFilter: unknown = null

  private address(row: number, column: number) {
    return XLSX.utils.encode_cell({ r: row - 1, c: column - 1 })
  }

  private track(row: number, column: number) {
    this.maxRow = Math.max(this.maxRow, row)
    this.maxColumn = Math.max(this.maxColumn, column)
  }

  getCell(address: string): Cell {
    if (!this.cells.has(address)) this.cells.set(address, { value: '' })
    const cell = this.cells.get(address) as Cell
    const decoded = XLSX.utils.decode_cell(address)
    this.track(decoded.r + 1, decoded.c + 1)
    return cell
  }

  getRow(rowNumber: number) {
    return {
      height: 20,
      getCell: (column: number) => this.getCell(this.address(rowNumber, column)),
    }
  }

  getColumn(columnNumber: number) {
    const worksheet = this
    return {
      get width() {
        return worksheet.widths[columnNumber - 1]?.wch || 12
      },
      set width(value: number) {
        worksheet.widths[columnNumber - 1] = { wch: value }
      },
    }
  }

  mergeCells(range: string) {
    this.merges.push(XLSX.utils.decode_range(range))
  }

  addTable(options: { ref: string; [key: string]: unknown }) {
    this.autoFilterRange = options.ref
    this.autoFilter = { ref: options.ref }
  }

  getHeaderFooter() {
    return { oddFooter: '' }
  }

  setColumnWidth(columnNumber: number, width: number) {
    this.widths[columnNumber - 1] = { wch: width }
  }

  toSheet() {
    const sheet: XLSX.WorkSheet = {}
    for (const [address, cell] of this.cells.entries()) {
      sheet[address] = { v: cell.value, t: typeof cell.value === 'number' ? 'n' : cell.value instanceof Date ? 'd' : 's', z: cell.numFmt }
    }
    sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: this.maxRow - 1, c: this.maxColumn - 1 } })
    sheet['!merges'] = this.merges
    sheet['!cols'] = this.widths
    if (this.autoFilterRange) sheet['!autofilter'] = { ref: this.autoFilterRange }
    return sheet
  }
}

class WorkbookShim {
  creator = ''
  created = new Date()
  modified = new Date()
  worksheets: WorksheetShim[] = []

  addWorksheet(_name: string, options?: Record<string, unknown>) {
    const worksheet = new WorksheetShim()
    worksheet.views = Array.isArray(options?.views) ? options.views : []
    worksheet.properties = options?.properties && typeof options.properties === 'object' ? options.properties as Record<string, unknown> : {}
    this.worksheets.push(worksheet)
    return worksheet
  }

  get xlsx() {
    return {
      writeBuffer: async () => {
        const workbook = XLSX.utils.book_new()
        this.worksheets.forEach((worksheet, index) => {
          XLSX.utils.book_append_sheet(workbook, worksheet.toSheet(), `Report${index + 1}`)
        })
        return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      },
    }
  }
}

const ExcelJS = { Workbook: WorkbookShim }
export default ExcelJS

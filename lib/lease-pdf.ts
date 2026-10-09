import JSZip from 'jszip'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toWords(value: number): string {
  const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

  const underHundred = (n: number): string => {
    if (n < 10) return ones[n]
    if (n < 20) return teens[n - 10]
    const ten = Math.floor(n / 10)
    const rem = n % 10
    return rem === 0 ? tens[ten] : `${tens[ten]} ${ones[rem]}`
  }

  if (value < 100) return underHundred(value)
  if (value < 1000) {
    const rem = value % 100
    const hundred = Math.floor(value / 100)
    return rem === 0 ? `${ones[hundred]} hundred` : `${ones[hundred]} hundred ${underHundred(rem)}`
  }
  if (value < 1000000) {
    const rem = value % 1000
    const thousand = Math.floor(value / 1000)
    return rem === 0 ? `${underHundred(thousand)} thousand` : `${underHundred(thousand)} thousand ${underHundred(rem)}`
  }

  return 'many'
}

function getNestedValue(source: Record<string, any> | null | undefined, keys: string[]): unknown {
  if (!source) return undefined

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key]
      if (value !== undefined && value !== null && value !== '') return value
    }
  }

  return undefined
}

function formatDate(value: unknown): string {
  if (!value) return 'N/A'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatCurrency(value: unknown): string {
  const numeric = Number(value ?? 0)
  return `P${numeric.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function compactText(value: unknown): string {
  return String(value ?? 'N/A').replace(/\s+/g, ' ').trim()
}

export async function downloadLeasePdf(contract: Record<string, any> | null | undefined) {
  if (!contract) return

  const tenant = contract.tenant || contract.renter || {}
  const rentalSpace = contract.rentalSpace || contract.rental_space || {}

  const businessName = compactText(getNestedValue(tenant, ['businessName', 'business_name', 'name'])) || 'Name_of_Business'
  const businessAddress = compactText(getNestedValue(tenant, ['businessAddress', 'business_address', 'address'])) || 'Address'
  const ownerName = compactText(getNestedValue(tenant, ['contactPerson', 'contact_person', 'owner', 'name'])) || 'Owner'
  const spaceType = compactText(getNestedValue(rentalSpace, ['spaceType', 'space_type', 'type'])) || 'Rental_Space_1'
  const spaceCode = compactText(getNestedValue(rentalSpace, ['spaceCode', 'space_code', 'code'])) || 'Stall_Number'
  const areaSize = compactText(getNestedValue(rentalSpace, ['sizeSqm', 'size_sqm', 'squareMeters'])) || 'Area_Size'
  const monthlyRent = Number(getNestedValue(contract, ['monthlyRental', 'monthly_rental', 'monthlyRent', 'monthly_rent']) ?? 0)
  const securityDeposit = Number(getNestedValue(contract, ['securityDeposit', 'depositAmount', 'deposit_amount', 'security_deposit']) ?? 0)
  const startDate = formatDate(getNestedValue(contract, ['startDate', 'start_date']))
  const endDate = formatDate(getNestedValue(contract, ['endDate', 'end_date']))
  const contractNumber = compactText(getNestedValue(contract, ['contractNumber', 'contract_number'])) || 'Doc_No'

  const amountWords = toWords(Math.max(0, Math.floor(monthlyRent))).replace(/\b\w/g, (char) => char.toUpperCase())
  const depositWords = toWords(Math.max(0, Math.floor(securityDeposit))).replace(/\b\w/g, (char) => char.toUpperCase())

  const replacements: Record<string, string> = {
    '«Name_of_Business»': businessName,
    '«Address»': businessAddress,
    '«Owner»': ownerName,
    '«Rental_Space_1»': spaceType,
    '«Rental_Space_2»': spaceType,
    '«Doc_No»': contractNumber,
    '«Page_No»': contractNumber,
    '«Book_No»': contractNumber,
    '«Series_of_»': '2026',
    '«Counsel»': 'N/A',
    '«Area_Size»': areaSize,
    '«Resolution_No»': 'N/A',
    '«Reso_Date»': 'N/A',
    '«Memo_Date»': 'N/A',
    '«Stall_Number»': spaceCode,
    '«Amount_in_Words»': amountWords,
    '«Amount_in_Figures»': formatCurrency(monthlyRent).replace('P', '').trim(),
    '«Monthly_Rate»': formatCurrency(monthlyRent).replace('P', '').trim(),
    '«Rate_in_Figures»': formatCurrency(monthlyRent).replace('P', '').trim(),
    '«Amount_Deposit__Advance_in_Words»': depositWords,
    '«Amount_Deposit__Advance_in_Figures»': formatCurrency(securityDeposit).replace('P', '').trim(),
    '«Date_From»': startDate,
    '«Date_Duration»': endDate,
    '«Business_Name»': businessName,
    '«Proprietor»': ownerName,
    '«Mr_or_Ms»': 'Mr.',
    '«Client_Name»': ownerName,
    '«Contract_Number»': contractNumber,
  }

  const response = await fetch('/Sample%20of%20Contract%20of%20Lease.docx')
  if (!response.ok) throw new Error('Failed to load lease template')

  const zip = await JSZip.loadAsync(await response.arrayBuffer())
  const documentXml = zip.file('word/document.xml')
  if (!documentXml) throw new Error('Lease template document.xml not found')

  let xml = await documentXml.async('string')
  for (const [placeholder, value] of Object.entries(replacements)) {
    xml = xml.split(placeholder).join(escapeXml(String(value)))
  }

  zip.file('word/document.xml', xml)

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = `${contractNumber}-lease.docx`
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
}

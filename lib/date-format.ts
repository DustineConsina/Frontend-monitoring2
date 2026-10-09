export function dateForInput(value: unknown): string {
  if (!value) return ''

  const text = String(value)
  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnlyMatch) return dateOnlyMatch[0]

  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export function formatCalendarDate(value: unknown): string {
  if (!value) return 'N/A'

  const text = String(value)
  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(text)

  return Number.isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString()
}
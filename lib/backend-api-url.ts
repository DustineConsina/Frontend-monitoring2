export function getBackendApiUrl() {
  const configuredUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || (
    process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000/api' : ''
  )

  if (!configuredUrl) {
    throw new Error('Set BACKEND_INTERNAL_URL or NEXT_PUBLIC_API_URL to the backend API URL.')
  }

  let url: URL
  try {
    url = new URL(configuredUrl)
  } catch {
    throw new Error('The configured backend API URL is invalid.')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('The configured backend API URL must use HTTP or HTTPS.')
  }

  if (!url.pathname || url.pathname === '/') url.pathname = '/api'

  return url.toString().replace(/\/+$/, '')
}

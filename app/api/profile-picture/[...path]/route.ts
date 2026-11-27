import { NextRequest } from 'next/server'
import { getBackendApiUrl } from '@/lib/backend-api-url'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const imagePath = path.map((segment) => encodeURIComponent(segment)).join('/')
  try {
    const response = await fetch(`${getBackendApiUrl()}/storage/${imagePath}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return new Response('Profile picture unavailable', { status: response.status })
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Failed to proxy tenant profile picture:', error)
    return new Response('Profile picture service unavailable', { status: 502 })
  }
}
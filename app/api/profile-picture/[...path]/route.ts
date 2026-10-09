import { NextRequest } from 'next/server'

const API_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || (
  process.env.NODE_ENV === 'production'
    ? 'https://backend-monitoring2.onrender.com/api'
    : 'http://127.0.0.1:8000/api'
)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  if (!API_URL) {
    return new Response('Image service is not configured', { status: 503 })
  }
  const imagePath = path.map((segment) => encodeURIComponent(segment)).join('/')
  try {
    const response = await fetch(`${API_URL.replace(/\/$/, '')}/storage/${imagePath}`, {
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
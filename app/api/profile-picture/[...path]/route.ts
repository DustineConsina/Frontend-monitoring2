import { NextRequest } from 'next/server'

const API_URL = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000/api'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
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
  } catch {
    return new Response('Profile picture service unavailable', { status: 502 })
  }
}
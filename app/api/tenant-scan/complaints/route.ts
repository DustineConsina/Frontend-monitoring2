import { NextRequest } from 'next/server'

const API_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || (
  process.env.NODE_ENV === 'production'
    ? 'https://backend-monitoring2.onrender.com/api'
    : 'http://127.0.0.1:8000/api'
)

export async function POST(request: NextRequest) {
  const body = await request.text()

  try {
    const response = await fetch(`${API_URL.replace(/\/$/, '')}/public/tenant-scan/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    })

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return Response.json(
      { message: 'The backend service is currently unavailable.' },
      { status: 502 },
    )
  }
}

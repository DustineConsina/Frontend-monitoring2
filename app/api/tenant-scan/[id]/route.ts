import { NextRequest } from 'next/server'

const API_URL = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000/api'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.text()
  const authorization = request.headers.get('authorization')
  const headers: HeadersInit = { 'Content-Type': 'application/json' }

  if (authorization) {
    headers.Authorization = authorization
  }

  try {
    const response = await fetch(`${API_URL.replace(/\/$/, '')}/public/tenant/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers,
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
      { message: 'Backend is unavailable on the computer. Start it on 127.0.0.1:8000.' },
      { status: 502 },
    )
  }
}

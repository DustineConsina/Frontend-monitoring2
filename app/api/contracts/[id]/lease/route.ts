import { NextRequest } from 'next/server'

const API_URL = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000/api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const authorization = request.headers.get('authorization')
  const headers: HeadersInit = { Accept: 'application/pdf' }

  if (authorization) {
    headers.Authorization = authorization
  }

  try {
    const response = await fetch(`${API_URL.replace(/\/$/, '')}/contracts/${encodeURIComponent(id)}/lease`, {
      headers,
      cache: 'no-store',
    })

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/pdf',
        'Content-Disposition': response.headers.get('content-disposition') || 'inline',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return Response.json(
      { message: 'The lease service is unavailable on the computer.' },
      { status: 502 },
    )
  }
}

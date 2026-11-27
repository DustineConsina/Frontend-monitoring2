import { NextRequest } from 'next/server'
import { getBackendApiUrl } from '@/lib/backend-api-url'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    const response = await fetch(`${getBackendApiUrl()}/public/tenant-scan/complaints/replies`, {
      method: 'POST',
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
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : 'The backend service is currently unavailable.' },
      { status: 502 },
    )
  }
}

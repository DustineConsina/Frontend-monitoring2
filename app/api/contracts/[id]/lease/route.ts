import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sampleFilePath = join(process.cwd(), 'public', 'Sample of Contract of Lease.docx')

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params

  try {
    const sampleBytes = readFileSync(sampleFilePath)

    return new Response(new Uint8Array(sampleBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="Sample of Contract of Lease.docx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Lease file fetch failed:', error)
    return Response.json(
      {
        message: 'The lease template is unavailable.',
      },
      { status: 500 },
    )
  }
}

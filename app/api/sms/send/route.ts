import { NextRequest, NextResponse } from 'next/server'
import { getSmsProvider } from '@/lib/sms-provider'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phoneNumber = String(body.phoneNumber || body.phone_number || '').trim()
    const message = String(body.message || '').trim()

    if (!phoneNumber) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json({ message: 'Message is required' }, { status: 400 })
    }

    if (message.length > 918) {
      return NextResponse.json({ message: 'Message must be 918 characters or fewer' }, { status: 400 })
    }

    const result = await getSmsProvider().send({ phoneNumber, message })
    return NextResponse.json({ success: true, data: result }, { status: 202 })
  } catch {
    return NextResponse.json({ message: 'Unable to queue SMS' }, { status: 400 })
  }
}
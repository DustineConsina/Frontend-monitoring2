export type SmsRequest = {
  phoneNumber: string
  message: string
}

export type SmsResult = {
  provider: 'local' | 'semaphore'
  messageId: string
  status: 'queued' | 'sent' | 'delivered' | 'failed'
  error?: string
}

export interface SmsProvider {
  send(request: SmsRequest): Promise<SmsResult>
}

class LocalSmsProvider implements SmsProvider {
  async send({ phoneNumber, message }: SmsRequest): Promise<SmsResult> {
    const messageId = `local-sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    console.info('[SMS:local]', {
      messageId,
      phoneNumber,
      message,
    })

    return {
      provider: 'local',
      messageId,
      status: 'queued',
    }
  }
}

export function getSmsProvider(): SmsProvider {
  return new LocalSmsProvider()
}
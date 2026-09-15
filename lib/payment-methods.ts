export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'e_wallet', label: 'E-Wallet' },
] as const

export const BANK_TRANSFER_PROVIDERS = [
  'PayMongo',
  'MariBank',
  'GoTyme Bank',
  'BPI',
  'BDO',
  'Metrobank',
  'UnionBank',
  'Landbank',
  'RCBC',
  'Security Bank',
  'Other',
] as const

export const E_WALLET_PROVIDERS = [
  'GCash',
  'Maya',
  'GrabPay',
  'ShopeePay',
  'GoTyme',
  'Other',
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value']

export function getPaymentProviders(method: string): readonly string[] {
  return method === 'e_wallet' ? E_WALLET_PROVIDERS : BANK_TRANSFER_PROVIDERS
}

export function requiresPaymentDetails(method: string): boolean {
  return method === 'bank_transfer' || method === 'e_wallet'
}

export function getProviderValue(provider: string, customProvider: string): string {
  return provider === 'Other' ? customProvider.trim() : provider
}

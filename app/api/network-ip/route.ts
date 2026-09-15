import { NextResponse } from 'next/server'
import os from 'node:os'

const isPrivateIpv4 = (ipAddress: string) => {
  if (ipAddress.startsWith('10.')) return true
  if (ipAddress.startsWith('192.168.')) return true

  if (ipAddress.startsWith('172.')) {
    const secondOctet = Number(ipAddress.split('.')[1] || '')
    return Number.isInteger(secondOctet) && secondOctet >= 16 && secondOctet <= 31
  }

  return false
}

// Score network interfaces — higher = more preferred.
// Deprioritise virtual adapters (VirtualBox, VMware, Hyper-V, etc.)
const scoreInterface = (ifaceName: string): number => {
  const lower = ifaceName.toLowerCase()
  if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('wlan')) return 30
  if (lower.includes('ethernet') && !lower.includes('ethernet 2') && !lower.includes('vethernet')) return 20
  if (lower.includes('ethernet')) return 10
  // Virtual / tunnel adapters — lowest priority
  if (lower.includes('virtualbox') || lower.includes('vmware') || lower.includes('hyper-v') ||
      lower.includes('vethernet') || lower.includes('mcafee') || lower.includes('vpn') ||
      lower.includes('local area connection')) return 0
  return 5
}

export async function GET() {
  const networkInterfaces = os.networkInterfaces()

  type Candidate = { address: string; score: number }
  const candidates: Candidate[] = []

  for (const [ifaceName, interfaces] of Object.entries(networkInterfaces)) {
    if (!interfaces) continue
    const score = scoreInterface(ifaceName)

    for (const network of interfaces) {
      if (network.family !== 'IPv4' || network.internal) continue
      if (isPrivateIpv4(network.address)) {
        candidates.push({ address: network.address, score })
      }
    }
  }

  // Sort by score descending so the best adapter comes first
  candidates.sort((a, b) => b.score - a.score)

  const ipAddress = candidates[0]?.address
  if (!ipAddress) {
    return NextResponse.json(
      { error: 'No local IPv4 address detected.' },
      { status: 404 }
    )
  }

  return NextResponse.json({ ipAddress })
}

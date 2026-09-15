import { redirect } from 'next/navigation'

export default function TenantQrRedirectPage() {
  redirect('/dashboard/tenants/qr-print')
}

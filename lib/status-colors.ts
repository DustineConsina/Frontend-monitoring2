export function statusColorClass(status: unknown): string {
  const normalized = String(status || '').toLowerCase().replace(/\s+/g, '_')

  const classes: Record<string, string> = {
    active: 'status-active',
    available: 'status-available',
    paid: 'status-paid',
    sent: 'status-sent',
    occupied: 'status-occupied',
    pending: 'status-pending',
    renewed: 'status-renewed',
    issued: 'status-issued',
    maintenance: 'status-maintenance',
    for_renewal: 'status-for-renewal',
    partial: 'status-partial',
    expired: 'status-expired',
    terminated: 'status-terminated',
    overdue: 'status-overdue',
    cancelled: 'status-cancelled',
  }

  return `status-badge ${classes[normalized] || 'status-default'}`
}

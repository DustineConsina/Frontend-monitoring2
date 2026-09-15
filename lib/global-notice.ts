export type NoticeTone = 'info' | 'success' | 'error'

export function showGlobalNotice(title: string, message: string, tone: NoticeTone = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:notice', { detail: { title, message, tone } }))
  }
}

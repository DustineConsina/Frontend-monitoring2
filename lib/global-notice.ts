export function showGlobalNotice(title: string, message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:notice', { detail: { title, message } }))
  }
}

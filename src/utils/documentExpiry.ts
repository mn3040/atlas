export type DocumentExpiryTone = 'expired' | 'soon' | 'ok' | 'none'

export interface DocumentExpiryStatus {
  label: string
  tone: DocumentExpiryTone
}

export function expiryStatus(expiryDate: string | null): DocumentExpiryStatus {
  if (!expiryDate) return { label: 'No expiry on file', tone: 'none' }
  const days = Math.floor((new Date(`${expiryDate}T00:00:00`).getTime() - Date.now()) / 86_400_000)
  const formatted = new Date(`${expiryDate}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  if (days < 0) return { label: `Expired ${formatted}`, tone: 'expired' }
  if (days <= 90) return { label: `Expires ${formatted} · ${days}d`, tone: 'soon' }
  return { label: `Expires ${formatted}`, tone: 'ok' }
}

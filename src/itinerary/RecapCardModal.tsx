import { useEffect, useRef, useState } from 'react'
import { Copy, Download, Share2, X } from 'lucide-react'
import { createTripInvite, fetchTripInvites } from '../api/groupTrips'
import { buildDayRecapContent, buildTripRecapContent, drawRecapCard, CARD_HEIGHT, CARD_WIDTH } from '../utils/recapCard'
import type { RecapCardContent } from '../utils/recapCard'
import type { Day, Item, ItemDecision, ItemVoteSummary, Trip, TripMemberWithProfile } from '../types/trip'

type RecapCardModalProps =
  | {
      mode: 'day'
      trip: Trip
      userId: string
      day: Day
      dayIndex: number
      dayItems: Item[]
      decision: ItemDecision | null
      voteSummary: Record<string, ItemVoteSummary>
      onClose: () => void
    }
  | {
      mode: 'trip'
      trip: Trip
      userId: string
      days: Day[]
      items: Item[]
      decisions: Record<string, ItemDecision>
      members: TripMemberWithProfile[]
      onClose: () => void
    }

function contentFor(props: RecapCardModalProps): RecapCardContent {
  if (props.mode === 'day') {
    return buildDayRecapContent({
      trip: props.trip,
      day: props.day,
      dayIndex: props.dayIndex,
      dayItems: props.dayItems,
      decision: props.decision,
      voteSummary: props.voteSummary,
    })
  }
  return buildTripRecapContent({
    trip: props.trip,
    days: props.days,
    items: props.items,
    decisions: props.decisions,
    members: props.members,
  })
}

export function RecapCardModal(props: RecapCardModalProps) {
  const { trip, userId, onClose } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [joinUrl, setJoinUrl] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sharing, setSharing] = useState(false)

  const content = contentFor(props)

  useEffect(() => {
    let cancelled = false
    async function resolveJoinUrl() {
      if (trip.visibility !== 'group') {
        if (!cancelled) setJoinUrl(`${window.location.origin}/trips/${trip.id}`)
        return
      }
      try {
        const invites = await fetchTripInvites(trip.id)
        const invite = invites[0] ?? (await createTripInvite(trip.id, userId))
        if (!cancelled) setJoinUrl(`${window.location.origin}/join/${invite.token}`)
      } catch {
        if (!cancelled) setJoinUrl(`${window.location.origin}/trips/${trip.id}`)
      }
    }
    void resolveJoinUrl()
    return () => {
      cancelled = true
    }
  }, [trip.id, trip.visibility, userId])

  useEffect(() => {
    if (!canvasRef.current || !joinUrl) return
    let cancelled = false
    setReady(false)
    drawRecapCard(canvasRef.current, content, joinUrl)
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not render the recap card.')
      })
    return () => {
      cancelled = true
    }
  }, [content, joinUrl])

  async function toBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current
    if (!canvas) return null
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
  }

  async function handleSave() {
    const blob = await toBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trip.name.replace(/[^\w-]+/g, '_') || 'atlas-trip'}-recap.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  async function handleShare() {
    const blob = await toBlob()
    if (!blob) return
    setSharing(true)
    try {
      const file = new File([blob], 'atlas-trip-recap.png', { type: 'image/png' })
      const shareData = { files: [file], title: trip.name, text: `The plan for ${trip.name} →` }
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
        return
      }
    } catch {
      // user cancelled the native share sheet, or it isn't supported here -- fall back to a download
    } finally {
      setSharing(false)
    }
    await handleSave()
  }

  async function handleCopyLink() {
    if (!joinUrl) return
    await navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="atlas-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4">
      <button className="absolute inset-0 cursor-default" aria-label="Close recap card" onClick={onClose} />
      <section className="atlas-modal-panel relative max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-overlay)] sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-3xs font-bold uppercase tracking-[0.24em] text-green">Recap card</p>
            <h2 className="text-lg font-extrabold text-text">{content.mode === 'day' ? 'Share this pick' : 'Share the plan'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-text"
            aria-label="Close recap card"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative mb-4 overflow-hidden rounded-lg border border-border bg-ink">
          <canvas ref={canvasRef} width={CARD_WIDTH} height={CARD_HEIGHT} className="block h-auto w-full" />
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/70">
              <p className="text-xs font-semibold text-text-dim">Rendering recap...</p>
            </div>
          )}
        </div>

        {error && (
          <p className="mb-3 rounded-md border border-line-4/40 bg-line-4/10 px-3 py-2 text-xs font-semibold text-line-4">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleShare}
            disabled={!ready || sharing}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-paper px-3 text-sm font-extrabold text-ink disabled:cursor-wait disabled:opacity-50"
          >
            <Share2 size={14} /> {sharing ? 'Sharing...' : 'Share'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!ready}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-ink px-3 text-sm font-extrabold text-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} /> {saved ? 'Saved' : 'Save image'}
          </button>
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          disabled={!joinUrl}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-ink px-3 py-2 text-xs font-bold text-text-dim hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Copy size={12} /> {copied ? 'Link copied' : 'Copy join link'}
        </button>
      </section>
    </div>
  )
}

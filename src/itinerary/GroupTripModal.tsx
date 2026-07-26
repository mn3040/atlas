import { useEffect, useMemo, useState } from 'react'
import { Copy, Link2, RefreshCw, Users, X } from 'lucide-react'
import { createTripInvite, fetchTripInvites, fetchTripMembers, revokeTripInvite } from '../api/groupTrips'
import type { Trip, TripInvite, TripMemberWithProfile } from '../types/trip'

export function GroupTripModal({
  trip,
  userId,
  onClose,
}: {
  trip: Trip
  userId: string
  onClose: () => void
}) {
  const [members, setMembers] = useState<TripMemberWithProfile[]>([])
  const [invites, setInvites] = useState<TripInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeInvite = invites[0] ?? null
  const inviteLink = useMemo(
    () => (activeInvite ? `${window.location.origin}/join/${activeInvite.token}` : ''),
    [activeInvite],
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [memberData, inviteData] = await Promise.all([fetchTripMembers(trip.id), fetchTripInvites(trip.id)])
        if (!cancelled) {
          setMembers(memberData)
          setInvites(inviteData)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load group details.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [trip.id])

  async function ensureInvite() {
    if (activeInvite) return activeInvite
    setBusy(true)
    setError(null)
    try {
      const invite = await createTripInvite(trip.id, userId)
      setInvites((current) => [invite, ...current])
      return invite
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invite.')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function copyInvite() {
    const invite = await ensureInvite()
    if (!invite) return
    const link = `${window.location.origin}/join/${invite.token}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  async function refreshInvite() {
    setBusy(true)
    setError(null)
    try {
      if (activeInvite) await revokeTripInvite(activeInvite.id)
      const invite = await createTripInvite(trip.id, userId)
      setInvites([invite])
      setCopied(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh invite.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="atlas-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-start sm:justify-end sm:p-4">
      <button className="absolute inset-0 cursor-default" aria-label="Close group panel" onClick={onClose} />
      <section className="atlas-modal-panel relative max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-overlay)] sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-green">Group trip</p>
            <h2 className="text-lg font-extrabold text-text">Travelers and invite</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-text"
            aria-label="Close group panel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 rounded-md border border-border bg-ink p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-text">
              <Link2 size={13} /> Invite link
            </span>
            {trip.memberLimit && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-text-dim">
                {members.length}/{trip.memberLimit}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={inviteLink || 'Create a private invite link'}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text-dim"
            />
            <button
              type="button"
              onClick={copyInvite}
              disabled={busy}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-paper px-3 text-sm font-extrabold text-ink disabled:opacity-60"
            >
              <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            onClick={refreshInvite}
            disabled={busy}
            className="mt-2 flex items-center gap-1.5 text-xs font-bold text-text-dim hover:text-text"
          >
            <RefreshCw size={12} /> Refresh link
          </button>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-text-dimmer">
            <Users size={12} /> Members
          </p>
          {loading ? (
            <p className="rounded-md border border-border bg-ink px-3 py-4 text-sm text-text-dim">Loading...</p>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <li key={member.userId} className="flex items-center gap-3 rounded-md border border-border bg-ink px-3 py-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-extrabold uppercase"
                    style={{ background: member.avatarColor, color: member.avatarColor === '#f7ff88' ? '#070606' : '#fefefe' }}
                  >
                    {initials(member.displayName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-text">{member.displayName}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-text-dim">{member.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="mt-3 rounded-md border border-line-4/40 bg-line-4/10 px-3 py-2 text-xs font-semibold text-line-4">{error}</p>}
      </section>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

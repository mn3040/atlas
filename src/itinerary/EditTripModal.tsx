import { useState } from 'react'
import { UserRound, Users } from 'lucide-react'
import { CountryFlag } from '../components/CountryFlag'
import type { Trip, TripVisibility } from '../types/trip'

const inputClass =
  'w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-paper focus:outline-none'

export function EditTripModal({
  trip,
  onClose,
  onSave,
}: {
  trip: Trip
  onClose: () => void
  onSave: (input: {
    name: string
    description: string
    countryCode: string
    visibility: TripVisibility
    memberLimit: number | null
    startDate: string
    endDate: string
  }) => Promise<void>
}) {
  const [name, setName] = useState(trip.name)
  const [description, setDescription] = useState(trip.description ?? '')
  const [countryCode, setCountryCode] = useState(trip.countryCode ?? '')
  const [visibility, setVisibility] = useState<TripVisibility>(trip.visibility)
  const [memberLimit, setMemberLimit] = useState(trip.memberLimit ?? 4)
  const [startDate, setStartDate] = useState(trip.startDate)
  const [endDate, setEndDate] = useState(trip.endDate)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await onSave({
        name,
        description,
        countryCode,
        visibility,
        memberLimit: visibility === 'group' ? memberLimit : null,
        startDate,
        endDate,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save trip.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 text-sm font-bold text-text">Edit trip</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">Trip name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div className="w-28">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-dim">
                Primary country <CountryFlag countryCode={countryCode} className="h-3 w-auto rounded-[1px]" />
              </label>
              <input
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.slice(0, 2))}
                placeholder="KZ"
                maxLength={2}
                className={`mt-1 ${inputClass} uppercase`}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">
              Description <span className="normal-case text-text-dimmer">(optional)</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">Trip mode</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <ModeButton active={visibility === 'personal'} icon={UserRound} label="Personal" onClick={() => setVisibility('personal')} />
                <ModeButton active={visibility === 'group'} icon={Users} label="Group" onClick={() => setVisibility('group')} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">Travelers</label>
              <input
                type="number"
                min={1}
                max={99}
                disabled={visibility !== 'group'}
                value={memberLimit}
                onChange={(e) => setMemberLimit(Number(e.target.value) || 1)}
                className={`mt-1 ${inputClass} disabled:opacity-45`}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">Start date</label>
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">End date</label>
              <input
                required
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-text-dim hover:text-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-paper px-4 py-2 text-sm font-bold text-ink hover:bg-paper-dim disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof Users
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold"
      style={{
        borderColor: active ? 'var(--color-green)' : 'var(--color-border)',
        background: active ? 'rgba(34, 221, 133, 0.14)' : 'var(--color-ink)',
        color: active ? 'var(--color-green)' : 'var(--color-text-dim)',
      }}
    >
      <Icon size={14} /> {label}
    </button>
  )
}

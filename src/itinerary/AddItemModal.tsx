import { useState } from 'react'
import { Plane, BedDouble, MapPin } from 'lucide-react'
import { PlaceSearchInput } from '../components/PlaceSearchInput'
import type { PlaceResult } from '../api/geocoding'
import { createDay, createItem } from '../api/trips'
import type { NewItemInput } from '../api/trips'
import type { Day, Item, ItemType, ActivityCategory, Trip } from '../types/trip'

const CATEGORY_OPTIONS: ActivityCategory[] = [
  'attraction',
  'food',
  'transport',
  'shopping',
  'nature',
  'other',
]

const TYPE_TABS: { type: ItemType; label: string; icon: typeof MapPin }[] = [
  { type: 'activity', label: 'Activity', icon: MapPin },
  { type: 'flight', label: 'Flight', icon: Plane },
  { type: 'stay', label: 'Stay', icon: BedDouble },
]

export function AddItemModal({
  trip,
  days,
  defaultDate,
  itemCount,
  onClose,
  onDayCreated,
  onItemCreated,
}: {
  trip: Trip
  days: Day[]
  defaultDate?: string
  itemCount: number
  onClose: () => void
  onDayCreated: (day: Day) => void
  onItemCreated: (item: Item) => void
}) {
  const [type, setType] = useState<ItemType>('activity')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ActivityCategory>('attraction')
  const [place, setPlace] = useState<PlaceResult | null>(null)
  const [place2, setPlace2] = useState<PlaceResult | null>(null)
  const [startDate, setStartDate] = useState(defaultDate ?? trip.startDate)
  const [endDate, setEndDate] = useState(trip.endDate)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [flightNumber, setFlightNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function ensureDayFor(date: string): Promise<string> {
    const existing = days.find((d) => d.date === date)
    if (existing) return existing.id
    const day = await createDay(trip.id, date)
    onDayCreated(day)
    return day.id
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (type !== 'stay' && !place) {
      setError('Search for a location and pick one from the list.')
      return
    }
    if (type === 'flight' && !place2) {
      setError('Add both a departure and an arrival location.')
      return
    }
    if (type === 'stay' && !place) {
      setError('Search for the place you’re staying and pick one from the list.')
      return
    }

    setSubmitting(true)
    try {
      const dayId = type === 'stay' ? null : await ensureDayFor(startDate)

      const input: NewItemInput = {
        tripId: trip.id,
        dayId,
        type,
        category: type === 'activity' ? category : null,
        name,
        notes: null,
        lat: place!.lat,
        lng: place!.lng,
        locationLabel: place!.label,
        lat2: type === 'flight' ? place2!.lat : null,
        lng2: type === 'flight' ? place2!.lng : null,
        location2Label: type === 'flight' ? place2!.label : null,
        startDate,
        endDate: type === 'stay' ? endDate : type === 'flight' && endTime ? startDate : null,
        startTime: startTime || null,
        endTime: endTime || null,
        flightNumber: type === 'flight' ? flightNumber || null : null,
        position: itemCount,
      }

      const item = await createItem(input)
      onItemCreated(item)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6">
        <div className="flex gap-1 rounded-md bg-ink p-1">
          {TYPE_TABS.map(({ type: t, label, icon: Icon }) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors ${
                type === t ? 'bg-paper text-ink' : 'text-text-dim hover:text-text'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {type === 'activity' && (
            <>
              <PlaceSearchInput
                placeholder="Search for a place…"
                onSelect={(p) => {
                  setPlace(p)
                  if (!name) setName(p.label.split(',')[0])
                }}
              />
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-line-2 focus:outline-none"
              />
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                  className="rounded-md border border-border bg-ink px-3 py-2 text-sm text-text focus:border-line-2 focus:outline-none"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  required
                  min={trip.startDate}
                  max={trip.endDate}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-ink px-3 py-2 text-sm text-text focus:border-line-2 focus:outline-none"
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-md border border-border bg-ink px-3 py-2 text-sm text-text focus:border-line-2 focus:outline-none"
                />
              </div>
            </>
          )}

          {type === 'flight' && (
            <>
              <input
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
                placeholder="Airline + flight number (e.g. JAL 61)"
                className="w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-line-2 focus:outline-none"
              />
              <PlaceSearchInput
                placeholder="From (departure airport)…"
                onSelect={(p) => {
                  setPlace(p)
                  if (!name) setName(p.label.split(',')[0])
                }}
              />
              <PlaceSearchInput placeholder="To (arrival airport)…" onSelect={setPlace2} />
              <div className="flex gap-2">
                <input
                  type="date"
                  required
                  min={trip.startDate}
                  max={trip.endDate}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-ink px-3 py-2 text-sm text-text focus:border-line-2 focus:outline-none"
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="Departs"
                  className="rounded-md border border-border bg-ink px-3 py-2 text-sm text-text focus:border-line-2 focus:outline-none"
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="Arrives"
                  className="rounded-md border border-border bg-ink px-3 py-2 text-sm text-text focus:border-line-2 focus:outline-none"
                />
              </div>
            </>
          )}

          {type === 'stay' && (
            <>
              <PlaceSearchInput
                placeholder="Search for a hotel or address…"
                onSelect={(p) => {
                  setPlace(p)
                  if (!name) setName(p.label.split(',')[0])
                }}
              />
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-line-2 focus:outline-none"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block font-mono text-xs uppercase tracking-wide text-text-dim">Check in</label>
                  <input
                    type="date"
                    required
                    min={trip.startDate}
                    max={trip.endDate}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text focus:border-line-2 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block font-mono text-xs uppercase tracking-wide text-text-dim">Check out</label>
                  <input
                    type="date"
                    required
                    min={startDate}
                    max={trip.endDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text focus:border-line-2 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sm text-line-4">{error}</p>}

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
              className="rounded-md bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim disabled:opacity-60"
            >
              {submitting ? 'Adding…' : 'Add to trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

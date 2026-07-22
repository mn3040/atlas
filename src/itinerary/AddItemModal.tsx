import { useState } from 'react'
import { Plane, BedDouble, MapPin } from 'lucide-react'
import { PlaceSearchInput } from '../components/PlaceSearchInput'
import type { PlaceResult } from '../api/geocoding'
import { createDay, createItem, updateItem } from '../api/trips'
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

const inputClass =
  'w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-paper focus:outline-none'

function placeFromItem(label: string | null, lat: number, lng: number): PlaceResult {
  return {
    label: label ?? '',
    lat,
    lng,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    countryCode: null,
  }
}

export function AddItemModal({
  trip,
  days,
  defaultDate,
  itemCount,
  editItem,
  onClose,
  onDayCreated,
  onItemCreated,
  onItemUpdated,
}: {
  trip: Trip
  days: Day[]
  defaultDate?: string
  itemCount: number
  editItem?: Item
  onClose: () => void
  onDayCreated: (day: Day) => void
  onItemCreated: (item: Item) => void
  onItemUpdated?: (item: Item) => void
}) {
  const [type, setType] = useState<ItemType>(editItem?.type ?? 'activity')
  const [name, setName] = useState(editItem?.name ?? '')
  const [category, setCategory] = useState<ActivityCategory>(editItem?.category ?? 'attraction')
  const [place, setPlace] = useState<PlaceResult | null>(
    editItem ? placeFromItem(editItem.locationLabel, editItem.lat, editItem.lng) : null,
  )
  const [place2, setPlace2] = useState<PlaceResult | null>(
    editItem?.lat2 != null && editItem?.lng2 != null
      ? placeFromItem(editItem.location2Label, editItem.lat2, editItem.lng2)
      : null,
  )
  const [startDate, setStartDate] = useState(editItem?.startDate ?? defaultDate ?? trip.startDate)
  const [endDate, setEndDate] = useState(editItem?.endDate ?? trip.endDate)
  const [startTime, setStartTime] = useState(editItem?.startTime ?? '')
  const [endTime, setEndTime] = useState(editItem?.endTime ?? '')
  const [flightNumber, setFlightNumber] = useState(editItem?.flightNumber ?? '')
  const [priceLabel, setPriceLabel] = useState(editItem?.priceLabel ?? '')
  const [photoUrl, setPhotoUrl] = useState(editItem?.photoUrl ?? '')
  const [roomType, setRoomType] = useState(editItem?.roomType ?? '')
  const [guests, setGuests] = useState(editItem?.guests?.toString() ?? '2')
  const [nightlyRate, setNightlyRate] = useState(editItem?.nightlyRate?.toString() ?? '')
  const [taxesFees, setTaxesFees] = useState(editItem?.taxesFees?.toString() ?? '')
  const [confirmationNumber, setConfirmationNumber] = useState(editItem?.confirmationNumber ?? '')
  const [rating, setRating] = useState(editItem?.rating?.toString() ?? '5')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isEdit = Boolean(editItem)

  function selectPrimaryPlace(p: PlaceResult) {
    setPlace(p)
    if (!name) setName(p.label.split(',')[0])
  }

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
      const googleFields = { googleMapsUrl: place?.mapsUrl ?? null }

      if (isEdit && editItem) {
        const dayId = type === 'stay' ? editItem.dayId : await ensureDayFor(startDate)
        const updated = await updateItem(editItem.id, {
          dayId,
          category: type === 'activity' ? category : null,
          name,
          lat: place!.lat,
          lng: place!.lng,
          locationLabel: place!.label,
          lat2: type === 'flight' ? (place2?.lat ?? null) : null,
          lng2: type === 'flight' ? (place2?.lng ?? null) : null,
          location2Label: type === 'flight' ? (place2?.label ?? null) : null,
          priceLabel: priceLabel || null,
          photoUrl: photoUrl || null,
          ...googleFields,
          startDate,
          endDate: type === 'stay' ? endDate : editItem.endDate,
          startTime: startTime || null,
          endTime: endTime || null,
          flightNumber: type === 'flight' ? flightNumber || null : null,
          ...(type === 'stay'
            ? {
                roomType: roomType || null,
                guests: guests ? Number(guests) : null,
                nightlyRate: nightlyRate ? Number(nightlyRate) : null,
                taxesFees: taxesFees ? Number(taxesFees) : null,
                confirmationNumber: confirmationNumber || null,
                rating: rating ? Number(rating) : null,
              }
            : {}),
        })
        onItemUpdated?.(updated)
        onClose()
        return
      }

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
        priceLabel: priceLabel || null,
        photoUrl: photoUrl || null,
        ...googleFields,
        ...(type === 'stay'
          ? {
              roomType: roomType || null,
              guests: guests ? Number(guests) : null,
              nightlyRate: nightlyRate ? Number(nightlyRate) : null,
              taxesFees: taxesFees ? Number(taxesFees) : null,
              confirmationNumber: confirmationNumber || null,
              rating: rating ? Number(rating) : null,
            }
          : {}),
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
        {isEdit ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-text">
            {(() => {
              const Icon = TYPE_TABS.find((t) => t.type === type)?.icon ?? MapPin
              return <Icon size={16} />
            })()}
            Edit {type}
          </div>
        ) : (
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
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {type === 'activity' && (
            <>
              <PlaceSearchInput
                placeholder="Search for a place… (pick a new one to swap it)"
                defaultValue={editItem?.locationLabel ?? ''}
                onSelect={selectPrimaryPlace}
              />
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className={inputClass}
              />
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                  className={inputClass}
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
                  className={`flex-1 ${inputClass}`}
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={inputClass}
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
                className={inputClass}
              />
              <PlaceSearchInput
                placeholder="From (departure airport)…"
                defaultValue={editItem?.locationLabel ?? ''}
                onSelect={selectPrimaryPlace}
              />
              <PlaceSearchInput
                placeholder="To (arrival airport)…"
                defaultValue={editItem?.location2Label ?? ''}
                onSelect={setPlace2}
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  required
                  min={trip.startDate}
                  max={trip.endDate}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`flex-1 ${inputClass}`}
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="Departs"
                  className={inputClass}
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="Arrives"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {type === 'stay' && (
            <>
              <PlaceSearchInput
                placeholder="Search for a hotel or address… (pick a new one to swap it)"
                defaultValue={editItem?.locationLabel ?? ''}
                onSelect={selectPrimaryPlace}
              />
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className={inputClass}
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
                    className={`mt-1 ${inputClass}`}
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
                    className={`mt-1 ${inputClass}`}
                  />
                </div>
              </div>
              <input
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                placeholder="Room type (e.g. Deluxe City View Room)"
                className={inputClass}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  placeholder="Guests"
                  className={inputClass}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={nightlyRate}
                  onChange={(e) => setNightlyRate(e.target.value)}
                  placeholder="Rate / night ($)"
                  className={inputClass}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={taxesFees}
                  onChange={(e) => setTaxesFees(e.target.value)}
                  placeholder="Taxes & fees ($)"
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2">
                <input
                  value={confirmationNumber}
                  onChange={(e) => setConfirmationNumber(e.target.value)}
                  placeholder="Confirmation number"
                  className={inputClass}
                />
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className={`w-32 ${inputClass}`}
                >
                  {[1, 2, 3, 4, 5].map((r) => (
                    <option key={r} value={r}>
                      {r} star{r > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {type !== 'stay' && (
            <input
              value={priceLabel}
              onChange={(e) => setPriceLabel(e.target.value)}
              placeholder="Price label (e.g. Avg $18.00 per person, Free entry)"
              className={inputClass}
            />
          )}
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="Photo URL (optional)"
            className={inputClass}
          />
          {place?.mapsUrl && (
            <a
              href={place.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs font-semibold text-paper hover:underline"
            >
              View on Google Maps &rsaquo;
            </a>
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
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add to trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

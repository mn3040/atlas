import { useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  Clock3,
  DollarSign,
  Hash,
  Image,
  MapPin,
  Plane,
  Star,
  Tag,
  Users,
  X,
} from 'lucide-react'
import { PlaceSearchInput } from '../components/PlaceSearchInput'
import { googleMapsSearchUrl } from '../api/geocoding'
import type { PlaceResult } from '../api/geocoding'
import { createDay, createItem, updateItem } from '../api/trips'
import type { NewItemInput } from '../api/trips'
import type { Day, Item, ItemType, ActivityCategory, Trip } from '../types/trip'

const CATEGORY_OPTIONS: ActivityCategory[] = ['attraction', 'food', 'transport', 'shopping', 'nature', 'other']

const TYPE_TABS: { type: ItemType; label: string; description: string; icon: typeof MapPin }[] = [
  { type: 'activity', label: 'Activity', description: 'Places, food, hikes, tours', icon: MapPin },
  { type: 'flight', label: 'Flight', description: 'Departure and arrival', icon: Plane },
  { type: 'stay', label: 'Stay', description: 'Hotels, yurts, rentals', icon: BedDouble },
]

const inputClass =
  'min-h-11 w-full rounded-md border border-border bg-ink/85 px-3 py-2 text-base font-semibold text-text placeholder:text-text-dim transition-colors focus:border-green focus:bg-ink focus:outline-none sm:text-sm'
const placeInputClass =
  'h-11 border-border bg-ink/85 font-semibold transition-colors focus:border-green focus:bg-ink'

function placeFromItem(label: string | null, lat: number, lng: number, countryCode: string | null): PlaceResult {
  const fallback = `${lat},${lng}`
  const query = label?.trim() || fallback
  return {
    label: label ?? fallback,
    lat,
    lng,
    mapsUrl: googleMapsSearchUrl(query),
    countryCode,
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
    editItem ? placeFromItem(editItem.locationLabel, editItem.lat, editItem.lng, editItem.countryCode) : null,
  )
  const [place2, setPlace2] = useState<PlaceResult | null>(
    editItem?.lat2 != null && editItem?.lng2 != null
      ? placeFromItem(editItem.location2Label, editItem.lat2, editItem.lng2, null)
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
  const selectedType = TYPE_TABS.find((tab) => tab.type === type) ?? TYPE_TABS[0]
  const SelectedIcon = selectedType.icon

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

  async function handleSubmit(event: FormEvent) {
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
      setError("Search for the place you're staying and pick one from the list.")
      return
    }

    setSubmitting(true)
    try {
      const googleFields = {
        googleMapsUrl: place ? googleMapsSearchUrl([name, place.label].filter(Boolean).join(', ')) : null,
      }

      if (isEdit && editItem) {
        const dayId = await ensureDayFor(startDate)
        const updated = await updateItem(editItem.id, {
          dayId,
          category: type === 'activity' ? category : null,
          name,
          lat: place!.lat,
          lng: place!.lng,
          locationLabel: place!.label,
          countryCode: place!.countryCode,
          lat2: type === 'flight' ? (place2?.lat ?? null) : null,
          lng2: type === 'flight' ? (place2?.lng ?? null) : null,
          location2Label: type === 'flight' ? (place2?.label ?? null) : null,
          priceLabel: priceLabel || null,
          photoUrl: photoUrl || null,
          ...googleFields,
          startDate,
          endDate: type === 'stay' ? endDate : endTime ? startDate : editItem.endDate,
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

      const dayId = await ensureDayFor(startDate)

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
        countryCode: place!.countryCode,
        lat2: type === 'flight' ? place2!.lat : null,
        lng2: type === 'flight' ? place2!.lng : null,
        location2Label: type === 'flight' ? place2!.label : null,
        startDate,
        endDate: type === 'stay' ? endDate : endTime ? startDate : null,
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
    <div className="atlas-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${isEdit ? 'Edit' : 'Add'} ${selectedType.label}`}
        className="atlas-modal-panel max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-border-strong bg-surface shadow-[var(--shadow-overlay)]"
      >
        <div className="border-b border-border bg-[linear-gradient(135deg,rgba(34,221,133,0.14),rgba(247,255,136,0.08)_42%,rgba(7,6,6,0)_72%)] px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-paper text-ink">
                <SelectedIcon size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-green">
                  {isEdit ? 'Edit itinerary stop' : 'Add itinerary stop'}
                </p>
                <h2 className="mt-1 truncate text-xl font-extrabold leading-tight text-text">{selectedType.label}</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-ink/70 text-text-dim hover:border-paper hover:text-paper"
            >
              <X size={16} />
            </button>
          </div>

          {!isEdit && (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {TYPE_TABS.map(({ type: t, label, description, icon: Icon }) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`group flex min-h-[68px] items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors ${
                    type === t
                      ? 'border-paper bg-paper text-ink'
                      : 'border-border bg-ink/60 text-text-dim hover:border-border-strong hover:bg-surface-3 hover:text-text'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                      type === t ? 'bg-ink text-paper' : 'bg-surface text-text-dim group-hover:text-text'
                    }`}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold">{label}</span>
                    <span className="mt-0.5 block text-[10px] leading-tight opacity-70">{description}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4 sm:px-5">
          {type === 'activity' && (
            <>
              <Field label="Location" icon={MapPin}>
                <PlaceSearchInput
                  placeholder="Search for a place"
                  defaultValue={editItem?.locationLabel ?? ''}
                  onSelect={selectPrimaryPlace}
                  className={placeInputClass}
                />
              </Field>
              <Field label="Display name" icon={Tag}>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  className={inputClass}
                />
              </Field>
              <div className="grid gap-2 sm:grid-cols-4">
                <Field label="Category" icon={MapPin}>
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
                </Field>
                <Field label="Date" icon={CalendarDays}>
                  <input
                    type="date"
                    required
                    min={trip.startDate}
                    max={trip.endDate}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Starts" icon={Clock3}>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Ends" icon={Clock3}>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </>
          )}

          {type === 'flight' && (
            <>
              <Field label="Flight" icon={Plane}>
                <input
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value)}
                  placeholder="Airline + flight number"
                  className={inputClass}
                />
              </Field>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <Field label="From" icon={MapPin}>
                  <PlaceSearchInput
                    placeholder="Departure airport"
                    defaultValue={editItem?.locationLabel ?? ''}
                    onSelect={selectPrimaryPlace}
                    className={placeInputClass}
                  />
                </Field>
                <div className="hidden items-end pb-0 sm:flex">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-ink text-text-dim">
                    <ArrowRight size={16} />
                  </div>
                </div>
                <Field label="To" icon={MapPin}>
                  <PlaceSearchInput
                    placeholder="Arrival airport"
                    defaultValue={editItem?.location2Label ?? ''}
                    onSelect={setPlace2}
                    className={placeInputClass}
                  />
                </Field>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Date" icon={CalendarDays}>
                  <input
                    type="date"
                    required
                    min={trip.startDate}
                    max={trip.endDate}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Departs" icon={Clock3}>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Arrives" icon={Clock3}>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </>
          )}

          {type === 'stay' && (
            <>
              <Field label="Stay location" icon={BedDouble}>
                <PlaceSearchInput
                  placeholder="Search for a hotel or address"
                  defaultValue={editItem?.locationLabel ?? ''}
                  onSelect={selectPrimaryPlace}
                  className={placeInputClass}
                />
              </Field>
              <Field label="Stay name" icon={Tag}>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  className={inputClass}
                />
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Check in" icon={CalendarDays}>
                  <input
                    type="date"
                    required
                    min={trip.startDate}
                    max={trip.endDate}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Check out" icon={CalendarDays}>
                  <input
                    type="date"
                    required
                    min={startDate}
                    max={trip.endDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Room" icon={BedDouble}>
                <input
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  placeholder="Room type"
                  className={inputClass}
                />
              </Field>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Guests" icon={Users}>
                  <input
                    type="number"
                    min={1}
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    placeholder="Guests"
                    className={inputClass}
                  />
                </Field>
                <Field label="Rate / night" icon={DollarSign}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={nightlyRate}
                    onChange={(e) => setNightlyRate(e.target.value)}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </Field>
                <Field label="Taxes & fees" icon={DollarSign}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={taxesFees}
                    onChange={(e) => setTaxesFees(e.target.value)}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                <Field label="Confirmation" icon={Hash}>
                  <input
                    value={confirmationNumber}
                    onChange={(e) => setConfirmationNumber(e.target.value)}
                    placeholder="Confirmation number"
                    className={inputClass}
                  />
                </Field>
                <Field label="Rating" icon={Star}>
                  <select value={rating} onChange={(e) => setRating(e.target.value)} className={inputClass}>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r}>
                        {r} star{r > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </>
          )}

          {type !== 'stay' && (
            <Field label="Price" icon={DollarSign}>
              <input
                value={priceLabel}
                onChange={(e) => setPriceLabel(e.target.value)}
                placeholder="Avg $18.00 per person, Free entry"
                className={inputClass}
              />
            </Field>
          )}
          <Field label="Photo" icon={Image}>
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="Photo URL"
              className={inputClass}
            />
          </Field>

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

          {error && <p className="border-l-4 border-line-4 bg-ink px-3 py-2 text-sm font-semibold text-text">{error}</p>}

          <div className="sticky bottom-0 -mx-4 -mb-4 mt-2 flex flex-col-reverse gap-2 border-t border-border bg-surface/95 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:-mx-5 sm:flex-row sm:justify-end sm:px-5 sm:pb-4">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-md border border-transparent px-4 text-sm font-bold text-text-dim hover:border-border hover:text-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-md bg-paper px-5 text-sm font-extrabold text-ink shadow-[0_0_0_1px_rgba(247,255,136,0.25),0_10px_24px_rgba(247,255,136,0.12)] hover:bg-paper-dim disabled:opacity-60"
            >
              {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add to trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof MapPin; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-text-dimmer">
        <Icon size={12} /> {label}
      </span>
      {children}
    </label>
  )
}

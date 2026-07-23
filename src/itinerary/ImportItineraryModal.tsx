/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import { FileUp, Loader2, Star, Trash2 } from 'lucide-react'
import { createDay, createItem } from '../api/trips'
import type { NewItemInput } from '../api/trips'
import { googleMapsSearchUrl, searchPlaces } from '../api/geocoding'
import type { PlaceSearchOptions } from '../api/geocoding'
import { estimateTravel } from '../utils/distance'
import type { Day, Item, Trip, ActivityCategory, ItemType } from '../types/trip'
import { extractItineraryItems, extractTextFromFile } from '../utils/importItinerary'
import type { ExtractedItineraryItem } from '../utils/importItinerary'

const inputClass =
  'w-full rounded-md border border-border bg-ink px-2 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-paper focus:outline-none'

const categories: ActivityCategory[] = ['attraction', 'food', 'transport', 'shopping', 'nature', 'other']
const types: ItemType[] = ['activity', 'flight', 'stay']

export function ImportItineraryModal({
  trip,
  days,
  itemCount,
  onClose,
  onDayCreated,
  onItemsCreated,
  onMustSeeCreated,
}: {
  trip: Trip
  days: Day[]
  itemCount: number
  onClose: () => void
  onDayCreated: (day: Day) => void
  onItemsCreated: (items: Item[]) => void
  onMustSeeCreated: (itemIds: string[]) => void
}) {
  const [suggestions, setSuggestions] = useState<ExtractedItineraryItem[]>([])
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File) {
    setBusy(true)
    setError('')
    setStatus('Reading document...')
    setFileName(file.name)
    try {
      const text = await extractTextFromFile(file)
      setStatus('Finding itinerary details...')
      const extracted = extractItineraryItems(text, trip)
      setSuggestions(extracted)
      setStatus(extracted.length ? `${extracted.length} suggestions found.` : 'No itinerary details found.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that document.')
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  function updateSuggestion(id: string, patch: Partial<ExtractedItineraryItem>) {
    setSuggestions((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function removeSuggestion(id: string) {
    setSuggestions((current) => current.filter((item) => item.id !== id))
  }

  async function importSelected() {
    const selected = suggestions.filter((item) => item.selected)
    if (selected.length === 0) {
      setError('Select at least one itinerary item to import.')
      return
    }

    setBusy(true)
    setError('')
    setStatus('Creating itinerary items...')
    try {
      const { createdItems, mustSeeCreatedIds, warnings } = await importSuggestionsToTrip({
        trip,
        days,
        itemCount,
        suggestions: selected,
        onDayCreated,
        onStatus: setStatus,
      })

      onItemsCreated(createdItems)
      onMustSeeCreated(mustSeeCreatedIds)
      if (warnings.length > 0) {
        console.warn('Atlas import completed with unresolved locations', warnings)
      }
      onClose()
    } catch (err) {
      setError(importErrorMessage(err))
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-3 py-4 sm:px-4 sm:py-8">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto rounded-lg border border-border bg-surface p-4 sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-paper">Document import</p>
            <h2 className="text-xl font-extrabold text-text">Extract itinerary details</h2>
            {fileName && <p className="mt-1 text-xs text-text-dim">{fileName}</p>}
          </div>
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-semibold text-text-dim hover:text-text">
            Close
          </button>
        </div>

        <label className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center hover:border-paper">
          {busy ? <Loader2 size={24} className="animate-spin text-paper" /> : <FileUp size={24} className="text-paper" />}
          <span className="text-sm font-bold text-text">Upload PDF, DOCX, TXT, or Markdown</span>
          <span className="text-xs text-text-dim">You can review and edit everything before it is added.</span>
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) void handleFile(file)
              event.currentTarget.value = ''
            }}
          />
        </label>

        {status && <p className="mb-3 text-sm font-semibold text-text-dim">{status}</p>}
        {error && <p className="mb-3 border-l-4 border-line-3 bg-surface-2 px-3 py-2 text-sm font-semibold text-text">{error}</p>}

        {suggestions.length > 0 && (
          <div className="max-h-[52vh] overflow-y-auto rounded-lg border border-border">
            <div className="space-y-3 p-3 md:hidden">
              {suggestions.map((item) => (
                <ImportReviewCard
                  key={item.id}
                  item={item}
                  updateSuggestion={updateSuggestion}
                  removeSuggestion={removeSuggestion}
                />
              ))}
            </div>

            <table className="hidden w-full min-w-[920px] border-collapse text-left text-xs md:table">
              <thead className="sticky top-0 bg-surface-2 text-text-dim">
                <tr>
                  <th className="w-10 border-b border-border p-2">Use</th>
                  <th className="border-b border-border p-2">Type</th>
                  <th className="border-b border-border p-2">Name</th>
                  <th className="border-b border-border p-2">Date</th>
                  <th className="border-b border-border p-2">Time</th>
                  <th className="border-b border-border p-2">Location</th>
                  <th className="border-b border-border p-2">Details</th>
                  <th className="w-12 border-b border-border p-2">Star</th>
                  <th className="w-10 border-b border-border p-2" />
                </tr>
              </thead>
              <tbody>
                {suggestions.map((item) => (
                  <tr key={item.id} className="border-b border-border align-top">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(event) => updateSuggestion(item.id, { selected: event.target.checked })}
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={item.type}
                        onChange={(event) => updateSuggestion(item.id, { type: event.target.value as ItemType })}
                        className={inputClass}
                      >
                        {types.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input value={item.name ?? ''} onChange={(event) => updateSuggestion(item.id, { name: event.target.value })} className={inputClass} />
                      {item.type === 'activity' && (
                        <select
                          value={item.category}
                          onChange={(event) => updateSuggestion(item.id, { category: event.target.value as ActivityCategory })}
                          className={`${inputClass} mt-1`}
                        >
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-2">
                      <input
                        type="date"
                        min={trip.startDate}
                        max={trip.endDate}
                        value={item.startDate ?? ''}
                        onChange={(event) => updateSuggestion(item.id, { startDate: event.target.value })}
                        className={inputClass}
                      />
                      {item.type === 'stay' && (
                        <input
                          type="date"
                          min={item.startDate}
                          max={trip.endDate}
                          value={item.endDate ?? ''}
                          onChange={(event) => updateSuggestion(item.id, { endDate: event.target.value })}
                          className={`${inputClass} mt-1`}
                        />
                      )}
                    </td>
                    <td className="p-2">
                      <input type="time" value={item.startTime ?? ''} onChange={(event) => updateSuggestion(item.id, { startTime: event.target.value })} className={inputClass} />
                      <input type="time" value={item.endTime ?? ''} onChange={(event) => updateSuggestion(item.id, { endTime: event.target.value })} className={`${inputClass} mt-1`} />
                    </td>
                    <td className="p-2">
                      <input
                        value={item.locationLabel ?? ''}
                        onChange={(event) => updateSuggestion(item.id, { locationLabel: event.target.value })}
                        placeholder="Place or address"
                        className={inputClass}
                      />
                      {item.type === 'flight' && (
                        <input
                          value={item.location2Label ?? ''}
                          onChange={(event) => updateSuggestion(item.id, { location2Label: event.target.value })}
                          placeholder="Arrival"
                          className={`${inputClass} mt-1`}
                        />
                      )}
                    </td>
                    <td className="p-2">
                      {item.type === 'flight' && (
                        <input
                          value={item.flightNumber ?? ''}
                          onChange={(event) => updateSuggestion(item.id, { flightNumber: event.target.value })}
                          placeholder="Flight number"
                          className={inputClass}
                        />
                      )}
                      {item.type === 'stay' && (
                        <input
                          value={item.confirmationNumber ?? ''}
                          onChange={(event) => updateSuggestion(item.id, { confirmationNumber: event.target.value })}
                          placeholder="Confirmation"
                          className={inputClass}
                        />
                      )}
                      <textarea
                        value={item.notes ?? ''}
                        onChange={(event) => updateSuggestion(item.id, { notes: event.target.value })}
                        className={`${inputClass} mt-1 min-h-14 resize-y`}
                      />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => updateSuggestion(item.id, { mustSee: !item.mustSee })}
                        aria-label={item.mustSee ? `Unstar ${item.name}` : `Star ${item.name} as must-see`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-ink text-paper hover:border-paper"
                      >
                        <Star size={14} fill={item.mustSee ? 'var(--color-paper)' : 'none'} />
                      </button>
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => removeSuggestion(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-line-3"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-text-dim hover:text-text">
            Cancel
          </button>
          <button
            type="button"
            onClick={importSelected}
            disabled={busy || suggestions.every((item) => !item.selected)}
            className="rounded-md bg-paper px-4 py-2 text-sm font-bold text-ink hover:bg-paper-dim disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Importing...' : 'Import selected'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ImportReviewCard({
  item,
  updateSuggestion,
  removeSuggestion,
}: {
  item: ExtractedItineraryItem
  updateSuggestion: (id: string, patch: Partial<ExtractedItineraryItem>) => void
  removeSuggestion: (id: string) => void
}) {
  return (
    <article className="rounded-lg border border-border bg-ink p-3">
      <div className="mb-3 flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.selected}
          onChange={(event) => updateSuggestion(item.id, { selected: event.target.checked })}
          className="mt-1"
          aria-label={`Import ${item.name}`}
        />
        <div className="min-w-0 flex-1">
          <input
            value={item.name ?? ''}
            onChange={(event) => updateSuggestion(item.id, { name: event.target.value })}
            className="w-full bg-transparent text-base font-extrabold text-text outline-none"
          />
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-text-dim">
            {item.type} / {item.startDate || 'Needs date'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => removeSuggestion(item.id)}
          aria-label={`Remove ${item.name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-line-3"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-text-dim">Type</span>
          <select
            value={item.type}
            onChange={(event) => updateSuggestion(item.id, { type: event.target.value as ItemType })}
            className={inputClass}
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-text-dim">Date</span>
          <input
            type="date"
            value={item.startDate ?? ''}
            onChange={(event) => updateSuggestion(item.id, { startDate: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-text-dim">Starts</span>
          <input
            type="time"
            value={item.startTime ?? ''}
            onChange={(event) => updateSuggestion(item.id, { startTime: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-text-dim">Ends</span>
          <input
            type="time"
            value={item.endTime ?? ''}
            onChange={(event) => updateSuggestion(item.id, { endTime: event.target.value })}
            className={inputClass}
          />
        </label>
      </div>

      {item.type === 'activity' && (
        <label className="mt-2 block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-text-dim">Category</span>
          <select
            value={item.category}
            onChange={(event) => updateSuggestion(item.id, { category: event.target.value as ActivityCategory })}
            className={inputClass}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="mt-2 block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-text-dim">Location</span>
        <input
          value={item.locationLabel ?? ''}
          onChange={(event) => updateSuggestion(item.id, { locationLabel: event.target.value })}
          placeholder="Place or address"
          className={inputClass}
        />
      </label>
      {item.type === 'flight' && (
        <label className="mt-2 block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-text-dim">Arrival</span>
          <input
            value={item.location2Label ?? ''}
            onChange={(event) => updateSuggestion(item.id, { location2Label: event.target.value })}
            placeholder="Arrival airport"
            className={inputClass}
          />
        </label>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => updateSuggestion(item.id, { mustSee: !item.mustSee })}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-extrabold text-paper"
        >
          <Star size={13} fill={item.mustSee ? 'var(--color-paper)' : 'none'} />
          Must see
        </button>
      </div>
    </article>
  )
}

export async function importSuggestionsToTrip({
  trip,
  days,
  itemCount,
  suggestions,
  onDayCreated,
  onStatus,
}: {
  trip: Trip
  days: Day[]
  itemCount: number
  suggestions: ExtractedItineraryItem[]
  onDayCreated: (day: Day) => void
  onStatus?: (status: string) => void
}): Promise<{ createdItems: Item[]; mustSeeCreatedIds: string[]; warnings: string[] }> {
  const knownDays = [...days]
  const createdItems: Item[] = []
  const mustSeeCreatedIds: string[] = []
  const schedules = new Map<string, DayImportSchedule>()
  const warnings: string[] = []
  const perDayPositions = new Map<string, number>()

  for (const item of suggestions) {
    perDayPositions.set(item.startDate, Math.max(perDayPositions.get(item.startDate) ?? itemCount, itemCount))
  }

  for (let index = 0; index < suggestions.length; index += 1) {
    const suggestion = suggestions[index]
    const dayId = await ensureDayFor(suggestion.startDate, trip.id, knownDays, onDayCreated)
    onStatus?.(`Importing ${index + 1} of ${suggestions.length}: ${suggestion.name}`)
    const primary = await resolveLocation(suggestion.locationLabel || suggestion.name, trip, warnings)
    const secondary =
      suggestion.type === 'flight' && suggestion.location2Label
        ? await resolveLocation(suggestion.location2Label, trip, warnings)
        : null
    const scheduled = scheduleSuggestion(schedules, suggestion, primary)
    const position = perDayPositions.get(suggestion.startDate) ?? itemCount
    perDayPositions.set(suggestion.startDate, position + 1)

    const input: NewItemInput = {
      tripId: trip.id,
      dayId,
      type: suggestion.type,
      category: suggestion.type === 'activity' ? suggestion.category : null,
      name: suggestion.name,
      notes: suggestion.notes || null,
      lat: primary.lat,
      lng: primary.lng,
      locationLabel: primary.label,
      countryCode: primary.countryCode,
      lat2: secondary?.lat ?? null,
      lng2: secondary?.lng ?? null,
      location2Label: secondary?.label ?? null,
      startDate: suggestion.startDate,
      endDate: suggestion.type === 'stay' ? suggestion.endDate || trip.endDate : null,
      startTime: scheduled.startTime || null,
      endTime: scheduled.endTime || null,
      flightNumber: suggestion.type === 'flight' ? suggestion.flightNumber || null : null,
      priceLabel: null,
      photoUrl: null,
      googleMapsUrl: googleMapsSearchUrl([suggestion.name, primary.label].filter(Boolean).join(', ')),
      confirmationNumber: suggestion.type === 'stay' ? suggestion.confirmationNumber || null : null,
      position,
    }

    const created = await createItem(input)
    createdItems.push(created)
    if (suggestion.mustSee) mustSeeCreatedIds.push(created.id)
  }

  return { createdItems, mustSeeCreatedIds, warnings }
}

async function ensureDayFor(
  date: string,
  tripId: string,
  knownDays: Day[],
  onDayCreated: (day: Day) => void,
): Promise<string> {
  const existing = knownDays.find((day) => day.date === date)
  if (existing) return existing.id
  const day = await createDay(tripId, date)
  knownDays.push(day)
  onDayCreated(day)
  return day.id
}

interface ResolvedLocation {
  label: string
  lat: number
  lng: number
  countryCode: string | null
}

interface DayImportSchedule {
  cursorMinutes: number
  previousLocation: ResolvedLocation | null
}

function scheduleSuggestion(
  schedules: Map<string, DayImportSchedule>,
  suggestion: ExtractedItineraryItem,
  location: ResolvedLocation,
): { startTime: string; endTime: string } {
  if (suggestion.type !== 'activity') {
    return { startTime: suggestion.startTime, endTime: suggestion.endTime }
  }

  const schedule = schedules.get(suggestion.startDate) ?? { cursorMinutes: 8 * 60 + 30, previousLocation: null }
  let startMinutes = suggestion.startTime ? minutesFromTime(suggestion.startTime) : schedule.cursorMinutes

  if (!suggestion.startTime && schedule.previousLocation) {
    const travel = estimateTravel(schedule.previousLocation, location, 'car')
    startMinutes += Math.min(240, travel.minutes) + 15
  }

  const duration = suggestedDurationMinutes(suggestion)
  const endMinutes = suggestion.endTime ? minutesFromTime(suggestion.endTime) : startMinutes + duration
  schedule.cursorMinutes = endMinutes + 30
  schedule.previousLocation = location
  schedules.set(suggestion.startDate, schedule)

  return {
    startTime: suggestion.startTime || timeFromMinutes(startMinutes),
    endTime: suggestion.endTime || timeFromMinutes(endMinutes),
  }
}

function suggestedDurationMinutes(suggestion: ExtractedItineraryItem): number {
  const text = `${suggestion.name} ${suggestion.notes}`.toLowerCase()
  if (/\bday\b|\bhike\b|\bhorse\b|\btrek\b/.test(text)) return 240
  if (suggestion.category === 'food') return 75
  if (suggestion.category === 'transport') return 60
  if (suggestion.category === 'nature') return 150
  return 90
}

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function timeFromMinutes(value: number): string {
  const minutes = ((Math.round(value / 5) * 5) % (24 * 60) + 24 * 60) % (24 * 60)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

async function resolveLocation(query: string, trip: Trip, warnings: string[]): Promise<ResolvedLocation> {
  const fallback = cleanImportQuery(query) || 'Location'
  const fixture = fixtureForLocation(fallback)
  if (fixture) return fixture

  const searchOptions = searchOptionsFor(fallback, trip)
  try {
    const results = await searchPlaces(searchQueryFor(fallback, searchOptions.countryCodes), undefined, searchOptions)
    const match = results[0]
    if (match) return { label: match.label, lat: match.lat, lng: match.lng, countryCode: match.countryCode }
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    warnings.push(fallback)
  }

  const countryFallback = fallbackLocationFor(fallback, trip.countryCode)
  if (!warnings.includes(fallback)) warnings.push(fallback)
  return { label: fallback, ...countryFallback }
}

function cleanImportQuery(query: string): string {
  return query
    .replace(/\batlas_place_link\b/gi, '')
    .replace(/\s+\((?:frontend|backend)\)\s*$/i, '')
    .replace(/\s+&\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function searchOptionsFor(query: string, trip: Trip): PlaceSearchOptions {
  const countryCodes = orderedUnique([countryCodeFromText(query.toLowerCase()), trip.countryCode?.toUpperCase()])
  const center = countryCodes.map((code) => COUNTRY_CENTERS[code]).find(Boolean)
  return { countryCodes, center }
}

function searchQueryFor(query: string, countryCodes?: string[]): string {
  if (!countryCodes?.length) return query
  const countryNames = countryCodes.map((code) => COUNTRY_NAMES[code]).filter(Boolean)
  if (countryNames.some((name) => query.toLowerCase().includes(name.toLowerCase()))) return query
  return [query, countryNames[0]].filter(Boolean).join(', ')
}

function fallbackLocationFor(query: string, countryCode: string | null): Pick<ResolvedLocation, 'lat' | 'lng' | 'countryCode'> {
  const normalizedQuery = query.toLowerCase()
  const inferredCode =
    countryCodeFromText(normalizedQuery) ?? (countryCode && countryCode.length === 2 ? countryCode.toUpperCase() : null)
  const center = inferredCode ? COUNTRY_CENTERS[inferredCode] : null
  return center ? { lat: center.lat, lng: center.lng, countryCode: inferredCode } : { lat: 0, lng: 0, countryCode: null }
}

function countryCodeFromText(text: string): string | null {
  if (
    /\bkyrgyz|bishkek|osh|karakol|issyk|naryn|song kol|song kul|kel suu|kel-suu|ala-kul|ala kul|altyn arashan|peak lenin|tulpar|sary mogul|ala-archa|burana|dordoi|kok kiya|tash rabat|bokonbayevo|skazka|jeti oguz|kok jaiyk|barskoon|enilchek|jyrgalan\b/.test(
      text,
    )
  ) {
    return 'KG'
  }
  if (/\bkazakh|astana|almaty\b/.test(text)) return 'KZ'
  if (/\bturkey|istanbul|ankara|cappadocia\b/.test(text)) return 'TR'
  if (/\btajik|dushanbe|karakul|ak baital\b/.test(text)) return 'TJ'
  return null
}

function fixtureForLocation(query: string): ResolvedLocation | null {
  const normalized = normalizeLocationKey(query)
  const key = Object.keys(CENTRAL_ASIA_FIXTURES).find((fixtureKey) => normalized.includes(fixtureKey))
  return key ? CENTRAL_ASIA_FIXTURES[key] : null
}

function normalizeLocationKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function orderedUnique(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

const COUNTRY_CENTERS: Record<string, { lat: number; lng: number }> = {
  KG: { lat: 41.2044, lng: 74.7661 },
  KZ: { lat: 48.0196, lng: 66.9237 },
  TR: { lat: 38.9637, lng: 35.2433 },
  TJ: { lat: 38.861, lng: 71.2761 },
  US: { lat: 39.8283, lng: -98.5795 },
}

const COUNTRY_NAMES: Record<string, string> = {
  KG: 'Kyrgyzstan',
  KZ: 'Kazakhstan',
  TR: 'Turkey',
  TJ: 'Tajikistan',
  US: 'United States',
}

const CENTRAL_ASIA_FIXTURES: Record<string, ResolvedLocation> = {
  'peak lenin': { label: 'Peak Lenin Base Camp, Kyrgyzstan', lat: 39.446, lng: 72.877, countryCode: 'KG' },
  'tulpar kul': { label: 'Tulpar Kul, Kyrgyzstan', lat: 39.625, lng: 72.934, countryCode: 'KG' },
  'tulpar lake': { label: 'Tulpar Kul, Kyrgyzstan', lat: 39.625, lng: 72.934, countryCode: 'KG' },
  'sary mogul': { label: 'Sary-Mogul, Kyrgyzstan', lat: 39.675, lng: 72.883, countryCode: 'KG' },
  bishkek: { label: 'Bishkek, Kyrgyzstan', lat: 42.8746, lng: 74.5698, countryCode: 'KG' },
  osh: { label: 'Osh, Kyrgyzstan', lat: 40.5283, lng: 72.7985, countryCode: 'KG' },
  'ala archa': { label: 'Ala-Archa National Park, Kyrgyzstan', lat: 42.559, lng: 74.486, countryCode: 'KG' },
  burana: { label: 'Burana Tower, Kyrgyzstan', lat: 42.746, lng: 75.25, countryCode: 'KG' },
  kordoi: { label: 'Dordoi Bazaar, Bishkek, Kyrgyzstan', lat: 42.939, lng: 74.622, countryCode: 'KG' },
  dordoi: { label: 'Dordoi Bazaar, Bishkek, Kyrgyzstan', lat: 42.939, lng: 74.622, countryCode: 'KG' },
  naryn: { label: 'Naryn, Kyrgyzstan', lat: 41.4287, lng: 75.9911, countryCode: 'KG' },
  'kok kiya': { label: 'Kok-Kiya Valley, Kyrgyzstan', lat: 40.698, lng: 76.718, countryCode: 'KG' },
  'kel suu': { label: 'Kel-Suu Lake, Kyrgyzstan', lat: 40.615, lng: 76.43, countryCode: 'KG' },
  'tash rabat': { label: 'Tash Rabat, Kyrgyzstan', lat: 40.822, lng: 75.287, countryCode: 'KG' },
  'song kol': { label: 'Song-Kol Lake, Kyrgyzstan', lat: 41.84, lng: 75.15, countryCode: 'KG' },
  'song kul': { label: 'Song-Kol Lake, Kyrgyzstan', lat: 41.84, lng: 75.15, countryCode: 'KG' },
  bokonbayevo: { label: 'Bokonbayevo, Kyrgyzstan', lat: 42.116, lng: 76.994, countryCode: 'KG' },
  skazka: { label: 'Skazka Canyon, Kyrgyzstan', lat: 42.174, lng: 77.354, countryCode: 'KG' },
  'jeti oguz': { label: 'Jeti-Oguz, Kyrgyzstan', lat: 42.337, lng: 78.236, countryCode: 'KG' },
  'kok jaiyk': { label: 'Kok-Jaiyk Valley, Kyrgyzstan', lat: 42.306, lng: 78.381, countryCode: 'KG' },
  barskoon: { label: 'Barskoon Valley, Kyrgyzstan', lat: 42.155, lng: 77.629, countryCode: 'KG' },
  karakol: { label: 'Karakol, Kyrgyzstan', lat: 42.49, lng: 78.393, countryCode: 'KG' },
  enilchek: { label: 'Enilchek, Kyrgyzstan', lat: 42.175, lng: 79.56, countryCode: 'KG' },
  jyrgalan: { label: 'Jyrgalan, Kyrgyzstan', lat: 42.607, lng: 79.013, countryCode: 'KG' },
  'ala kul': { label: 'Ala-Kul Lake, Kyrgyzstan', lat: 42.334, lng: 78.535, countryCode: 'KG' },
  'altyn arashan': { label: 'Altyn Arashan, Kyrgyzstan', lat: 42.441, lng: 78.526, countryCode: 'KG' },
  karakul: { label: 'Karakul, Tajikistan', lat: 39.017, lng: 73.56, countryCode: 'TJ' },
  'ak baital': { label: 'Ak-Baital Pass, Tajikistan', lat: 38.536, lng: 73.589, countryCode: 'TJ' },
}

function importErrorMessage(error: unknown): string {
  const message = errorMessage(error)
  if (/failed to fetch/i.test(message)) {
    return 'Import could not reach one of its services. Check the Vercel environment variables for Supabase and TomTom, then try again.'
  }
  if (/country_code/i.test(message)) {
    return 'Your Supabase database is missing the items.country_code column. Run the latest migration, then retry the import.'
  }
  if (/schema cache|column|relationship|table|visibility|member_limit/i.test(message)) {
    return `${message} Run the latest Supabase migrations, then retry the import.`
  }
  return message
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    for (const key of ['message', 'details', 'hint', 'code']) {
      if (typeof record[key] === 'string' && record[key]) return record[key]
    }
  }
  if (typeof error === 'string' && error) return error
  return 'Import failed.'
}

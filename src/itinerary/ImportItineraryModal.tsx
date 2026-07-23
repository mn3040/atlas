import { useState } from 'react'
import { FileUp, Loader2, Star, Trash2 } from 'lucide-react'
import { createDay, createItem } from '../api/trips'
import type { NewItemInput } from '../api/trips'
import { googleMapsSearchUrl, searchPlaces } from '../api/geocoding'
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
      const knownDays = [...days]
      const createdItems: Item[] = []
      const mustSeeCreatedIds: string[] = []

      for (const [index, suggestion] of selected.entries()) {
        const dayId = await ensureDayFor(suggestion.startDate, trip.id, knownDays, onDayCreated)
        const primary = await resolveLocation(suggestion.locationLabel || suggestion.name)
        const secondary =
          suggestion.type === 'flight' && suggestion.location2Label
            ? await resolveLocation(suggestion.location2Label)
            : null

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
          lat2: secondary?.lat ?? null,
          lng2: secondary?.lng ?? null,
          location2Label: secondary?.label ?? null,
          startDate: suggestion.startDate,
          endDate: suggestion.type === 'stay' ? suggestion.endDate || trip.endDate : null,
          startTime: suggestion.startTime || null,
          endTime: suggestion.endTime || null,
          flightNumber: suggestion.type === 'flight' ? suggestion.flightNumber || null : null,
          priceLabel: null,
          photoUrl: null,
          googleMapsUrl: googleMapsSearchUrl([suggestion.name, primary.label].filter(Boolean).join(', ')),
          confirmationNumber: suggestion.type === 'stay' ? suggestion.confirmationNumber || null : null,
          position: itemCount + index,
        }

        const created = await createItem(input)
        createdItems.push(created)
        if (suggestion.mustSee) mustSeeCreatedIds.push(created.id)
      }

      onItemsCreated(createdItems)
      onMustSeeCreated(mustSeeCreatedIds)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
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
          <div className="max-h-[52vh] overflow-auto border border-border">
            <table className="w-full min-w-[920px] border-collapse text-left text-xs">
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
                      <input value={item.name} onChange={(event) => updateSuggestion(item.id, { name: event.target.value })} className={inputClass} />
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
                        value={item.startDate}
                        onChange={(event) => updateSuggestion(item.id, { startDate: event.target.value })}
                        className={inputClass}
                      />
                      {item.type === 'stay' && (
                        <input
                          type="date"
                          min={item.startDate}
                          max={trip.endDate}
                          value={item.endDate}
                          onChange={(event) => updateSuggestion(item.id, { endDate: event.target.value })}
                          className={`${inputClass} mt-1`}
                        />
                      )}
                    </td>
                    <td className="p-2">
                      <input type="time" value={item.startTime} onChange={(event) => updateSuggestion(item.id, { startTime: event.target.value })} className={inputClass} />
                      <input type="time" value={item.endTime} onChange={(event) => updateSuggestion(item.id, { endTime: event.target.value })} className={`${inputClass} mt-1`} />
                    </td>
                    <td className="p-2">
                      <input
                        value={item.locationLabel}
                        onChange={(event) => updateSuggestion(item.id, { locationLabel: event.target.value })}
                        placeholder="Place or address"
                        className={inputClass}
                      />
                      {item.type === 'flight' && (
                        <input
                          value={item.location2Label}
                          onChange={(event) => updateSuggestion(item.id, { location2Label: event.target.value })}
                          placeholder="Arrival"
                          className={`${inputClass} mt-1`}
                        />
                      )}
                    </td>
                    <td className="p-2">
                      {item.type === 'flight' && (
                        <input
                          value={item.flightNumber}
                          onChange={(event) => updateSuggestion(item.id, { flightNumber: event.target.value })}
                          placeholder="Flight number"
                          className={inputClass}
                        />
                      )}
                      {item.type === 'stay' && (
                        <input
                          value={item.confirmationNumber}
                          onChange={(event) => updateSuggestion(item.id, { confirmationNumber: event.target.value })}
                          placeholder="Confirmation"
                          className={inputClass}
                        />
                      )}
                      <textarea
                        value={item.notes}
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

async function resolveLocation(query: string): Promise<{ label: string; lat: number; lng: number }> {
  const fallback = query.trim() || 'Location'
  const results = await searchPlaces(fallback)
  const match = results[0]
  if (match) return { label: match.label, lat: match.lat, lng: match.lng }
  return { label: fallback, lat: 0, lng: 0 }
}

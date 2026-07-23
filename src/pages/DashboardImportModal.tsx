import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, Loader2, Trash2, X } from 'lucide-react'
import { createDay, createTrip } from '../api/trips'
import { setItemMustSeeVote } from '../api/votes'
import { importSuggestionsToTrip } from '../itinerary/ImportItineraryModal'
import { extractItineraryItems, extractTextFromFile } from '../utils/importItinerary'
import { saveMustSeeIds } from '../utils/mustSee'
import type { ExtractedItineraryItem } from '../utils/importItinerary'
import type { Day, Trip, TripVisibility } from '../types/trip'

const inputClass =
  'min-h-11 w-full rounded-md border border-border bg-ink px-3 py-2 text-base text-text placeholder:text-text-dim focus:border-paper focus:outline-none sm:text-sm'

export function DashboardImportModal({
  ownerId,
  onClose,
}: {
  ownerId: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [fileName, setFileName] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [visibility, setVisibility] = useState<TripVisibility>('personal')
  const [memberLimit, setMemberLimit] = useState('4')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [suggestions, setSuggestions] = useState<ExtractedItineraryItem[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selectedCount = suggestions.filter((item) => item.selected).length
  const importHealth = useMemo(() => summarizeImportHealth(suggestions), [suggestions])
  const dayCount = useMemo(() => (startDate && endDate ? daysBetween(startDate, endDate).length : 0), [endDate, startDate])

  async function handleFile(file: File) {
    setBusy(true)
    setError('')
    setStatus('Reading document...')
    setFileName(file.name)
    try {
      const text = await extractTextFromFile(file)
      const draft = inferTripDraft(text, file.name)
      setName(draft.name)
      setDescription(draft.description)
      setCountryCode(draft.countryCode)
      setStartDate(draft.startDate)
      setEndDate(draft.endDate)

      const draftTrip = tripDraft({ ownerId, ...draft })
      const extracted = extractItineraryItems(text, draftTrip)
      setSuggestions(extracted)
      setStatus(extracted.length ? `${extracted.length} itinerary details found.` : 'No itinerary details found yet.')
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

  async function createImportedTrip() {
    const selected = suggestions.filter((item) => item.selected)
    if (!name.trim() || !startDate || !endDate) {
      setError('Add a trip name plus start and end dates.')
      return
    }
    if (selected.length === 0) {
      setError('Select at least one itinerary detail to import.')
      return
    }

    setBusy(true)
    setError('')
    setStatus('Creating trip...')
    try {
      const trip = await createTrip({
        ownerId,
        name,
        description,
        countryCode,
        visibility,
        memberLimit: visibility === 'group' ? normalizeMemberLimit(memberLimit) : null,
        startDate,
        endDate,
      })
      const days: Day[] = []
      for (const [index, date] of daysBetween(startDate, endDate).entries()) {
        days.push(await createDay(trip.id, date, `Day ${index + 1}`))
      }
      const { mustSeeCreatedIds } = await importSuggestionsToTrip({
        trip,
        days,
        itemCount: 0,
        suggestions: selected,
        onDayCreated: (day) => days.push(day),
        onStatus: setStatus,
      })
      if (visibility === 'group') {
        await Promise.all(
          mustSeeCreatedIds.map((itemId) =>
            setItemMustSeeVote({ tripId: trip.id, itemId, userId: ownerId, active: true }).catch((error) => {
              console.warn('Atlas could not preserve imported group votes', error)
            }),
          ),
        )
      } else {
        saveMustSeeIds(trip.id, new Set(mustSeeCreatedIds))
      }
      navigate(`/trips/${trip.id}`)
    } catch (err) {
      setError(importErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-3 py-4 sm:px-4 sm:py-8">
      <section className="max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-2xl sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-green">Create from document</p>
            <h2 className="text-xl font-extrabold text-text">Import a new trip</h2>
            {fileName && <p className="mt-1 text-xs text-text-dim">{fileName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-text"
            aria-label="Close import"
          >
            <X size={16} />
          </button>
        </div>

        <label className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center hover:border-paper">
          {busy ? <Loader2 size={24} className="animate-spin text-paper" /> : <FileUp size={24} className="text-paper" />}
          <span className="text-sm font-bold text-text">Upload PDF, DOCX, TXT, or Markdown</span>
          <span className="text-xs text-text-dim">Atlas will infer the trip and let you review before creating it.</span>
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

        {suggestions.length > 0 && (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-border bg-ink p-3 sm:grid-cols-[1fr_7rem]">
              <label className="block min-w-0">
                <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Trip name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </label>
              <label className="block min-w-0">
                <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Country</span>
                <input
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.slice(0, 2).toUpperCase())}
                  className={`${inputClass} uppercase`}
                />
              </label>
              <label className="block min-w-0 sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Description</span>
                <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
              </label>
              <label className="block min-w-0">
                <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Start</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
              </label>
              <label className="block min-w-0">
                <span className="text-xs font-bold uppercase tracking-wide text-text-dim">End</span>
                <input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
              </label>
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Trip mode</span>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setVisibility('personal')} className={modeClass(visibility === 'personal')}>
                    Personal
                  </button>
                  <button type="button" onClick={() => setVisibility('group')} className={modeClass(visibility === 'group')}>
                    Group
                  </button>
                </div>
              </div>
              <label className="block min-w-0">
                <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Travelers</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  inputMode="numeric"
                  disabled={visibility !== 'group'}
                  value={memberLimit}
                  onChange={(e) => setMemberLimit(e.target.value)}
                  onBlur={() => setMemberLimit((value) => normalizeMemberLimit(value)?.toString() ?? '1')}
                  className={`${inputClass} disabled:opacity-45`}
                />
              </label>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-text-dim">
              <span>
                {selectedCount} selected / {suggestions.length} found
              </span>
              <span>{dayCount} day itinerary</span>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2">
              <ImportMetric label="Ready" value={importHealth.ready} tone="green" />
              <ImportMetric label="Needs location" value={importHealth.missingLocation} tone="paper" />
              <ImportMetric label="Needs date" value={importHealth.missingDate} tone="line-4" />
            </div>

            <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-border">
              {suggestions.map((item) => (
                <article key={item.id} className="grid grid-cols-[auto_1fr_auto] gap-3 border-b border-border p-3 last:border-b-0">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(event) => updateSuggestion(item.id, { selected: event.target.checked })}
                    className="mt-1"
                    aria-label={`Import ${item.name}`}
                  />
                  <div className="min-w-0">
                    <input
                      value={item.name ?? ''}
                      onChange={(event) => updateSuggestion(item.id, { name: event.target.value })}
                      className="w-full bg-transparent text-sm font-extrabold text-text outline-none"
                    />
                    <p className="mt-1 text-xs text-text-dim">
                      {item.type ?? 'activity'} / {item.startDate || 'Needs date'}
                      {item.startTime ? ` / ${item.startTime}` : ''}
                    </p>
                    <input
                      value={item.locationLabel ?? ''}
                      onChange={(event) => updateSuggestion(item.id, { locationLabel: event.target.value })}
                      className="mt-2 w-full rounded-md border border-border bg-ink px-2 py-1.5 text-xs text-text"
                      placeholder="Location"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuggestions((current) => current.filter((candidate) => candidate.id !== item.id))}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-line-4"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </article>
              ))}
            </div>
          </>
        )}

        {status && <p className="mt-3 text-sm font-semibold text-text-dim">{status}</p>}
        {error && <p className="mt-3 rounded-md border border-line-4/40 bg-line-4/10 px-3 py-2 text-sm font-semibold text-line-4">{error}</p>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-11 rounded-md px-4 text-sm font-bold text-text-dim hover:text-text">
            Cancel
          </button>
          <button
            type="button"
            onClick={createImportedTrip}
            disabled={busy || selectedCount === 0}
            className="min-h-11 rounded-md bg-paper px-4 text-sm font-extrabold text-ink hover:bg-paper-dim disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Create trip from import'}
          </button>
        </div>
      </section>
    </div>
  )
}

function inferTripDraft(text: string, fileName: string) {
  const dates = datesFromText(text)
  const startDate = dates[0] ?? new Date().toISOString().slice(0, 10)
  const endDate = dates.at(-1) ?? startDate
  const countryCode = inferCountryCode(text)
  const name = inferTripName(text, fileName, countryCode)
  return {
    name,
    description: `${dates.length || 1}-day itinerary imported from ${fileName}.`,
    countryCode,
    startDate,
    endDate,
  }
}

function tripDraft(input: ReturnType<typeof inferTripDraft> & { ownerId: string }): Trip {
  return {
    id: 'draft',
    ownerId: input.ownerId,
    name: input.name,
    description: input.description,
    countryCode: input.countryCode,
    visibility: 'personal',
    memberLimit: null,
    archivedAt: null,
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: new Date().toISOString(),
  }
}

function inferTripName(text: string, fileName: string, countryCode: string): string {
  const firstUsefulLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /\bitinerary\b|\btrip\b/i.test(line) && line.length < 90)
  if (firstUsefulLine) return firstUsefulLine.replace(/\s+/g, ' ')
  const countryName = { KG: 'Kyrgyzstan', JP: 'Japan', IS: 'Iceland', MX: 'Mexico', KZ: 'Kazakhstan', TR: 'Turkey', TJ: 'Tajikistan' }[countryCode]
  return countryName ? `${countryName} Trip` : fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
}

function inferCountryCode(text: string): string {
  const lower = text.toLowerCase()
  if (/\bkyrgyz|bishkek|osh|karakol|issyk|naryn|song kol|kel suu|ala-kul/.test(lower)) return 'KG'
  if (/\bjapan|tokyo|kyoto|osaka|narita/.test(lower)) return 'JP'
  if (/\biceland|reykjavik|keflavik|gullfoss|vik\b/.test(lower)) return 'IS'
  if (/\bmexico city|coyoacan|xochimilco|chapultepec/.test(lower)) return 'MX'
  if (/\bkazakhstan|almaty|astana/.test(lower)) return 'KZ'
  if (/\bturkey|istanbul|cappadocia/.test(lower)) return 'TR'
  if (/\btajik|dushanbe|karakul/.test(lower)) return 'TJ'
  return ''
}

function datesFromText(text: string): string[] {
  const baseYear = new Date().getFullYear()
  const dates = new Set<string>()
  for (const match of text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    const year = match[3] ? normalizeYear(match[3]) : baseYear
    dates.add(isoDate(year, Number(match[1]), Number(match[2])))
  }
  return [...dates].sort()
}

function normalizeYear(value: string): number {
  const year = Number(value)
  return year < 100 ? 2000 + year : year
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function daysBetween(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || endDate < startDate) return []
  const days: string[] = []
  for (const cursor = new Date(`${startDate}T00:00:00`); cursor <= new Date(`${endDate}T00:00:00`); cursor.setDate(cursor.getDate() + 1)) {
    days.push(cursor.toISOString().slice(0, 10))
  }
  return days
}

function normalizeMemberLimit(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.min(99, Math.max(1, Math.round(parsed)))
}

function modeClass(active: boolean): string {
  return `min-h-11 rounded-md border px-3 text-sm font-bold ${
    active ? 'border-green bg-green/15 text-green' : 'border-border bg-surface text-text-dim'
  }`
}

function importErrorMessage(error: unknown): string {
  const message = errorMessage(error)
  if (/failed to fetch/i.test(message)) return 'Import could not reach Supabase or TomTom. Check Vercel environment variables, then retry.'
  if (/schema cache|column|relationship|table|item_votes|country_code|visibility|member_limit/i.test(message)) {
    return `${message} Run the latest Supabase migrations, then try again.`
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

function summarizeImportHealth(suggestions: ExtractedItineraryItem[]) {
  return suggestions.reduce(
    (summary, item) => {
      const missingName = !item.name?.trim()
      const missingDate = !item.startDate?.trim()
      const missingLocation = item.type !== 'flight' && !item.locationLabel?.trim()
      if (missingDate) summary.missingDate += 1
      if (missingLocation) summary.missingLocation += 1
      if (!missingName && !missingDate && !missingLocation) summary.ready += 1
      return summary
    },
    { ready: 0, missingLocation: 0, missingDate: 0 },
  )
}

function ImportMetric({ label, value, tone }: { label: string; value: number; tone: 'green' | 'paper' | 'line-4' }) {
  const color = tone === 'green' ? 'var(--color-green)' : tone === 'paper' ? 'var(--color-paper)' : 'var(--color-line-4)'
  return (
    <div className="rounded-md border border-border bg-ink px-3 py-2">
      <p className="text-lg font-extrabold" style={{ color }}>
        {value}
      </p>
      <p className="text-[9px] font-bold uppercase tracking-wide text-text-dim">{label}</p>
    </div>
  )
}

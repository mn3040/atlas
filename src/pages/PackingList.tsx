import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Backpack, Plus, Sparkles, Trash2 } from 'lucide-react'
import { fetchTrip, fetchItems } from '../api/trips'
import { fetchTripMembers } from '../api/groupTrips'
import { fetchWeatherForPoint } from '../api/weather'
import {
  createPackingItem,
  createPackingItems,
  deletePackingItem,
  fetchPackingItems,
  isMissingPackingTable,
  setPackingItemPacked,
} from '../api/packing'
import { TopNav } from '../components/TopNav'
import { TripSubNav } from '../components/TripSubNav'
import { useSession } from '../hooks/useSession'
import { suggestPackingItems } from '../utils/packingSuggestions'
import type { Item, PackingCategory, PackingItem, Trip } from '../types/trip'

const PACKING_CATEGORIES: { id: PackingCategory; label: string }[] = [
  { id: 'clothing', label: 'Clothing' },
  { id: 'documents', label: 'Documents' },
  { id: 'toiletries', label: 'Toiletries' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'gear', label: 'Gear' },
  { id: 'other', label: 'Other' },
]

const inputClass =
  'min-h-11 w-full rounded-md border border-border bg-ink px-3 py-2 text-base text-text placeholder:text-text-dim focus:border-paper focus:outline-none sm:text-sm'

function categoryLabel(category: PackingCategory): string {
  return PACKING_CATEGORIES.find((entry) => entry.id === category)?.label ?? 'Other'
}

export default function PackingList() {
  const { tripId } = useParams<{ tripId: string }>()
  const { session } = useSession()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [packingItems, setPackingItems] = useState<PackingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    if (!tripId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      setNeedsMigration(false)
      try {
        const [tripData, memberData, itemData] = await Promise.all([
          fetchTrip(tripId!),
          fetchTripMembers(tripId!),
          fetchItems(tripId!),
        ])
        if (cancelled) return
        setTrip(tripData)
        setItems(itemData)
        const viewerRole = memberData.find((member) => member.userId === session?.user.id)?.role ?? 'viewer'
        setCanEdit(viewerRole === 'owner' || viewerRole === 'editor')
        try {
          setPackingItems(await fetchPackingItems(tripId!))
        } catch (err) {
          if (isMissingPackingTable(err)) setNeedsMigration(true)
          else throw err
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load this trip.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [tripId, session?.user.id])

  async function refreshPackingItems() {
    if (!tripId) return
    setPackingItems(await fetchPackingItems(tripId))
  }

  async function handleSuggest() {
    if (!tripId || !session || !trip) return
    setSuggesting(true)
    setActionError(null)
    try {
      const referenceItem = items.find((item) => item.lat !== 0 || item.lng !== 0) ?? items[0]
      let weather = null
      if (referenceItem) {
        try {
          weather = await fetchWeatherForPoint({ lat: referenceItem.lat, lng: referenceItem.lng, date: trip.startDate })
        } catch {
          weather = null
        }
      }
      const suggestions = suggestPackingItems({ trip, items, weather })
      const existingLabels = new Set(packingItems.map((item) => item.label.toLowerCase()))
      const newSuggestions = suggestions.filter((entry) => !existingLabels.has(entry.label.toLowerCase()))
      if (newSuggestions.length > 0) {
        await createPackingItems(tripId, session.user.id, newSuggestions)
        await refreshPackingItems()
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not generate suggestions.')
    } finally {
      setSuggesting(false)
    }
  }

  async function handleAdd(label: string, category: PackingCategory) {
    if (!tripId || !session) return
    await createPackingItem(tripId, session.user.id, { label, category })
    setFormOpen(false)
    await refreshPackingItems()
  }

  async function handleTogglePacked(item: PackingItem) {
    setPackingItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, packed: !entry.packed } : entry)))
    try {
      await setPackingItemPacked(item.id, !item.packed)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update this item.')
      await refreshPackingItems()
    }
  }

  async function handleDelete(item: PackingItem) {
    setPackingItems((current) => current.filter((entry) => entry.id !== item.id))
    try {
      await deletePackingItem(item.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not remove this item.')
      await refreshPackingItems()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ink">
        <TopNav />
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-7">
          <div className="mb-3 h-3 w-24 animate-pulse rounded-full bg-surface-3" />
          <div className="mb-5 h-6 w-40 animate-pulse rounded-full bg-surface-3" />
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-md border border-border bg-surface" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (loadError || !trip || !tripId) {
    return (
      <div className="min-h-screen bg-ink">
        <TopNav />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-text-dim">
          {loadError ?? 'Trip not found.'}
        </div>
      </div>
    )
  }

  const packedCount = packingItems.filter((item) => item.packed).length
  const progress = packingItems.length > 0 ? Math.round((packedCount / packingItems.length) * 100) : 0
  const grouped = PACKING_CATEGORIES.map((entry) => ({
    ...entry,
    items: packingItems.filter((item) => item.category === entry.id),
  })).filter((entry) => entry.items.length > 0)

  return (
    <div className="min-h-screen bg-ink">
      <TopNav subtitle={`${trip.name} · Packing`} />
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-7">
        <Link to={`/trips/${tripId}`} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-text-dim hover:text-text">
          <Backpack size={14} /> {trip.name}
        </Link>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-3xs font-bold uppercase tracking-[0.24em] text-green">Packing list</p>
            <h1 className="font-display text-xl font-extrabold text-text">{trip.name}</h1>
          </div>
          <TripSubNav tripId={tripId} />
        </div>

        {needsMigration && (
          <p className="atlas-reveal mb-5 rounded-md border border-paper/40 bg-paper/10 px-3 py-2 text-xs font-semibold text-paper">
            Run the latest Supabase migration (add_packing_items.sql) to enable the packing list.
          </p>
        )}

        {actionError && <p className="mb-4 text-xs font-semibold text-line-4">{actionError}</p>}

        {!needsMigration && (
          <>
            <section className="atlas-reveal mb-5 rounded-lg border border-border bg-surface p-4 sm:p-5">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="mb-1 text-3xs font-bold uppercase tracking-[0.24em] text-text-dimmer">Packed</p>
                  <p className="font-mono text-3xl font-extrabold text-text">
                    {packedCount}
                    <span className="text-lg text-text-dimmer"> / {packingItems.length}</span>
                  </p>
                </div>
                <Backpack size={28} className="text-text-dimmer" />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink">
                <div className="h-full rounded-full bg-green transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            </section>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-3xs font-bold uppercase tracking-[0.24em] text-text-dimmer">
                {packingItems.length} item{packingItems.length === 1 ? '' : 's'}
              </p>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSuggest}
                    disabled={suggesting}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-bold text-text-dim hover:text-text disabled:cursor-wait disabled:opacity-60"
                  >
                    <Sparkles size={14} /> {suggesting ? 'Suggesting...' : 'Suggest items'}
                  </button>
                  {!formOpen && (
                    <button
                      type="button"
                      onClick={() => setFormOpen(true)}
                      className="flex items-center gap-1.5 rounded-md bg-paper px-3 py-1.5 text-xs font-bold text-ink hover:bg-paper-dim"
                    >
                      <Plus size={14} /> Add item
                    </button>
                  )}
                </div>
              )}
            </div>

            {formOpen && (
              <PackingItemForm
                onCancel={() => setFormOpen(false)}
                onSave={handleAdd}
              />
            )}

            {packingItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center text-text-dim">
                <Backpack size={22} className="text-text-dimmer" />
                <p className="text-xs">
                  Nothing on the list yet. {canEdit ? 'Add an item, or let Atlas suggest a starting list.' : 'Check back once someone adds items.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {grouped.map((group) => (
                  <div key={group.id}>
                    <p className="mb-2 text-3xs font-bold uppercase tracking-wide text-text-dimmer">{group.label}</p>
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3.5 py-2.5"
                        >
                          <label className="flex min-w-0 flex-1 items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={item.packed}
                              onChange={() => handleTogglePacked(item)}
                              className="h-4 w-4 shrink-0 accent-green"
                            />
                            <span className={`truncate text-sm font-semibold ${item.packed ? 'text-text-dimmer line-through' : 'text-text'}`}>
                              {item.label}
                            </span>
                          </label>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              aria-label={`Remove ${item.label}`}
                              className="shrink-0 text-text-dim hover:text-line-4"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PackingItemForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void
  onSave: (label: string, category: PackingCategory) => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<PackingCategory>('other')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!label.trim()) {
      setError('Give this item a name.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSave(label.trim(), category)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this item.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="atlas-reveal mb-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">Item</span>
          <input value={label} onChange={(event) => setLabel(event.target.value)} className={inputClass} placeholder="Rain jacket" autoFocus />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as PackingCategory)} className={inputClass}>
            {PACKING_CATEGORIES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {categoryLabel(entry.id)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-line-4">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-3.5 py-2 text-xs font-bold text-text-dim hover:text-text">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-paper px-4 py-2 text-xs font-bold text-ink hover:bg-paper-dim disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? 'Saving...' : 'Add item'}
        </button>
      </div>
    </form>
  )
}

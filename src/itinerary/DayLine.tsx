import { useState } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { StopStation } from './StopStation'
import type { Day, Stop, StopCategory } from '../types/trip'

const CATEGORY_OPTIONS: StopCategory[] = [
  'attraction',
  'food',
  'lodging',
  'transport',
  'shopping',
  'nature',
  'other',
]

export function DayLine({
  day,
  stops,
  color,
  dayNumber,
  onReorder,
  onAddStop,
}: {
  day: Day
  stops: Stop[]
  color: string
  dayNumber: number
  onReorder: (dayId: string, orderedStopIds: string[]) => void
  onAddStop: (dayId: string, input: { name: string; category: StopCategory; lat: number; lng: number; startTime: string | null }) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const stopIds = stops.map((s) => s.id)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = stopIds.indexOf(String(active.id))
    const newIndex = stopIds.indexOf(String(over.id))
    onReorder(day.id, arrayMove(stopIds, oldIndex, newIndex))
  }

  const date = new Date(`${day.date}T00:00:00`)
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()

  return (
    <section className="mt-8 first:mt-0">
      <div className="flex items-baseline gap-3">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <h2 className="font-display text-2xl font-medium tracking-tight text-text">
          Day {dayNumber}
        </h2>
        <span className="font-mono text-xs uppercase tracking-wide text-text-dim">{label}</span>
      </div>

      {stops.length === 0 ? (
        <p className="mt-2 pl-8 text-sm text-text-dim">No stops yet.</p>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stopIds} strategy={verticalListSortingStrategy}>
            <div>
              {stops.map((stop) => (
                <StopStation key={stop.id} stop={stop} color={color} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        onClick={() => setShowForm((v) => !v)}
        className="mt-2 pl-8 text-sm text-text-dim hover:text-line-2"
      >
        {showForm ? 'Cancel' : '+ Add stop'}
      </button>

      {showForm && (
        <AddStopForm
          onSubmit={(input) => {
            onAddStop(day.id, input)
            setShowForm(false)
          }}
        />
      )}
    </section>
  )
}

function AddStopForm({
  onSubmit,
}: {
  onSubmit: (input: { name: string; category: StopCategory; lat: number; lng: number; startTime: string | null }) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<StopCategory>('attraction')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [startTime, setStartTime] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onSubmit({
      name,
      category,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      startTime: startTime || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 ml-8 space-y-2 rounded-md border border-border bg-surface p-4">
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Stop name"
        className="w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-line-2 focus:outline-none"
      />
      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as StopCategory)}
          className="rounded-md border border-border bg-ink px-3 py-2 text-sm text-text focus:border-line-2 focus:outline-none"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="rounded-md border border-border bg-ink px-3 py-2 text-sm text-text focus:border-line-2 focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <input
          required
          type="number"
          step="any"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="Latitude"
          className="w-1/2 rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-line-2 focus:outline-none"
        />
        <input
          required
          type="number"
          step="any"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="Longitude"
          className="w-1/2 rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-line-2 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="rounded-md bg-line-2 px-3 py-1.5 text-sm font-medium text-ink hover:opacity-90"
      >
        Add stop
      </button>
    </form>
  )
}

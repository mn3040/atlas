export type DayOptionView = 'all' | 'must-see' | 'flexible'

const PREFIX = 'atlas:must-see:'

export function loadMustSeeIds(tripId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${tripId}`)
    const ids = raw ? (JSON.parse(raw) as string[]) : []
    return new Set(ids)
  } catch {
    return new Set()
  }
}

export function saveMustSeeIds(tripId: string, ids: Set<string>): void {
  window.localStorage.setItem(`${PREFIX}${tripId}`, JSON.stringify([...ids]))
}

export function filterItemsForView<T extends { id: string }>(
  items: T[],
  mustSeeIds: Set<string>,
  view: DayOptionView,
): T[] {
  if (view === 'must-see') return items.filter((item) => mustSeeIds.has(item.id))
  if (view === 'flexible') return items.filter((item) => !mustSeeIds.has(item.id))
  return items
}

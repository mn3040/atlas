import type { Item } from '../types/trip'

const BRANCH_RE = /\[Branch:\s*([^\]]+)\]/i

export interface DayBranch {
  id: string
  label: string
  itemIds: string[]
  mustSeeCount: number
  voteCount: number
}

export function branchLabelForItem(item: Pick<Item, 'notes'>): string {
  return item.notes?.match(BRANCH_RE)?.[1]?.trim() ?? ''
}

export function stripImportTags(notes: string | null): string | null {
  if (!notes) return notes
  const clean = notes.replace(/\[(?:Branch|Import):[^\]]+\]\s*/gi, '').trim()
  return clean || null
}

export function branchesForItems(
  items: Item[],
  mustSeeIds: Set<string>,
  voteCounts: Record<string, number> = {},
): DayBranch[] {
  const branches = new Map<string, DayBranch>()

  for (const item of items) {
    const label = branchLabelForItem(item)
    if (!label) continue
    const id = slug(label)
    const branch = branches.get(id) ?? { id, label, itemIds: [], mustSeeCount: 0, voteCount: 0 }
    branch.itemIds.push(item.id)
    if (mustSeeIds.has(item.id)) branch.mustSeeCount += 1
    branch.voteCount += voteCounts[item.id] ?? 0
    branches.set(id, branch)
  }

  return [...branches.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export function filterItemsForBranch<T extends Item>(items: T[], branchId: string): T[] {
  if (!branchId || branchId === 'all') return items
  return items.filter((item) => {
    const label = branchLabelForItem(item)
    return !label || slug(label) === branchId
  })
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

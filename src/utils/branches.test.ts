import { describe, expect, it } from 'vitest'
import { branchesForItems, branchLabelForItem, filterItemsForBranch, stripImportTags } from './branches'
import type { Item } from '../types/trip'

function makeItem(overrides: Partial<Item> & { id: string }): Item {
  return {
    tripId: 'trip-1',
    dayId: null,
    type: 'activity',
    category: 'attraction',
    name: 'Test place',
    notes: null,
    lat: 0,
    lng: 0,
    locationLabel: null,
    countryCode: null,
    lat2: null,
    lng2: null,
    location2Label: null,
    startDate: '2026-01-01',
    endDate: null,
    startTime: null,
    endTime: null,
    flightNumber: null,
    priceLabel: null,
    photoUrl: null,
    googlePlaceId: null,
    googleMapsUrl: null,
    googleRating: null,
    googleUserRatingsTotal: null,
    roomType: null,
    guests: null,
    nightlyRate: null,
    taxesFees: null,
    confirmationNumber: null,
    rating: null,
    position: 0,
    ...overrides,
  }
}

describe('branchLabelForItem', () => {
  it('extracts a branch label from notes', () => {
    expect(branchLabelForItem({ notes: '[Branch: Plan A] Some notes here' })).toBe('Plan A')
  })

  it('is case-insensitive on the tag name', () => {
    expect(branchLabelForItem({ notes: '[branch: Plan B]' })).toBe('Plan B')
  })

  it('returns an empty string when there is no branch tag', () => {
    expect(branchLabelForItem({ notes: 'Just plain notes' })).toBe('')
    expect(branchLabelForItem({ notes: null })).toBe('')
  })

  it('trims whitespace inside the tag', () => {
    expect(branchLabelForItem({ notes: '[Branch:   Plan C  ]' })).toBe('Plan C')
  })
})

describe('stripImportTags', () => {
  it('returns null/empty input unchanged', () => {
    expect(stripImportTags(null)).toBeNull()
  })

  it('strips Branch and Import tags and trims', () => {
    expect(stripImportTags('[Branch: Plan A] [Import: pdf] Actual notes')).toBe('Actual notes')
  })

  it('returns null when stripping leaves nothing', () => {
    expect(stripImportTags('[Branch: Plan A]')).toBeNull()
    expect(stripImportTags('   ')).toBeNull()
  })

  it('leaves unrelated bracketed text alone', () => {
    expect(stripImportTags('[Note] keep this')).toBe('[Note] keep this')
  })
})

describe('branchesForItems', () => {
  it('groups items by branch label, ignoring items with no branch', () => {
    const items = [
      makeItem({ id: '1', notes: '[Branch: Plan A]' }),
      makeItem({ id: '2', notes: '[Branch: Plan A]' }),
      makeItem({ id: '3', notes: '[Branch: Plan B]' }),
      makeItem({ id: '4', notes: null }),
    ]
    const branches = branchesForItems(items, new Set())
    expect(branches).toHaveLength(2)
    const planA = branches.find((b) => b.label === 'Plan A')
    expect(planA?.itemIds).toEqual(['1', '2'])
  })

  it('sorts branches alphabetically by label', () => {
    const items = [
      makeItem({ id: '1', notes: '[Branch: Zeta]' }),
      makeItem({ id: '2', notes: '[Branch: Alpha]' }),
    ]
    const branches = branchesForItems(items, new Set())
    expect(branches.map((b) => b.label)).toEqual(['Alpha', 'Zeta'])
  })

  it('counts must-see items per branch', () => {
    const items = [
      makeItem({ id: '1', notes: '[Branch: Plan A]' }),
      makeItem({ id: '2', notes: '[Branch: Plan A]' }),
    ]
    const branches = branchesForItems(items, new Set(['1']))
    expect(branches[0].mustSeeCount).toBe(1)
  })

  it('sums vote counts per branch', () => {
    const items = [
      makeItem({ id: '1', notes: '[Branch: Plan A]' }),
      makeItem({ id: '2', notes: '[Branch: Plan A]' }),
    ]
    const branches = branchesForItems(items, new Set(), { '1': 3, '2': 2 })
    expect(branches[0].voteCount).toBe(5)
  })

  it('slugifies labels that collide after normalization into the same branch', () => {
    const items = [
      makeItem({ id: '1', notes: '[Branch: Plan A!]' }),
      makeItem({ id: '2', notes: '[Branch: Plan A?]' }),
    ]
    const branches = branchesForItems(items, new Set())
    // Both labels slugify to "plan-a" so they should merge into one branch entry.
    expect(branches).toHaveLength(1)
    expect(branches[0].itemIds).toEqual(['1', '2'])
  })
})

describe('filterItemsForBranch', () => {
  const items = [
    makeItem({ id: '1', notes: '[Branch: Plan A]' }),
    makeItem({ id: '2', notes: '[Branch: Plan B]' }),
    makeItem({ id: '3', notes: null }),
  ]

  it('returns all items when branchId is empty or "all"', () => {
    expect(filterItemsForBranch(items, '')).toEqual(items)
    expect(filterItemsForBranch(items, 'all')).toEqual(items)
  })

  it('keeps items with no branch label plus items matching the branch id', () => {
    const filtered = filterItemsForBranch(items, 'plan-a')
    expect(filtered.map((i) => i.id)).toEqual(['1', '3'])
  })

  it('excludes items belonging to other branches', () => {
    const filtered = filterItemsForBranch(items, 'plan-a')
    expect(filtered.some((i) => i.id === '2')).toBe(false)
  })
})

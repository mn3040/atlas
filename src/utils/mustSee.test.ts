import { beforeEach, describe, expect, it } from 'vitest'
import { filterItemsForView, loadMustSeeIds, saveMustSeeIds } from './mustSee'

beforeEach(() => {
  window.localStorage.clear()
})

describe('loadMustSeeIds', () => {
  it('returns an empty set when nothing is stored', () => {
    expect(loadMustSeeIds('trip-1')).toEqual(new Set())
  })

  it('returns the previously saved ids for that trip', () => {
    saveMustSeeIds('trip-1', new Set(['a', 'b']))
    expect(loadMustSeeIds('trip-1')).toEqual(new Set(['a', 'b']))
  })

  it('keeps ids scoped per trip id', () => {
    saveMustSeeIds('trip-1', new Set(['a']))
    saveMustSeeIds('trip-2', new Set(['b']))
    expect(loadMustSeeIds('trip-1')).toEqual(new Set(['a']))
    expect(loadMustSeeIds('trip-2')).toEqual(new Set(['b']))
  })

  it('returns an empty set instead of throwing on corrupt stored JSON', () => {
    window.localStorage.setItem('atlas:must-see:trip-1', '{not valid json')
    expect(() => loadMustSeeIds('trip-1')).not.toThrow()
    expect(loadMustSeeIds('trip-1')).toEqual(new Set())
  })
})

describe('filterItemsForView', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const mustSeeIds = new Set(['a', 'c'])

  it('returns everything for the "all" view', () => {
    expect(filterItemsForView(items, mustSeeIds, 'all')).toEqual(items)
  })

  it('returns only must-see items for the "must-see" view', () => {
    expect(filterItemsForView(items, mustSeeIds, 'must-see').map((i) => i.id)).toEqual(['a', 'c'])
  })

  it('returns only non-must-see items for the "flexible" view', () => {
    expect(filterItemsForView(items, mustSeeIds, 'flexible').map((i) => i.id)).toEqual(['b'])
  })

  it('returns an empty array when nothing matches the requested view', () => {
    expect(filterItemsForView(items, new Set(), 'must-see')).toEqual([])
  })
})

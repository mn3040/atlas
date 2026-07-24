import { describe, expect, it } from 'vitest'
import { confidenceForImportItem, summarizeImportConfidence } from './importConfidence'
import type { ExtractedItineraryItem } from './importItinerary'

function makeItem(overrides: Partial<ExtractedItineraryItem> = {}): ExtractedItineraryItem {
  return {
    id: '1',
    selected: true,
    type: 'activity',
    category: 'attraction',
    name: 'Museum visit',
    startDate: '2026-01-01',
    endDate: '',
    startTime: '09:00',
    endTime: '',
    locationLabel: 'City Museum',
    location2Label: '',
    flightNumber: '',
    confirmationNumber: '',
    notes: '',
    mustSee: false,
    ...overrides,
  }
}

describe('confidenceForImportItem', () => {
  it('scores a fully-populated activity as Ready', () => {
    const confidence = confidenceForImportItem(makeItem())
    expect(confidence.score).toBe(100)
    expect(confidence.label).toBe('Ready')
    expect(confidence.tone).toBe('green')
    expect(confidence.reasons).toEqual([])
  })

  it('flags a missing name', () => {
    const confidence = confidenceForImportItem(makeItem({ name: '  ' }))
    expect(confidence.reasons).toContain('name')
    expect(confidence.score).toBe(75)
  })

  it('flags a missing date', () => {
    const confidence = confidenceForImportItem(makeItem({ startDate: '' }))
    expect(confidence.reasons).toContain('date')
  })

  it('flags a missing location for a non-flight item as "location"', () => {
    const confidence = confidenceForImportItem(makeItem({ locationLabel: '' }))
    expect(confidence.reasons).toContain('location')
  })

  it('flags a missing route for a flight as "route" instead of "location"', () => {
    const confidence = confidenceForImportItem(
      makeItem({ type: 'flight', locationLabel: 'JFK', location2Label: '' }),
    )
    expect(confidence.reasons).toContain('route')
    expect(confidence.reasons).not.toContain('location')
    expect(confidence.reasons).toContain('arrival')
  })

  it('does not require location2Label for non-flight items', () => {
    const confidence = confidenceForImportItem(makeItem({ type: 'activity', location2Label: '' }))
    expect(confidence.reasons).not.toContain('route')
  })

  it('flags a missing start time', () => {
    const confidence = confidenceForImportItem(makeItem({ startTime: '' }))
    expect(confidence.reasons).toContain('time')
    expect(confidence.score).toBe(85)
  })

  it('flags a stay item missing checkout date', () => {
    const confidence = confidenceForImportItem(makeItem({ type: 'stay', endDate: '' }))
    expect(confidence.reasons).toContain('checkout')
  })

  it('does not flag checkout for a stay item that has an end date', () => {
    const confidence = confidenceForImportItem(makeItem({ type: 'stay', endDate: '2026-01-03' }))
    expect(confidence.reasons).not.toContain('checkout')
  })

  it('labels a low-completeness item as "Needs fix"', () => {
    const confidence = confidenceForImportItem(
      makeItem({ name: '', startDate: '', locationLabel: '', startTime: '' }),
    )
    expect(confidence.label).toBe('Needs fix')
    expect(confidence.tone).toBe('line-4')
  })

  it('labels a mid-completeness item as "Review"', () => {
    // name(25) + date(25) + type(10) = 60, missing location and time => exactly at the Review boundary
    const confidence = confidenceForImportItem(makeItem({ locationLabel: '', startTime: '' }))
    expect(confidence.score).toBe(60)
    expect(confidence.label).toBe('Review')
    expect(confidence.tone).toBe('paper')
  })

  it('is exactly at the Ready boundary (85) for name+date+location+type but no time', () => {
    const confidence = confidenceForImportItem(makeItem({ startTime: '' }))
    expect(confidence.score).toBe(85)
    expect(confidence.label).toBe('Ready')
  })
})

describe('summarizeImportConfidence', () => {
  it('returns a zeroed-out summary for an empty list', () => {
    expect(summarizeImportConfidence([])).toEqual({
      average: 0,
      ready: 0,
      review: 0,
      needsFix: 0,
      missingDate: 0,
      missingLocation: 0,
      missingTime: 0,
      flightCount: 0,
      stayCount: 0,
      branchCount: 0,
    })
  })

  it('averages scores and buckets labels across items', () => {
    const items = [
      makeItem({ id: '1' }), // Ready, 100
      makeItem({ id: '2', startTime: '' }), // Ready, 85
      makeItem({ id: '3', name: '', locationLabel: '' }), // Needs fix
    ]
    const summary = summarizeImportConfidence(items)
    expect(summary.ready).toBe(2)
    expect(summary.needsFix).toBe(1)
    expect(summary.review).toBe(0)
  })

  it('counts missing fields independently of the score buckets', () => {
    const items = [
      makeItem({ id: '1', startDate: '' }),
      makeItem({ id: '2', locationLabel: '' }),
      makeItem({ id: '3', startTime: '' }),
    ]
    const summary = summarizeImportConfidence(items)
    expect(summary.missingDate).toBe(1)
    expect(summary.missingLocation).toBe(1)
    expect(summary.missingTime).toBe(1)
  })

  it('counts flights and stays by type', () => {
    const items = [
      makeItem({ id: '1', type: 'flight' }),
      makeItem({ id: '2', type: 'stay' }),
      makeItem({ id: '3', type: 'activity' }),
    ]
    const summary = summarizeImportConfidence(items)
    expect(summary.flightCount).toBe(1)
    expect(summary.stayCount).toBe(1)
  })

  it('counts distinct non-empty branch labels', () => {
    const items = [
      makeItem({ id: '1', branchLabel: 'Plan A' }),
      makeItem({ id: '2', branchLabel: 'Plan A' }),
      makeItem({ id: '3', branchLabel: 'Plan B' }),
      makeItem({ id: '4', branchLabel: undefined }),
    ]
    const summary = summarizeImportConfidence(items)
    expect(summary.branchCount).toBe(2)
  })
})

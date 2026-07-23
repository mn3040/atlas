import type { ExtractedItineraryItem } from './importItinerary'

export interface ImportConfidence {
  score: number
  label: 'Ready' | 'Review' | 'Needs fix'
  tone: 'green' | 'paper' | 'line-4'
  reasons: string[]
}

export interface ImportConfidenceSummary {
  average: number
  ready: number
  review: number
  needsFix: number
  missingDate: number
  missingLocation: number
  missingTime: number
  flightCount: number
  stayCount: number
  branchCount: number
}

export function confidenceForImportItem(item: ExtractedItineraryItem): ImportConfidence {
  let score = 0
  const reasons: string[] = []

  if (item.name.trim()) score += 25
  else reasons.push('name')

  if (item.startDate) score += 25
  else reasons.push('date')

  const hasPrimaryLocation = Boolean(item.locationLabel?.trim())
  const hasFlightArrival = item.type !== 'flight' || Boolean(item.location2Label?.trim())
  if (hasPrimaryLocation && hasFlightArrival) score += 25
  else reasons.push(item.type === 'flight' ? 'route' : 'location')

  if (item.startTime) score += 15
  else reasons.push('time')

  if (item.type && (item.type !== 'activity' || item.category)) score += 10
  if (item.type === 'flight' && !item.location2Label?.trim()) reasons.push('arrival')
  if (item.type === 'stay' && !item.endDate) reasons.push('checkout')

  const label = score >= 85 ? 'Ready' : score >= 60 ? 'Review' : 'Needs fix'
  return {
    score,
    label,
    tone: label === 'Ready' ? 'green' : label === 'Review' ? 'paper' : 'line-4',
    reasons,
  }
}

export function summarizeImportConfidence(items: ExtractedItineraryItem[]): ImportConfidenceSummary {
  if (items.length === 0) {
    return {
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
    }
  }

  const confidences = items.map(confidenceForImportItem)
  const branches = new Set(items.map((item) => item.branchLabel).filter(Boolean))
  return {
    average: Math.round(confidences.reduce((sum, confidence) => sum + confidence.score, 0) / confidences.length),
    ready: confidences.filter((confidence) => confidence.label === 'Ready').length,
    review: confidences.filter((confidence) => confidence.label === 'Review').length,
    needsFix: confidences.filter((confidence) => confidence.label === 'Needs fix').length,
    missingDate: items.filter((item) => !item.startDate).length,
    missingLocation: items.filter((item) => !item.locationLabel?.trim()).length,
    missingTime: items.filter((item) => !item.startTime).length,
    flightCount: items.filter((item) => item.type === 'flight').length,
    stayCount: items.filter((item) => item.type === 'stay').length,
    branchCount: branches.size,
  }
}

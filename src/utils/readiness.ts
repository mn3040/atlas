function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export interface ReadinessInputs {
  activeItemsTotal: number
  missingTimesCount: number
  itemsTotal: number
  missingLocationsCount: number
  groupVoting: boolean
  votedItemsCount: number
  packingItemsTotal: number
  packedCount: number
}

/** Scheduled stops, usable locations, group vote coverage, and packing
 * progress, averaged into one score. Shared by CommandTab and TripDashboard
 * so the two screens never drift on what "ready" means. */
export function computeReadiness(inputs: ReadinessInputs): number {
  return Math.round(
    average([
      inputs.activeItemsTotal ? (inputs.activeItemsTotal - inputs.missingTimesCount) / inputs.activeItemsTotal : 1,
      inputs.itemsTotal ? (inputs.itemsTotal - inputs.missingLocationsCount) / inputs.itemsTotal : 1,
      inputs.groupVoting && inputs.activeItemsTotal ? inputs.votedItemsCount / inputs.activeItemsTotal : 1,
      inputs.packingItemsTotal ? inputs.packedCount / inputs.packingItemsTotal : 1,
    ]) * 100,
  )
}

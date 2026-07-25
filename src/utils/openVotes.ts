import type { Day, Item, ItemDecision, ItemVoteSummary } from '../types/trip'

export interface OpenVoteDay {
  dayLabel: string
  topPick: { item: Item; votes: number }
}

/** For each day with votes but no locked decision yet, the current
 * front-runner. Shared by CommandTab (lists every open day) and
 * TripDashboard (surfaces just the first one). */
export function openVoteDaysForTrip(
  days: Day[],
  items: Item[],
  voteSummary: Record<string, ItemVoteSummary>,
  decisions: Record<string, ItemDecision>,
): OpenVoteDay[] {
  return days
    .map((day, index) => {
      const dayItems = items.filter((item) => item.dayId === day.id && item.type !== 'stay')
      const ranked = dayItems
        .map((item) => ({ item, votes: voteSummary[item.id]?.voters.length ?? 0 }))
        .filter((entry) => entry.votes > 0)
        .sort((a, b) => b.votes - a.votes)
      if (ranked.length === 0 || decisions[day.id]) return null
      return { dayLabel: day.label || `Day ${index + 1}`, topPick: ranked[0] }
    })
    .filter((entry): entry is OpenVoteDay => entry !== null)
}

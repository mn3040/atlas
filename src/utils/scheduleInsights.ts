import { estimateTravel, routeAvailability } from './distance'
import { formatTime } from './time'
import type { TravelMode } from './distance'
import type { Item } from '../types/trip'

export interface ScheduleInsight {
  id: string
  tone: 'warn' | 'info'
  title: string
  detail: string
  itemId: string
}

export function scheduleInsightsForItems(items: Item[], mode: TravelMode): ScheduleInsight[] {
  const activeItems = items
    .filter((item) => item.type !== 'stay')
    .sort((a, b) => a.position - b.position)
  const insights: ScheduleInsight[] = []

  for (let index = 0; index < activeItems.length - 1; index += 1) {
    const current = activeItems[index]
    const next = activeItems[index + 1]
    if (current.startDate !== next.startDate) continue

    const origin = onwardPoint(current)
    const destination = { lat: next.lat, lng: next.lng }
    const availability = routeAvailability(origin, destination, mode)
    const travel = estimateTravel(origin, destination, mode)

    if (!availability.available) {
      insights.push({
        id: `${current.id}-${next.id}-unavailable`,
        tone: 'warn',
        title: `${modeLabel(mode)} unavailable`,
        detail: `${current.name} to ${next.name}: ${availability.reason ?? 'Choose another route mode.'}`,
        itemId: next.id,
      })
      continue
    }

    const currentEnd = minutesFromTime(current.endTime) ?? minutesFromTime(current.startTime)
    const nextStart = minutesFromTime(next.startTime)
    if (currentEnd == null || nextStart == null) continue

    const gap = nextStart - currentEnd
    const needed = travel.minutes + 15
    if (gap < 0) {
      insights.push({
        id: `${current.id}-${next.id}-overlap`,
        tone: 'warn',
        title: 'Time overlap',
        detail: `${next.name} starts at ${formatTime(next.startTime)} before ${current.name} is finished.`,
        itemId: next.id,
      })
    } else if (gap < needed) {
      insights.push({
        id: `${current.id}-${next.id}-tight`,
        tone: 'warn',
        title: 'Tight transfer',
        detail: `${formatMinutes(gap)} available, but ${modeLabel(mode).toLowerCase()} looks closer to ${travel.duration} plus buffer.`,
        itemId: next.id,
      })
    } else if (travel.minutes >= 120) {
      insights.push({
        id: `${current.id}-${next.id}-long`,
        tone: 'info',
        title: 'Long transfer',
        detail: `${current.name} to ${next.name} is about ${travel.duration} by ${modeLabel(mode).toLowerCase()}.`,
        itemId: next.id,
      })
    }
  }

  return insights
}

function onwardPoint(item: Item) {
  if (item.type === 'flight' && item.lat2 != null && item.lng2 != null) return { lat: item.lat2, lng: item.lng2 }
  return { lat: item.lat, lng: item.lng }
}

function minutesFromTime(time: string | null): number | null {
  if (!time) return null
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function modeLabel(mode: TravelMode): string {
  return mode === 'walk' ? 'Walking' : mode === 'bike' ? 'Cycling' : mode === 'car' ? 'Car' : mode === 'train' ? 'Train' : 'Flight'
}

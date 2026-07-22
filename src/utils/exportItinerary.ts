import type { Trip, Day, Item } from '../types/trip'
import { formatTime } from './time'

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function itemLine(item: Item): string {
  const time = item.startTime
    ? ` (${formatTime(item.startTime)}${item.endTime ? ` – ${formatTime(item.endTime)}` : ''})`
    : ''
  const location = item.locationLabel ? ` — ${item.locationLabel}` : ''
  const lines = [`- **${item.name}**${time}${location}`]
  if (item.priceLabel) lines.push(`  - ${item.priceLabel}`)
  if (item.notes) lines.push(`  - ${item.notes}`)
  return lines.join('\n')
}

export function buildItineraryMarkdown(trip: Trip, days: Day[], items: Item[]): string {
  const lines: string[] = []
  lines.push(`# ${trip.name}`)
  lines.push('')
  if (trip.description) {
    lines.push(trip.description)
    lines.push('')
  }
  lines.push(`**${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}**`)
  lines.push('')

  const stays = items.filter((i) => i.type === 'stay').sort((a, b) => a.startDate.localeCompare(b.startDate))
  if (stays.length > 0) {
    lines.push("## Where You're Staying")
    lines.push('')
    for (const stay of stays) {
      lines.push(
        `- **${stay.name}** — ${formatDate(stay.startDate)} to ${stay.endDate ? formatDate(stay.endDate) : '—'}`,
      )
      if (stay.roomType) {
        lines.push(`  - ${stay.roomType}${stay.guests ? `, ${stay.guests} guest${stay.guests === 1 ? '' : 's'}` : ''}`)
      }
      if (stay.nightlyRate) {
        lines.push(
          `  - $${stay.nightlyRate.toFixed(2)}/night${stay.taxesFees ? ` + $${stay.taxesFees.toFixed(2)} taxes & fees` : ''}`,
        )
      }
      if (stay.confirmationNumber) lines.push(`  - Confirmation: ${stay.confirmationNumber}`)
    }
    lines.push('')
  }

  const flights = items.filter((i) => i.type === 'flight').sort((a, b) => a.startDate.localeCompare(b.startDate))
  if (flights.length > 0) {
    lines.push('## Flights')
    lines.push('')
    for (const flight of flights) {
      const dep = flight.locationLabel ?? 'Departure'
      const arr = flight.location2Label ?? 'Arrival'
      lines.push(
        `- **${flight.flightNumber || 'Flight'}** — ${dep}${flight.startTime ? ` (${formatTime(flight.startTime)})` : ''} → ${arr}${flight.endTime ? ` (${formatTime(flight.endTime)})` : ''}, ${formatDate(flight.startDate)}`,
      )
      if (flight.priceLabel) lines.push(`  - ${flight.priceLabel}`)
    }
    lines.push('')
  }

  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date))
  for (const [index, day] of sortedDays.entries()) {
    const dayItems = items
      .filter((i) => i.dayId === day.id && i.type !== 'stay')
      .sort((a, b) => a.position - b.position)
    lines.push(`## Day ${index + 1} — ${formatDate(day.date)}${day.label ? `: ${day.label}` : ''}`)
    lines.push('')
    if (dayItems.length === 0) {
      lines.push('_Nothing planned yet._')
    } else {
      for (const item of dayItems) lines.push(itemLine(item))
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function downloadItinerary(trip: Trip, days: Day[], items: Item[]): void {
  const markdown = buildItineraryMarkdown(trip, days, items)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${trip.name.replace(/[^\w-]+/g, '_')}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

import { formatTime } from './time'
import type { Day, Item, ItemDecision, ItemVoteSummary, Trip, TripMemberWithProfile } from '../types/trip'

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

const MARGIN = 72
const INK = '#070606'
const SURFACE_TEAL = '#083740'
const PAPER = '#f7ff88'
const GREEN = '#22dd85'
const WHITE = '#fefefe'
const TEXT_DIM = 'rgba(255,255,255,0.55)'
const TEXT_DIMMER = 'rgba(255,255,255,0.35)'
const RULE = 'rgba(255,255,255,0.12)'

export interface RecapStop {
  label: string
  detail: string | null
  highlighted: boolean
  badge: string | null
}

export interface RecapVoter {
  displayName: string
  avatarColor: string
}

export interface RecapCardContent {
  mode: 'day' | 'trip'
  eyebrow: string
  headline: string
  subheadline: string
  stops: RecapStop[]
  moreStopsCount: number
  voters: RecapVoter[]
  voteLabel: string
  tripName: string
  dateRange: string
}

function formatCardDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function buildDayRecapContent(input: {
  trip: Trip
  day: Day
  dayIndex: number
  dayItems: Item[]
  decision: ItemDecision | null
  voteSummary: Record<string, ItemVoteSummary>
}): RecapCardContent {
  const { trip, day, dayIndex, dayItems, decision, voteSummary } = input
  const lockedItem = decision ? (dayItems.find((item) => item.id === decision.itemId) ?? null) : null
  const leaderboard = [...dayItems].sort(
    (a, b) => (voteSummary[b.id]?.voters.length ?? 0) - (voteSummary[a.id]?.voters.length ?? 0),
  )
  const featured = lockedItem ?? leaderboard[0] ?? null
  const voters = featured ? (voteSummary[featured.id]?.voters ?? []) : []
  const MAX_STOPS = 5
  const orderedStops = featured ? [featured, ...dayItems.filter((item) => item.id !== featured.id)] : dayItems
  const visibleStops = orderedStops.slice(0, MAX_STOPS)

  return {
    mode: 'day',
    eyebrow: `Day ${dayIndex + 1} · ${decision ? 'Locked' : featured ? 'Leading' : 'Open'}`,
    headline: featured?.name ?? 'Nothing decided yet',
    subheadline: [formatCardDate(day.date), day.label].filter(Boolean).join(' · '),
    stops: visibleStops.map((item) => ({
      label: item.name,
      detail: item.startTime ? formatTime(item.startTime) : (item.locationLabel?.split(',')[0] ?? null),
      highlighted: featured ? item.id === featured.id : false,
      badge: featured && item.id === featured.id ? (decision ? 'LOCKED' : 'LEADING') : null,
    })),
    moreStopsCount: Math.max(0, orderedStops.length - visibleStops.length),
    voters: voters.map((voter) => ({ displayName: voter.displayName, avatarColor: voter.avatarColor })),
    voteLabel: voters.length ? `${voters.length} vote${voters.length === 1 ? '' : 's'}` : 'No votes yet',
    tripName: trip.name,
    dateRange: `${formatCardDate(trip.startDate)} – ${formatCardDate(trip.endDate)}`,
  }
}

export function buildTripRecapContent(input: {
  trip: Trip
  days: Day[]
  items: Item[]
  decisions: Record<string, ItemDecision>
  members: TripMemberWithProfile[]
}): RecapCardContent {
  const { trip, days, items, decisions, members } = input
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const decidedCount = sortedDays.filter((day) => decisions[day.id]).length
  const MAX_STOPS = 6
  const dayRows = sortedDays.map((day, index) => {
    const decision = decisions[day.id]
    const item = decision ? (items.find((candidate) => candidate.id === decision.itemId) ?? null) : null
    return { day, index, item }
  })
  const visibleRows = dayRows.slice(0, MAX_STOPS)
  const decidedByIds = new Set(Object.values(decisions).map((decision) => decision.decidedBy))
  const decisionMakers = members.filter((member) => decidedByIds.has(member.userId))
  const voters = (decisionMakers.length ? decisionMakers : members).slice(0, 6)

  return {
    mode: 'trip',
    eyebrow: sortedDays.length > 0 && decidedCount === sortedDays.length ? 'The plan · Locked' : 'The plan · In progress',
    headline: trip.name,
    subheadline: `${sortedDays.length} day${sortedDays.length === 1 ? '' : 's'} · ${decidedCount}/${sortedDays.length} locked`,
    stops: visibleRows.map(({ day, index, item }) => ({
      label: item ? item.name : 'Not decided yet',
      detail: `Day ${index + 1} · ${formatCardDate(day.date)}`,
      highlighted: Boolean(item),
      badge: item ? 'LOCKED' : null,
    })),
    moreStopsCount: Math.max(0, dayRows.length - visibleRows.length),
    voters: voters.map((member) => ({ displayName: member.displayName, avatarColor: member.avatarColor })),
    voteLabel: `${members.length} traveler${members.length === 1 ? '' : 's'}`,
    tripName: trip.name,
    dateRange: `${formatCardDate(trip.startDate)} – ${formatCardDate(trip.endDate)}`,
  }
}

async function loadCardFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return
  try {
    await Promise.all([
      document.fonts.load('800 66px Poppins'),
      document.fonts.load('800 34px Poppins'),
      document.fonts.load('600 30px "Inter Variable"'),
      document.fonts.load('800 30px "Inter Variable"'),
      document.fonts.load('800 24px "Inter Variable"'),
      document.fonts.load('700 24px "IBM Plex Mono"'),
    ])
    await document.fonts.ready
  } catch {
    // best-effort -- falls back to system fonts if webfonts fail to load in time
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word
    if (current && ctx.measureText(attempt).width > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = attempt
    }
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && current) lines.push(current)
  if (lines.length > maxLines) lines.length = maxLines
  const last = lines[lines.length - 1]
  if (last && ctx.measureText(last).width > maxWidth) {
    lines[lines.length - 1] = truncateText(ctx, last, maxWidth)
  }
  return lines.length ? lines : ['']
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let result = text
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result.trimEnd()}…`
}

function initialsFor(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
  return initials || '?'
}

function shortenUrl(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

function drawTracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, fillColor: string, tracking: number) {
  ctx.font = font
  ctx.fillStyle = fillColor
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  let cursor = x
  for (const char of text) {
    ctx.fillText(char, cursor, y)
    cursor += ctx.measureText(char).width + tracking
  }
}

function paintAmbientGlow(ctx: CanvasRenderingContext2D) {
  const greenGlow = ctx.createRadialGradient(
    CARD_WIDTH * 0.14,
    CARD_HEIGHT * 0.1,
    0,
    CARD_WIDTH * 0.14,
    CARD_HEIGHT * 0.1,
    CARD_WIDTH * 0.55,
  )
  greenGlow.addColorStop(0, 'rgba(34,221,133,0.18)')
  greenGlow.addColorStop(1, 'rgba(34,221,133,0)')
  ctx.fillStyle = greenGlow
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  const paperGlow = ctx.createRadialGradient(
    CARD_WIDTH * 0.88,
    CARD_HEIGHT * 0.26,
    0,
    CARD_WIDTH * 0.88,
    CARD_HEIGHT * 0.26,
    CARD_WIDTH * 0.5,
  )
  paperGlow.addColorStop(0, 'rgba(247,255,136,0.13)')
  paperGlow.addColorStop(1, 'rgba(247,255,136,0)')
  ctx.fillStyle = paperGlow
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
}

function drawBadge(ctx: CanvasRenderingContext2D, label: string, rightX: number, centerY: number) {
  ctx.font = '800 18px "Inter Variable"'
  const textWidth = ctx.measureText(label).width
  const paddingX = 16
  const width = textWidth + paddingX * 2
  const height = 32
  const x = rightX - width
  const y = centerY - height / 2
  ctx.fillStyle = PAPER
  roundRectPath(ctx, x, y, width, height, height / 2)
  ctx.fill()
  ctx.fillStyle = INK
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + paddingX, centerY + 1)
}

function drawStopRow(ctx: CanvasRenderingContext2D, stop: RecapStop, index: number, railX: number, rowY: number, rightEdge: number) {
  const circleRadius = 22
  const centerY = rowY + 18

  if (stop.highlighted) {
    ctx.fillStyle = 'rgba(34,221,133,0.1)'
    roundRectPath(ctx, railX - 20, rowY - 26, rightEdge - (railX - 20), 76, 16)
    ctx.fill()
  }

  ctx.beginPath()
  ctx.arc(railX, centerY, circleRadius, 0, Math.PI * 2)
  ctx.fillStyle = stop.highlighted ? GREEN : 'rgba(255,255,255,0.14)'
  ctx.fill()
  ctx.font = '800 22px "Inter Variable"'
  ctx.fillStyle = stop.highlighted ? INK : WHITE
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(index + 1), railX, centerY + 1)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const textX = railX + 56
  ctx.font = '800 30px "Inter Variable"'
  ctx.fillStyle = WHITE
  const nameWidth = rightEdge - textX - (stop.badge ? 150 : 0)
  ctx.fillText(truncateText(ctx, stop.label, nameWidth), textX, centerY - 2)

  if (stop.detail) {
    ctx.font = '600 22px "Inter Variable"'
    ctx.fillStyle = TEXT_DIM
    ctx.fillText(stop.detail, textX, centerY + 28)
  }

  if (stop.badge) {
    drawBadge(ctx, stop.badge, rightEdge, centerY - 8)
  }
}

function drawVoterChip(ctx: CanvasRenderingContext2D, voter: RecapVoter, x: number, y: number, size: number) {
  ctx.fillStyle = voter.avatarColor
  roundRectPath(ctx, x, y, size, size, 12)
  ctx.fill()
  const isLight = voter.avatarColor === '#f7ff88' || voter.avatarColor === '#fefefe'
  ctx.fillStyle = isLight ? INK : WHITE
  ctx.font = '800 22px "Inter Variable"'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initialsFor(voter.displayName), x + size / 2, y + size / 2 + 1)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

/** Draws the shareable recap PNG straight onto the given canvas -- same dark
 * cinematic language as the app (ink base, teal footer band, green/paper
 * accents) with a route-rail motif echoing ItemStation/PDF timeline cards,
 * so the image people see in a groupchat visually rhymes with what's
 * actually inside the trip. */
export async function drawRecapCard(canvas: HTMLCanvasElement, content: RecapCardContent, joinUrl: string): Promise<void> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT

  await loadCardFonts()

  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  paintAmbientGlow(ctx)

  let y = 100

  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '800 26px Poppins'
  ctx.fillStyle = PAPER
  ctx.fillText('ATLAS', CARD_WIDTH - MARGIN, 80)

  drawTracked(ctx, content.eyebrow.toUpperCase(), MARGIN, y, '800 24px "Inter Variable"', GREEN, 3)
  y += 68

  ctx.font = '800 66px Poppins'
  ctx.fillStyle = WHITE
  const headlineLines = wrapText(ctx, content.headline, CARD_WIDTH - MARGIN * 2, 2)
  for (const line of headlineLines) {
    ctx.fillText(line, MARGIN, y)
    y += 74
  }
  y += 10

  ctx.font = '600 30px "Inter Variable"'
  ctx.fillStyle = TEXT_DIM
  ctx.fillText(content.subheadline, MARGIN, y)
  y += 52

  ctx.strokeStyle = RULE
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(MARGIN, y)
  ctx.lineTo(CARD_WIDTH - MARGIN, y)
  ctx.stroke()
  y += 48

  const railX = MARGIN + 20
  const rowHeight = 92
  const stopStartY = y

  if (content.stops.length > 1) {
    ctx.save()
    ctx.strokeStyle = 'rgba(34,221,133,0.4)'
    ctx.lineWidth = 3
    ctx.setLineDash([2, 10])
    ctx.beginPath()
    ctx.moveTo(railX, stopStartY - 8)
    ctx.lineTo(railX, stopStartY + (content.stops.length - 1) * rowHeight + 8)
    ctx.stroke()
    ctx.restore()
  }

  content.stops.forEach((stop, index) => {
    drawStopRow(ctx, stop, index, railX, stopStartY + index * rowHeight, CARD_WIDTH - MARGIN)
  })
  y = stopStartY + content.stops.length * rowHeight

  if (content.moreStopsCount > 0) {
    ctx.font = '700 24px "Inter Variable"'
    ctx.fillStyle = TEXT_DIMMER
    ctx.fillText(`+${content.moreStopsCount} more`, railX + 56, y + 8)
    y += 44
  }
  y += 20

  if (content.voters.length > 0) {
    ctx.font = '800 20px "Inter Variable"'
    ctx.fillStyle = TEXT_DIMMER
    ctx.fillText(content.voteLabel.toUpperCase(), MARGIN, y)
    y += 40
    const chipSize = 56
    let chipX = MARGIN
    for (const voter of content.voters) {
      drawVoterChip(ctx, voter, chipX, y, chipSize)
      chipX += chipSize + 16
    }
  }

  const footerHeight = 190
  const footerY = CARD_HEIGHT - footerHeight
  ctx.fillStyle = SURFACE_TEAL
  ctx.fillRect(0, footerY, CARD_WIDTH, footerHeight)
  ctx.fillStyle = GREEN
  ctx.fillRect(0, footerY, 6, footerHeight)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '800 34px Poppins'
  ctx.fillStyle = WHITE
  ctx.fillText(truncateText(ctx, content.tripName, CARD_WIDTH - MARGIN * 2 - 40), MARGIN, footerY + 62)

  ctx.font = '600 26px "Inter Variable"'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText(content.dateRange, MARGIN, footerY + 98)

  ctx.font = '700 24px "IBM Plex Mono"'
  ctx.fillStyle = PAPER
  ctx.fillText(shortenUrl(joinUrl), MARGIN, footerY + 148)

  ctx.font = '800 18px "Inter Variable"'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText('TAP TO OPEN IN ATLAS', MARGIN, footerY + 174)
}

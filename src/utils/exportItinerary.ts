import type { Trip, Day, Item } from '../types/trip'
import { formatTime } from './time'
import { countryCodesForTrip } from './flags'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 44
const TEAL = [8, 55, 64] as const
const YELLOW = [247, 255, 136] as const
const GREEN = [34, 221, 133] as const
const BLACK = [7, 6, 6] as const
const GREY = [70, 89, 93] as const
const LIGHT_TEAL = [232, 246, 244] as const
const RULE = [181, 211, 207] as const
const WHITE = [254, 254, 254] as const

interface PdfPage {
  ops: string[]
}

type Rgb = readonly [number, number, number]

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function cleanText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapePdfText(value: string): string {
  return cleanText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function color([r, g, b]: Rgb): string {
  return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`
}

function firstLabel(label: string | null): string {
  return cleanText(label).split(',')[0] || ''
}

function flightDuration(item: Item): string | null {
  if (!item.startTime || !item.endTime) return null
  const start = new Date(`${item.startDate}T${item.startTime}`)
  const end = new Date(`${item.endDate ?? item.startDate}T${item.endTime}`)
  let minutes = Math.round((end.getTime() - start.getTime()) / 60000)
  if (minutes < 0) minutes += 24 * 60
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** Deterministic bar-width sequence seeded by the flight number/id -- purely
 * decorative ticket-stub flourish, not a real scannable barcode. */
function barcodeWidths(seed: string, count: number): number[] {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  const widths: number[] = []
  for (let i = 0; i < count; i += 1) {
    hash = (hash * 1103515245 + 12345) >>> 0
    widths.push(1 + (hash % 3))
  }
  return widths
}

function tripFileName(trip: Trip): string {
  return `${cleanText(trip.name).replace(/[^\w-]+/g, '_') || 'itinerary'}.pdf`
}

class ItineraryPdf {
  private pages: PdfPage[] = []
  private y = PAGE_HEIGHT - MARGIN
  private pageNumber = 0
  private trip: Trip
  private mustSeeIds: Set<string>

  constructor(trip: Trip, mustSeeIds = new Set<string>()) {
    this.trip = trip
    this.mustSeeIds = mustSeeIds
    this.addPage()
  }

  addCover(days: Day[], items: Item[]) {
    const countryCodes = countryCodesForTrip(this.trip, items)
    this.rect(0, PAGE_HEIGHT - 122, PAGE_WIDTH, 122, TEAL, true)
    this.rect(MARGIN, PAGE_HEIGHT - 122, 5, 122, GREEN, true)
    this.text('ATLAS', MARGIN + 18, PAGE_HEIGHT - 42, 9, YELLOW, 'Helvetica-Bold')
    this.text(`${days.length} DAYS`, PAGE_WIDTH - MARGIN - 92, PAGE_HEIGHT - 42, 9, WHITE, 'Helvetica-Bold')
    this.text(cleanText(this.trip.name), MARGIN + 18, PAGE_HEIGHT - 80, 30, WHITE, 'Helvetica-Bold')
    this.text(`${formatDate(this.trip.startDate)} - ${formatDate(this.trip.endDate)}`, MARGIN + 18, PAGE_HEIGHT - 104, 11, WHITE)
    this.y = PAGE_HEIGHT - 156

    if (this.trip.description) {
      this.paragraph(cleanText(this.trip.description), 11, GREY, 17, PAGE_WIDTH - MARGIN * 2)
      this.y -= 14
    }

    this.summaryGrid([
      ['Trip days', String(days.length)],
      ['Planned stops', String(items.filter((item) => item.type !== 'stay').length)],
      ['Stays', String(items.filter((item) => item.type === 'stay').length)],
      ['Countries', countryCodes.join(' / ') || '--'],
    ])
  }

  addStaySection(stays: Item[]) {
    if (stays.length === 0) return
    this.sectionTitle("Where You're Staying", GREEN)
    for (const stay of stays) {
      this.ensure(92)
      this.cardStart(82)
      this.text(cleanText(stay.name), MARGIN + 16, this.y - 18, 13, BLACK, 'Helvetica-Bold')
      this.text(`${formatShortDate(stay.startDate)} - ${stay.endDate ? formatShortDate(stay.endDate) : 'Open'}`, MARGIN + 16, this.y - 36, 10, GREY)
      if (stay.roomType) this.text(cleanText(stay.roomType), MARGIN + 16, this.y - 52, 10, BLACK)
      const details = [
        stay.guests ? `${stay.guests} guest${stay.guests === 1 ? '' : 's'}` : '',
        stay.confirmationNumber ? `Confirmation ${cleanText(stay.confirmationNumber)}` : '',
      ].filter(Boolean)
      if (details.length) this.text(details.join('  /  '), MARGIN + 16, this.y - 68, 9, GREY)
      this.y -= 96
    }
  }

  addFlightSection(flights: Item[]) {
    if (flights.length === 0) return
    this.sectionTitle('Flights', YELLOW)
    for (const flight of flights) {
      const cardHeight = 128
      this.ensure(cardHeight + 14)
      const top = this.y
      this.cardStart(cardHeight)

      // Header stub
      this.text('BOARDING PASS', MARGIN + 16, top - 17, 8, GREY, 'Helvetica-Bold')
      this.text(cleanText(flight.flightNumber || 'Flight'), PAGE_WIDTH - MARGIN - 96, top - 17, 8, TEAL, 'Helvetica-Bold')
      this.line(MARGIN, top - 26, PAGE_WIDTH - MARGIN, top - 26, RULE)

      // Route row: depart -- duration -- arrive
      const colWidth = (PAGE_WIDTH - MARGIN * 2 - 32) / 3
      const leftX = MARGIN + 16
      const midX = leftX + colWidth
      const rightX = leftX + colWidth * 2
      this.text(flight.startTime ? formatTime(flight.startTime) : '--', leftX, top - 50, 16, BLACK, 'Helvetica-Bold')
      this.text(firstLabel(flight.locationLabel) || 'Departure', leftX, top - 66, 9, GREY)
      this.line(midX, top - 56, midX + colWidth - 24, top - 56, RULE)
      const duration = flightDuration(flight)
      if (duration) this.text(duration, midX, top - 66, 8, GREY)
      this.text(flight.endTime ? formatTime(flight.endTime) : '--', rightX, top - 50, 16, BLACK, 'Helvetica-Bold')
      this.text(firstLabel(flight.location2Label) || 'Arrival', rightX, top - 66, 9, GREY)

      // Perforated tear line, like a real ticket stub
      this.ticketPerforation(MARGIN, top - 88, PAGE_WIDTH - MARGIN)

      // Footer stub: decorative barcode + date/price
      this.barcode(MARGIN + 16, top - 118, 12, barcodeWidths(flight.flightNumber || flight.id, 26), GREY)
      const footerText = [formatDate(flight.startDate), cleanText(flight.priceLabel)].filter(Boolean).join('   /   ')
      this.text(footerText, PAGE_WIDTH - MARGIN - 176, top - 112, 9, BLACK, 'Helvetica-Bold')

      this.y = top - cardHeight - 14
    }
  }

  addDay(day: Day, index: number, items: Item[]) {
    this.ensure(98)
    this.sectionTitle(`Day ${index + 1}`, index % 2 === 0 ? GREEN : YELLOW)
    this.text(formatDate(day.date), MARGIN, this.y, 12, BLACK, 'Helvetica-Bold')
    this.y -= 16
    if (day.label) {
      this.text(cleanText(day.label), MARGIN, this.y, 10, GREY)
      this.y -= 18
    }

    if (items.length === 0) {
      this.text('Nothing planned yet.', MARGIN, this.y, 10, GREY)
      this.y -= 24
      return
    }

    for (const [itemIndex, item] of items.entries()) {
      this.addTimelineItem(item, itemIndex + 1)
    }
  }

  finish(): Uint8Array {
    this.addFooters()
    const objects: string[] = []
    const pagesObjectId = 2
    const fontRegularId = 3
    const fontBoldId = 4
    const firstPageId = 5
    const pageIds = this.pages.map((_, index) => firstPageId + index * 2)

    objects[1] = `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`
    objects[pagesObjectId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${this.pages.length} >>`
    objects[fontRegularId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    objects[fontBoldId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'

    this.pages.forEach((page, index) => {
      const pageId = firstPageId + index * 2
      const contentId = pageId + 1
      const stream = page.ops.join('\n')
      objects[pageId] = `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
      objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    })

    let pdf = '%PDF-1.4\n'
    const offsets = [0]
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = pdf.length
      pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`
    }
    const xref = pdf.length
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
    for (let id = 1; id < objects.length; id += 1) {
      pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
    return new TextEncoder().encode(pdf)
  }

  private addTimelineItem(item: Item, number: number) {
    const detailLines = [
      item.startTime ? `${formatTime(item.startTime)}${item.endTime ? ` - ${formatTime(item.endTime)}` : ''}` : '',
      cleanText(item.priceLabel),
      item.locationLabel ? firstLabel(item.locationLabel) : '',
    ].filter(Boolean)
    const notes = cleanText(item.notes)
    const height = notes ? 86 : 66
    this.ensure(height + 14)
    const top = this.y
    this.circle(MARGIN + 11, top - 19, 9, GREEN)
    this.text(String(number), MARGIN + 8.2, top - 23, 8, BLACK, 'Helvetica-Bold')
    this.text(`${this.mustSeeIds.has(item.id) ? '* ' : ''}${cleanText(item.name)}`, MARGIN + 34, top - 12, 12, BLACK, 'Helvetica-Bold')
    if (detailLines.length) this.text(detailLines.join('  /  '), MARGIN + 34, top - 29, 9, GREY)
    if (notes) this.paragraph(notes, 9, GREY, 13, PAGE_WIDTH - MARGIN * 2 - 34, MARGIN + 34, top - 47)
    this.line(MARGIN + 11, top - 34, MARGIN + 11, top - height + 4, RULE)
    this.y -= height
  }

  private summaryGrid(entries: Array<[string, string]>) {
    const width = (PAGE_WIDTH - MARGIN * 2 - 24) / 4
    this.ensure(72)
    for (const [index, [label, value]] of entries.entries()) {
      const x = MARGIN + index * (width + 8)
      this.rect(x, this.y - 56, width, 56, LIGHT_TEAL, true)
      this.rect(x, this.y - 56, width, 56, RULE, false)
      this.text(value, x + 10, this.y - 22, 18, BLACK, 'Helvetica-Bold')
      this.text(label, x + 10, this.y - 42, 8, GREY, 'Helvetica-Bold')
    }
    this.y -= 86
  }

  private sectionTitle(title: string, accent: Rgb) {
    this.ensure(58)
    this.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y, RULE)
    this.text(title, MARGIN, this.y - 24, 18, BLACK, 'Helvetica-Bold')
    this.rect(PAGE_WIDTH - MARGIN - 42, this.y - 26, 42, 4, accent, true)
    this.y -= 42
  }

  private paragraph(text: string, size: number, textColor: Rgb, lineHeight: number, width: number, x = MARGIN, y = this.y) {
    for (const line of this.wrap(text, size, width)) {
      this.text(line, x, y, size, textColor)
      y -= lineHeight
    }
    this.y = Math.min(this.y, y)
  }

  private wrap(text: string, size: number, width: number): string[] {
    const words = cleanText(text).split(' ')
    const lines: string[] = []
    let current = ''
    const maxChars = Math.max(12, Math.floor(width / (size * 0.52)))
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (next.length > maxChars && current) {
        lines.push(current)
        current = word
      } else {
        current = next
      }
    }
    if (current) lines.push(current)
    return lines
  }

  private addPage() {
    this.pages.push({ ops: [] })
    this.pageNumber += 1
    this.y = PAGE_HEIGHT - MARGIN
  }

  private current(): PdfPage {
    return this.pages[this.pages.length - 1]
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN + 28) this.addPage()
  }

  private addFooters() {
    const total = this.pages.length
    this.pages.forEach((page, index) => {
      page.ops.push(`${color(RULE)} RG 0.6 w ${MARGIN} 34 m ${PAGE_WIDTH - MARGIN} 34 l S`)
      page.ops.push(`BT /F1 8 Tf ${color(GREY)} rg ${MARGIN} 20 Td (${escapePdfText(cleanText(this.trip.name))}) Tj ET`)
      page.ops.push(
        `BT /F1 8 Tf ${color(GREY)} rg ${PAGE_WIDTH - MARGIN - 48} 20 Td (${index + 1} / ${total}) Tj ET`,
      )
    })
  }

  private cardStart(height: number) {
    this.rect(MARGIN, this.y - height, PAGE_WIDTH - MARGIN * 2, height, LIGHT_TEAL, true)
    this.rect(MARGIN, this.y - height, PAGE_WIDTH - MARGIN * 2, height, RULE, false)
  }

  private text(value: string, x: number, y: number, size: number, textColor: Rgb, font = 'Helvetica') {
    const fontRef = font === 'Helvetica-Bold' ? 'F2' : 'F1'
    this.current().ops.push(`BT /${fontRef} ${size} Tf ${color(textColor)} rg ${x} ${y} Td (${escapePdfText(value)}) Tj ET`)
  }

  private line(x1: number, y1: number, x2: number, y2: number, stroke: Rgb) {
    this.current().ops.push(`${color(stroke)} RG 0.7 w ${x1} ${y1} m ${x2} ${y2} l S`)
  }

  private rect(x: number, y: number, width: number, height: number, rectColor: Rgb, fill: boolean) {
    this.current().ops.push(`${color(rectColor)} ${fill ? 'rg' : 'RG'} ${x} ${y} ${width} ${height} re ${fill ? 'f' : 'S'}`)
  }

  private circle(x: number, y: number, radius: number, fill: Rgb) {
    const c = radius * 0.5522847498
    this.current().ops.push(
      `${color(fill)} rg ${x + radius} ${y} m ${x + radius} ${y + c} ${x + c} ${y + radius} ${x} ${y + radius} c ${x - c} ${y + radius} ${x - radius} ${y + c} ${x - radius} ${y} c ${x - radius} ${y - c} ${x - c} ${y - radius} ${x} ${y - radius} c ${x + c} ${y - radius} ${x + radius} ${y - c} ${x + radius} ${y} c f`,
    )
  }

  /** Boarding-pass tear line: a dashed rule across the card with two
   * notches punched in white (the page's own background) at its left/right
   * edges, so they read as holes cut through the card rather than dots. */
  private ticketPerforation(x1: number, y: number, x2: number) {
    this.current().ops.push(`${color(RULE)} RG 0.7 w [3 3] 0 d ${x1} ${y} m ${x2} ${y} l S [] 0 d`)
    this.circle(x1, y, 9, WHITE)
    this.circle(x2, y, 9, WHITE)
  }

  private barcode(x: number, y: number, height: number, widths: number[], fill: Rgb) {
    let cursor = x
    for (const [index, w] of widths.entries()) {
      const barHeight = index % 5 === 0 ? height : height * 0.65
      this.rect(cursor, y, w, barHeight, fill, true)
      cursor += w + 1.5
    }
  }
}

export function buildItineraryPdf(trip: Trip, days: Day[], items: Item[], mustSeeIds = new Set<string>()): Uint8Array {
  const pdf = new ItineraryPdf(trip, mustSeeIds)
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const sortedItems = [...items].sort((a, b) => a.position - b.position)
  const stays = sortedItems.filter((item) => item.type === 'stay').sort((a, b) => a.startDate.localeCompare(b.startDate))
  const flights = sortedItems
    .filter((item) => item.type === 'flight')
    .sort((a, b) => `${a.startDate}${a.startTime ?? ''}`.localeCompare(`${b.startDate}${b.startTime ?? ''}`))

  pdf.addCover(sortedDays, sortedItems)
  pdf.addStaySection(stays)
  pdf.addFlightSection(flights)
  sortedDays.forEach((day, index) => {
    const dayItems = sortedItems.filter((item) => item.dayId === day.id && item.type !== 'stay')
    pdf.addDay(day, index, dayItems)
  })

  return pdf.finish()
}

export function downloadItinerary(trip: Trip, days: Day[], items: Item[], mustSeeIds = new Set<string>()): void {
  const pdf = buildItineraryPdf(trip, days, items, mustSeeIds)
  const buffer = new ArrayBuffer(pdf.byteLength)
  new Uint8Array(buffer).set(pdf)
  const blob = new Blob([buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = tripFileName(trip)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

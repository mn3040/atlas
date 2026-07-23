import type { ActivityCategory, ItemType, Trip } from '../types/trip'

export interface ExtractedItineraryItem {
  id: string
  selected: boolean
  type: ItemType
  category: ActivityCategory
  name: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  locationLabel: string
  location2Label: string
  flightNumber: string
  confirmationNumber: string
  notes: string
  mustSee: boolean
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

export async function extractTextFromFile(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase()
  if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) return extractPdfText(file)
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx')
  ) {
    const mammoth = await import('mammoth/mammoth.browser')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }
  if (file.type.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md')) return file.text()
  throw new Error('Upload a PDF, DOCX, TXT, or Markdown itinerary.')
}

export function extractItineraryItems(text: string, trip: Trip): ExtractedItineraryItem[] {
  const lines = normalizeLines(text)
  const suggestions: ExtractedItineraryItem[] = []
  let currentDate = trip.startDate

  for (const line of lines) {
    const parsedDate = dateFromLine(line, trip)
    if (parsedDate) currentDate = parsedDate

    const flightNumber = line.match(/\b([A-Z]{2}|[A-Z][0-9]|[0-9][A-Z])\s?\d{2,4}\b/)?.[0] ?? ''
    const lower = line.toLowerCase()
    const mustSee = /\u2b50|\bmust see\b/i.test(line)
    const placeLine = lower.includes('atlas_place_link')

    if ((isSectionHeader(line) || isInstructionLine(line)) && !placeLine) continue

    if (flightNumber || /\bflight\b|\bdepart(?:ure|s)?\b|\barriv(?:al|es)?\b/.test(lower)) {
      const airports = airportPair(line)
      suggestions.push(baseSuggestion('flight', trip, currentDate, {
        name: flightNumber || 'Flight',
        flightNumber,
        startTime: firstTime(line),
        endTime: secondTime(line),
        locationLabel: airports[0],
        location2Label: airports[1],
        notes: line,
        mustSee,
      }))
      continue
    }

    if (/\bhotel\b|\bcheck-?in\b|\breservation\b|\bconfirmation\b|\blodging\b|\bstay\b/.test(lower)) {
      suggestions.push(baseSuggestion('stay', trip, parsedDate ?? currentDate, {
        name: stayName(line),
        endDate: checkoutDate(line, trip) ?? '',
        startTime: firstTime(line),
        locationLabel: locationAfterWords(line, ['at', 'hotel', 'address']) || stayName(line),
        confirmationNumber: confirmation(line),
        notes: line,
        mustSee,
      }))
      continue
    }

    if (
      parsedDate ||
      firstTime(line) ||
      mustSee ||
      placeLine ||
      /\btour\b|\bmuseum\b|\bticket\b|\bdinner\b|\blunch\b|\bbreakfast\b|\bvisit\b|\breservation\b|\bpark\b|\bmarket\b|\btrain\b/.test(
        lower,
      )
    ) {
      const category = categoryForLine(line)
      suggestions.push(baseSuggestion('activity', trip, parsedDate ?? currentDate, {
        category,
        name: activityName(line),
        startTime: firstTime(line),
        endTime: secondTime(line),
        locationLabel: locationAfterWords(line, ['at', 'to', 'visit']) || activityName(line),
        notes: line,
        mustSee,
      }))
    }
  }

  return dedupe(suggestions).slice(0, 40)
}

async function extractPdfText(file: File): Promise<string> {
  const [{ GlobalWorkerOptions, getDocument }, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = worker.default
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }

  return pages.join('\n')
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map(markdownToText)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 5 && !/^(page \d+|\d+)$/.test(line.toLowerCase()))
}

function markdownToText(line: string): string {
  const hasLink = /\[[^\]]+\]\([^)]+\)/.test(line)
  const text = line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, '')
  return hasLink ? `${text} atlas_place_link` : text
}

function isSectionHeader(line: string): boolean {
  return (
    /:\s*\d{1,2}\//.test(line) ||
    /\)\s*\d{1,2}\//.test(line) ||
    /\b\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}\/\d{1,2}\b/.test(line)
  )
}

function isInstructionLine(line: string): boolean {
  return /\bitinerary\b/i.test(line) || /\badd a star\b/i.test(line) || /\bborder zone permits\b/i.test(line)
}

function baseSuggestion(
  type: ItemType,
  trip: Trip,
  date: string,
  patch: Partial<ExtractedItineraryItem>,
): ExtractedItineraryItem {
  return {
    id: crypto.randomUUID(),
    selected: true,
    type,
    category: patch.category ?? 'attraction',
    name: patch.name?.trim() || (type === 'stay' ? 'Stay' : type === 'flight' ? 'Flight' : 'Activity'),
    startDate: clampDate(date, trip),
    endDate: patch.endDate ? clampDate(patch.endDate, trip) : '',
    startTime: patch.startTime ?? '',
    endTime: patch.endTime ?? '',
    locationLabel: patch.locationLabel?.trim() ?? '',
    location2Label: patch.location2Label?.trim() ?? '',
    flightNumber: patch.flightNumber?.trim() ?? '',
    confirmationNumber: patch.confirmationNumber?.trim() ?? '',
    notes: patch.notes?.trim() ?? '',
    mustSee: patch.mustSee ?? false,
  }
}

function dateFromLine(line: string, trip: Trip): string | null {
  const numeric = line.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (numeric) {
    const year = numeric[3] ? normalizeYear(numeric[3]) : new Date(`${trip.startDate}T00:00:00`).getFullYear()
    return isoDate(year, Number(numeric[1]), Number(numeric[2]))
  }

  const words = line.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/i,
  )
  if (!words) return null
  const month = MONTHS[words[1].replace('.', '').toLowerCase()]
  const year = words[3] ? Number(words[3]) : new Date(`${trip.startDate}T00:00:00`).getFullYear()
  return isoDate(year, month, Number(words[2]))
}

function checkoutDate(line: string, trip: Trip): string | null {
  const dates = [...line.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)]
  if (dates.length < 2) return null
  const match = dates[1]
  const year = match[3] ? normalizeYear(match[3]) : new Date(`${trip.startDate}T00:00:00`).getFullYear()
  return isoDate(year, Number(match[1]), Number(match[2]))
}

function normalizeYear(value: string): number {
  const year = Number(value)
  return year < 100 ? 2000 + year : year
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function clampDate(date: string, trip: Trip): string {
  if (date < trip.startDate) return trip.startDate
  if (date > trip.endDate) return trip.endDate
  return date
}

function firstTime(line: string): string {
  return timeMatches(line)[0] ?? ''
}

function secondTime(line: string): string {
  return timeMatches(line)[1] ?? ''
}

function timeMatches(line: string): string[] {
  return [...line.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\b/gi)]
    .map((match) => toTime(match[1], match[2], match[3]))
    .filter(Boolean)
}

function toTime(hourValue: string, minuteValue?: string, meridiem?: string): string {
  let hour = Number(hourValue)
  if (hour > 24) return ''
  if (meridiem?.toLowerCase() === 'pm' && hour < 12) hour += 12
  if (meridiem?.toLowerCase() === 'am' && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${minuteValue ?? '00'}`
}

function airportPair(line: string): [string, string] {
  const arrow = line.match(/(.+?)\s(?:to|->|-)\s(.+)/i)
  if (!arrow) return ['', '']
  return [cleanLocation(arrow[1]), cleanLocation(arrow[2])]
}

function stayName(line: string): string {
  const match = line.match(/\b(?:hotel|stay|lodging)\s*[:-]?\s*(.+?)(?:\s{2,}|,| check-?in| confirmation|$)/i)
  return cleanName(match?.[1] ?? line)
}

function activityName(line: string): string {
  return cleanName(line.replace(/^\d{1,2}:\d{2}\s?(?:am|pm)?\s*/i, '').replace(/^.+?\s+-\s+/, ''))
}

function cleanName(value: string): string {
  return value
    .replace(/\b(?:confirmation|reservation|check-?in|check-?out|depart(?:ure|s)?|arriv(?:al|es)?)\b.*$/i, '')
    .replace(/\batlas_place_link\b/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '')
    .replace(/\u2b50/g, '')
    .trim()
    .slice(0, 90)
}

function locationAfterWords(line: string, words: string[]): string {
  for (const word of words) {
    const match = line.match(new RegExp(`\\b${word}\\s+([^,;]+(?:,\\s*[^,;]+)?)`, 'i'))
    if (match?.[1]) return cleanLocation(match[1])
  }
  return ''
}

function cleanLocation(value: string): string {
  return value
    .replace(/\b(?:flight|depart(?:ure|s)?|arriv(?:al|es)?|at|from|to)\b/gi, '')
    .replace(/\batlas_place_link\b/gi, '')
    .replace(/\b\d{1,2}:?\d{0,2}\s?(?:am|pm)?\b/gi, '')
    .trim()
    .slice(0, 90)
}

function confirmation(line: string): string {
  return line.match(/\b(?:confirmation|conf\.?|booking|reservation)\s*(?:no\.?|number|#|:)?\s*([A-Z0-9-]{4,})/i)?.[1] ?? ''
}

function categoryForLine(line: string): ActivityCategory {
  const lower = line.toLowerCase()
  if (/\bdinner\b|\blunch\b|\bbreakfast\b|\brestaurant\b|\bcafe\b|\breservation\b/.test(lower)) return 'food'
  if (/\btrain\b|\bbus\b|\bferry\b|\btaxi\b|\btransfer\b/.test(lower)) return 'transport'
  if (/\bmarket\b|\bshopping\b|\bmall\b|\bboutique\b/.test(lower)) return 'shopping'
  if (/\bpark\b|\bhike\b|\bbeach\b|\bgarden\b|\bnature\b/.test(lower)) return 'nature'
  return 'attraction'
}

function dedupe(items: ExtractedItineraryItem[]): ExtractedItineraryItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.type}:${item.name.toLowerCase()}:${item.startDate}:${item.startTime}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

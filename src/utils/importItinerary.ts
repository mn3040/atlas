import { unescapeMarkdown } from './textGuards'
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
  branchLabel?: string
  importRole?: 'confirmed' | 'option' | 'resource' | 'warning'
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
    const mammothModule = await import('mammoth/mammoth.browser')
    const mammoth = (mammothModule.default ?? mammothModule) as unknown as {
      convertToMarkdown: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
      extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
    }
    const arrayBuffer = await fileToArrayBuffer(file)
    const result = typeof mammoth.convertToMarkdown === 'function'
      ? await mammoth.convertToMarkdown({ arrayBuffer })
      : await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }
  if (file.type.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md')) return fileToText(file)
  throw new Error('Upload a PDF, DOCX, TXT, or Markdown itinerary.')
}

export function extractItineraryItems(text: string, trip: Trip): ExtractedItineraryItem[] {
  const lines = normalizeLines(text)
  const suggestions: ExtractedItineraryItem[] = []
  let currentDate = trip.startDate
  let pendingMustSee = false
  let sectionDates: string[] = [trip.startDate]
  let sectionStopIndex = 0
  let sectionLabel = ''
  let branchLabel = ''

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const parsedRange = dateRangeFromLine(line, trip)
    const parsedDate = dateFromLine(line, trip)
    if (parsedRange.length > 0) {
      sectionDates = parsedRange
      sectionStopIndex = 0
      currentDate = parsedRange[0]
      sectionLabel = sectionLabelFromHeader(line)
      branchLabel = defaultBranchForSection(sectionLabel)
    } else if (parsedDate) {
      currentDate = parsedDate
      sectionDates = [parsedDate]
      sectionStopIndex = 0
      if (isSectionHeader(line)) {
        sectionLabel = sectionLabelFromHeader(line)
        branchLabel = defaultBranchForSection(sectionLabel)
      }
    }
    if (parsedDate && isDateOnlyLine(line)) continue

    const flightNumber = line.match(/\b([A-Z]{2}|[A-Z][0-9]|[0-9][A-Z])\s?\d{2,4}\b/)?.[0] ?? ''
    const lower = line.toLowerCase()
    const mustSee = hasMustSee(line) || pendingMustSee
    const placeLine = lower.includes('atlas_place_link')

    if (isMustSeeMarker(line)) {
      pendingMustSee = true
      continue
    }

    const branchFromLine = branchLabelFromLine(line, sectionLabel)
    if (branchFromLine) {
      branchLabel = branchFromLine
      if (!isImportableBranchPlaceLine(line)) continue
    }

    const flightLikeLine = flightNumber || /\b(?:depart(?:ure|s)?|arriv(?:al|es)?)\b/.test(lower) || /\bflight\b.+\bfrom\b.+\bto\b/i.test(line)
    if ((isSectionHeader(line) || isInstructionLine(line) || (isTravelNoteLine(line) && !flightLikeLine)) && !placeLine) continue
    if (isBulletLine(line) && !flightNumber) {
      const bulletText = stripBullet(line)
      if (isBulletPlaceTitle(bulletText)) {
        addActivitySuggestions(suggestions, trip, sectionDate(sectionDates, sectionStopIndex), bulletText, mustSee, index, lines, branchLabel)
        sectionStopIndex += 1
        pendingMustSee = false
      }
      continue
    }

    if (flightLikeLine) {
      const airports = airportPair(line)
      suggestions.push(baseSuggestion('flight', trip, currentDate, {
        name: flightNumber || (airports[0] && airports[1] ? `Flight ${airports[0]} to ${airports[1]}` : 'Flight'),
        flightNumber,
        startTime: firstTime(line),
        endTime: secondTime(line),
        locationLabel: airports[0],
        location2Label: airports[1],
        notes: line,
        mustSee,
        branchLabel,
      }))
      pendingMustSee = false
      continue
    }

    if (
      /\bhotel\b|\bcheck-?in\b|\breservation\b|\bconfirmation\b|\blodging\b|\bstay\b/.test(lower) &&
      !/^\d+(?:\.\d+)?\s+hours?\s+stay\b/i.test(line)
    ) {
      suggestions.push(baseSuggestion('stay', trip, parsedDate ?? currentDate, {
        name: stayName(line),
        endDate: checkoutDate(line, trip) ?? '',
        startTime: firstTime(line),
        locationLabel: locationAfterWords(line, ['at', 'hotel', 'address']) || stayName(line),
        confirmationNumber: confirmation(line),
        notes: line,
        mustSee,
        branchLabel,
      }))
      pendingMustSee = false
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
      addActivitySuggestions(suggestions, trip, parsedDate ?? sectionDate(sectionDates, sectionStopIndex), line, mustSee, index, lines, branchLabel)
      sectionStopIndex += 1
      pendingMustSee = false
      continue
    }

    if (isPlaceTitleLine(line, lines[index + 1], pendingMustSee)) {
      addActivitySuggestions(suggestions, trip, sectionDate(sectionDates, sectionStopIndex), line, mustSee, index, lines, branchLabel)
      sectionStopIndex += 1
      pendingMustSee = false
    }
  }

  return dedupe(suggestions).slice(0, 40)
}

async function extractPdfText(file: File): Promise<string> {
  if (shouldUseServerPdfExtraction()) {
    try {
      return await extractPdfTextOnServer(file)
    } catch (error) {
      console.warn('Atlas server PDF extraction failed.', error)
      throw new Error(serverPdfExtractionMessage(error))
    }
  }

  ensurePdfJsCompatibility()
  const [{ GlobalWorkerOptions, getDocument }, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = worker.default
  const arrayBuffer = await fileToArrayBuffer(file)
  const pdf = await getDocument({
    data: new Uint8Array(arrayBuffer),
    disableFontFace: true,
    disableRange: true,
    disableStream: true,
    isImageDecoderSupported: false,
    isOffscreenCanvasSupported: false,
    useSystemFonts: true,
    useWasm: false,
  }).promise
  const pages: string[] = []

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const content = await page.getTextContent()
    pages.push(pdfTextContentToLines(content.items))
  }

  return pages.join('\n')
}

async function extractPdfTextOnServer(file: File): Promise<string> {
  const response = await fetch('/api/extract-document', {
    method: 'POST',
    headers: {
      'content-type': file.type || 'application/pdf',
      'x-file-name': encodeURIComponent(file.name),
    },
    body: await fileToArrayBuffer(file),
  })
  const payload = (await response.json().catch(() => null)) as { text?: string; error?: string } | null
  if (!response.ok || !payload?.text) {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('text/html')) {
      throw new Error('Atlas received the app page instead of the PDF extractor API.')
    }
    throw new Error(payload?.error ?? 'Could not read that PDF on this device.')
  }
  return payload.text
}

function shouldUseServerPdfExtraction(): boolean {
  if (typeof window === 'undefined') return false
  return isLikelyMobileSafari() || window.location.hostname.endsWith('vercel.app')
}

function serverPdfExtractionMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/text\/html|javascript mime type|module script|pdf extractor api|app page/i.test(message)) {
    return 'Mobile PDF import is reaching the app page instead of the PDF extractor. Redeploy Vercel with the latest /api/extract-document route, then retry.'
  }
  return message || 'Could not read that PDF on this device.'
}

function pdfTextContentToLines(items: unknown[]): string {
  const lines: string[] = []
  let currentLine: string[] = []
  let currentY: number | null = null

  for (const item of items) {
    if (!isPdfTextItem(item)) continue
    const text = item.str.trim()
    if (!text) continue
    const y: number | null = typeof item.transform?.[5] === 'number' ? item.transform[5] : currentY
    if (currentY != null && y != null && Math.abs(y - currentY) > 4) {
      lines.push(currentLine.join(' '))
      currentLine = []
    }
    currentLine.push(text)
    currentY = y
    if (item.hasEOL) {
      lines.push(currentLine.join(' '))
      currentLine = []
      currentY = null
    }
  }

  if (currentLine.length > 0) lines.push(currentLine.join(' '))
  return lines.join('\n')
}

function isPdfTextItem(item: unknown): item is { str: string; transform?: number[]; hasEOL?: boolean } {
  return Boolean(item && typeof item === 'object' && 'str' in item && typeof (item as { str?: unknown }).str === 'string')
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .replace(/â­\u0090/g, '⭐')
    .replace(/â€™/g, "'")
    .replace(/â€“/g, '-')
    .split('\n')
    .map(importMarkupToText)
    .map((line) => line.replace(/^[•*]\s+/, '- ').replace(/\s+/g, ' ').trim())
    .filter((line) => (line.length > 2 || isMustSeeMarker(line)) && !/^(page \d+|\d+)$/.test(line.toLowerCase()))
}

function importMarkupToText(line: string): string {
  const hasLink = /\[[^\]]+\]\([^)]+\)/.test(line)
  const hasHtmlLink = /<a\b[^>]*href=/i.test(line)
  const text = stripImportMarkup(line)
  return hasLink || hasHtmlLink ? `${text} atlas_place_link` : text
}

function stripImportMarkup(value: string): string {
  return unescapeMarkdown(decodeHtmlEntities(value))
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

function isSectionHeader(line: string): boolean {
  return (
    /^---\s*page\s+\d+\s*---$/i.test(line) ||
    /^day\s+\d+\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/i.test(line) ||
    /:\s*\d{1,2}\//.test(line) ||
    /\)\s*\d{1,2}\//.test(line) ||
    /\b\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}\/\d{1,2}\b/.test(line) ||
    /^(kyrgyz|kazakhstan|tajikistan|turkey)(?:\s+\d{1,2}\/\d{1,2})?$/i.test(line)
  )
}

function isInstructionLine(line: string): boolean {
  return (
    /\bitinerary\b/i.test(line) ||
    /\badd a star\b/i.test(line) ||
    /\bborder zone permits\b/i.test(line) ||
    /^https?:\/\//i.test(line) ||
    /\bwill fill this out\b/i.test(line)
  )
}

function isDateOnlyLine(line: string): boolean {
  return (
    /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(line) ||
    /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:,?\s+\d{4})?$/i.test(
      line,
    )
  )
}

function sectionDate(dates: string[], index: number): string {
  return dates[Math.min(index, dates.length - 1)] ?? dates[0]
}

function sectionLabelFromHeader(line: string): string {
  return cleanName(
    line
      .replace(/\([^)]*\)/g, '')
      .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s*-\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)?\b/g, '')
      .replace(/:\s*$/, '')
      .trim(),
  )
}

function defaultBranchForSection(sectionLabel: string): string {
  const label = sectionLabel.toLowerCase()
  if (/osh|south/.test(label)) return 'Plan A: Peak Lenin sprint'
  if (/central/.test(label)) return 'Plan A: Kel Suu core route'
  if (/issyk|kul|karakol/.test(label)) return ''
  return ''
}

function branchLabelFromLine(line: string, sectionLabel: string): string {
  const clean = cleanName(line)
  const lower = clean.toLowerCase()
  if (/^tajikistan$/.test(lower)) return 'Plan B: Tajik border detour'
  if (/no man['’]?s land|karakul|ak baital/.test(lower)) return 'Plan B: Tajik border detour'
  if (/^kazakhstan\b/.test(lower)) return 'Plan A: Kazakhstan transfer day'
  if (/^turkey$/.test(lower)) return 'Plan A: Turkey connection'
  if (/enilcheck|enilchek/.test(lower)) return 'Plan A: Enilchek day trip'
  if (/jyrgalan/.test(lower)) return 'Plan B: Jyrgalan trek'
  if (/ala-kul|ala kul|altyn arashan/.test(lower)) return 'Plan C: Ala-Kul and Altyn Arashan'
  if (/tash rabat/.test(lower)) return 'Plan B: Tash Rabat add-on'
  if (/song kol|song kul/.test(lower)) return 'Plan B: Song Kol stargazing'
  if (/\boption\s*1\b/i.test(line)) return `${sectionLabel || 'Route'} / Option 1`
  if (/\boption\s*2\b/i.test(line)) return `${sectionLabel || 'Route'} / Option 2`
  return ''
}

function isImportableBranchPlaceLine(line: string): boolean {
  return knownCentralAsiaPlace(line) || /\batlas_place_link\b/i.test(line)
}

function isTravelNoteLine(line: string): boolean {
  return /\b(?:fly back|get there|drive to|drive from|round trip|minute drive|hour drive|leave next|leave from|according to|best to just|same distance)\b/i.test(
    line,
  )
}

function baseSuggestion(
  type: ItemType,
  trip: Trip,
  date: string,
  patch: Partial<ExtractedItineraryItem>,
): ExtractedItineraryItem {
  const fallbackName = type === 'stay' ? 'Stay' : type === 'flight' ? 'Flight' : 'Activity'
  return {
    id: randomId(),
    selected: true,
    type,
    category: patch.category ?? 'attraction',
    name: cleanImportValue(patch.name) || fallbackName,
    startDate: clampDate(safeDate(date, trip.startDate), trip),
    endDate: patch.endDate ? clampDate(safeDate(patch.endDate, trip.endDate), trip) : '',
    startTime: cleanImportValue(patch.startTime),
    endTime: cleanImportValue(patch.endTime),
    locationLabel: cleanImportValue(patch.locationLabel),
    location2Label: cleanImportValue(patch.location2Label),
    flightNumber: cleanImportValue(patch.flightNumber),
    confirmationNumber: cleanImportValue(patch.confirmationNumber),
    notes: cleanImportValue(patch.notes),
    mustSee: patch.mustSee ?? false,
    branchLabel: cleanImportValue(patch.branchLabel),
    importRole: patch.importRole ?? (patch.branchLabel ? 'option' : 'confirmed'),
  }
}

function cleanImportValue(value: unknown): string {
  if (typeof value !== 'string') return ''
  const clean = stripImportMarkup(value)
    .replace(/\batlas_place_link\b/gi, '')
    .replace(/[\u2b50â­â˜…?]+/g, '')
    .replace(/\b(?:undefined|null)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean === '-' ? '' : clean
}

function safeDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? fallback : value
}

function addActivitySuggestions(
  suggestions: ExtractedItineraryItem[],
  trip: Trip,
  date: string,
  line: string,
  mustSee: boolean,
  index: number,
  lines: string[],
  branchLabel = '',
) {
  const notes = collectNotes(line, index, lines)
  const category = categoryForLine(`${line} ${notes}`)
  const names = splitActivityNames(activityName(line))

  for (const name of names) {
    if (!isImportablePlaceName(name, line, notes, mustSee)) continue
    suggestions.push(baseSuggestion('activity', trip, date, {
      category,
      name,
      startTime: firstTime(line),
      endTime: secondTime(line),
      locationLabel: locationAfterWords(line, ['at', 'to', 'visit']) || name,
      notes,
      mustSee,
      branchLabel,
    }))
  }
}

function collectNotes(line: string, index: number, lines: string[]): string {
  const notes = [line]
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const next = lines[cursor]
    if (isMustSeeMarker(next) || isSectionHeader(next) || isInstructionLine(next)) break
    if (isPlaceTitleLine(next, lines[cursor + 1], false)) break
    if (isBulletLine(next)) {
      notes.push(stripBullet(next))
      continue
    }
    if (/^[a-z(]/.test(next) || notes[notes.length - 1]?.endsWith(',')) {
      notes.push(next)
      continue
    }
    break
  }
  return notes.join(' ')
}

function splitActivityNames(name: string): string[] {
  const normalized = name
    .replace(/\s+\((?:frontend|backend)\)\s*$/i, '')
    .replace(/\s+and\s+/gi, ' & ')
    .replace(/\s*\+\s*/g, ' & ')

  const parts = normalized
    .split(/\s*&\s*|,\s*/)
    .map((part) => cleanName(part))
    .filter((part) => part.length > 1)

  return parts.length > 1 ? parts : [normalized]
}

function isImportablePlaceName(name: string, line: string, notes: string, mustSee: boolean): boolean {
  const clean = cleanName(name)
  const lowerNameLine = `${clean} ${line}`.toLowerCase()
  const lowerAll = `${lowerNameLine} ${notes}`.toLowerCase()
  if (clean.length < 3 || clean.length > 70) return false
  if (/^\d+$/.test(clean)) return false
  if (/^(?:great|good|only|probably|according|best|same|more|highly|leave|get|arrange)\b/i.test(clean)) return false
  if (/\b(?:guide|option|booking|permit|permits|transfer|transfers|route|routes|according|same distance|best to|only way|take days|more solitude|highly recommended)\b/.test(lowerNameLine)) {
    return false
  }
  if (/\b(?:travellers pass hike)\b/.test(lowerAll) && !mustSee) return false
  if (mustSee || /\batlas_place_link\b/i.test(line)) return true
  if (knownCentralAsiaPlace(clean)) return true
  if (/\b(?:park|tower|bazaar|lake|kul|kol|valley|canyon|monument|base camp|pass|camp|town|hike|trek|market)\b/i.test(clean)) {
    return true
  }
  return clean.split(/\s+/).length <= 3 && /^[A-Z]/.test(clean)
}

function knownCentralAsiaPlace(name: string): boolean {
  return /\b(?:peak lenin|tulpar|ala-archa|burana|dordoi|bishkek|osh|naryn|kok kiya|kel suu|kel-suu|tash rabat|song kol|song kul|bokonbayevo|skazka|skakza|jeti oguz|kok jaiyk|barskoon|karakol|enilchek|enilcheck|jyrgalan|ala-kul|ala kul|altyn arashan|no man['’]?s land|karakul|ak baital|kaindy|charyn|almaty|alamaty|karkara)\b/i.test(
    name,
  )
}

function hasMustSee(line: string): boolean {
  return /⭐|\u2b50|★|\bmust see\b/i.test(line)
}

function isMustSeeMarker(line: string): boolean {
  return /^[\s⭐\u2b50★*]+$/.test(line)
}

function isBulletLine(line: string): boolean {
  return /^[-•*]\s+/.test(line)
}

function stripBullet(line: string): string {
  return line.replace(/^[-•*]\s+/, '').trim()
}

function isPlaceTitleLine(line: string, nextLine?: string, pendingMustSee = false): boolean {
  const clean = cleanName(line)
  if (!clean || clean.length < 3 || clean.length > 100) return false
  if (isBulletLine(line) || isSectionHeader(line) || isInstructionLine(line) || isMustSeeMarker(line)) return false
  if (/[.!?]$/.test(clean)) return false
  if (/^\d/.test(clean)) return false
  if (!/[A-Z]/.test(clean[0])) return false

  const lower = clean.toLowerCase()
  if (
    /\b(?:guide|option|booking|permit|permits?|route|routes|sunlight|moon|ordered|dependent|arrange|leave|only way|same direction|roughly|probably|according|best to|take days|more solitude|highly recommended|source|notes?)\b/.test(
      lower,
    )
  ) {
    return false
  }
  if (clean.split(/\s+/).length > 8 && !/[,&+]/.test(clean)) return false
  return pendingMustSee || knownCentralAsiaPlace(clean) || !nextLine || isBulletLine(nextLine) || isMustSeeMarker(nextLine) || isSectionHeader(nextLine)
}

function isBulletPlaceTitle(line: string): boolean {
  if (!isPlaceTitleLine(line, undefined, false)) return false
  const words = line.split(/\s+/)
  if (words.length > 3) return false
  if (
    /\b(?:also|eagles|great|only|ideally|take|more|there|highly|springs|horseback|guide|option|booking|permits?|same|roughly|probably)\b/i.test(
      line,
    )
  ) {
    return false
  }
  return words.every((word) => /^(?:[A-Z][A-Za-z'’-]*|[A-Z]{2,})$/.test(word))
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

function dateRangeFromLine(line: string, trip: Trip): string[] {
  const numeric = line.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*-\s*(?:(\d{1,2})\/)?(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (!numeric) return []
  const startMonth = Number(numeric[1])
  const startDay = Number(numeric[2])
  const endMonth = Number(numeric[4] ?? numeric[1])
  const endDay = Number(numeric[5])
  const baseYear = new Date(`${trip.startDate}T00:00:00`).getFullYear()
  const startYear = numeric[3] ? normalizeYear(numeric[3]) : baseYear
  const endYear = numeric[6] ? normalizeYear(numeric[6]) : startYear
  const start = new Date(startYear, startMonth - 1, startDay)
  const end = new Date(endYear, endMonth - 1, endDay)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return []

  const dates: string[] = []
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(isoDate(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()))
  }
  return dates.map((date) => clampDate(date, trip))
}

function checkoutDate(line: string, trip: Trip): string | null {
  const dates = regexMatches(line, /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return trip.startDate
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
  return regexMatches(line, /\b(?:(\d{1,2})(?::(\d{2}))?\s*(am|pm)|(\d{1,2}):(\d{2}))\b/gi)
    .map((match) => toTime(match[1] ?? match[4], match[2] ?? match[5], match[3]))
    .filter(Boolean)
}

function regexMatches(value: string, pattern: RegExp): RegExpExecArray[] {
  const result: RegExpExecArray[] = []
  const baseFlags = regexFlags(pattern)
  const flags = baseFlags.indexOf('g') >= 0 ? baseFlags : `${baseFlags}g`
  const regex = new RegExp(pattern.source, flags)
  let match: RegExpExecArray | null
  while ((match = regex.exec(value)) !== null) {
    result.push(match)
    if (match[0] === '') regex.lastIndex += 1
  }
  return result
}

function ensurePdfJsCompatibility(): void {
  type PromiseWithResolvers = PromiseConstructor & {
    withResolvers?: <T>() => {
      promise: Promise<T>
      resolve: (value: T | PromiseLike<T>) => void
      reject: (reason?: unknown) => void
    }
  }

  const promiseConstructor = Promise as PromiseWithResolvers
  if (typeof promiseConstructor.withResolvers === 'function') return

  promiseConstructor.withResolvers = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    return { promise, resolve, reject }
  }
}

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read that file.'))
    reader.readAsArrayBuffer(file)
  })
}

function fileToText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Could not read that file.'))
    reader.readAsText(file)
  })
}

function isLikelyMobileSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent
  const isAppleMobile = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return isAppleMobile && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent)
}

function regexFlags(pattern: RegExp): string {
  const flags: string[] = []
  if (pattern.global) flags.push('g')
  if (pattern.ignoreCase) flags.push('i')
  if (pattern.multiline) flags.push('m')
  if (pattern.unicode) flags.push('u')
  if (pattern.sticky) flags.push('y')
  if (pattern.dotAll) flags.push('s')
  return flags.join('')
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function toTime(hourValue: string, minuteValue?: string, meridiem?: string): string {
  let hour = Number(hourValue)
  if (hour > 24) return ''
  if (meridiem?.toLowerCase() === 'pm' && hour < 12) hour += 12
  if (meridiem?.toLowerCase() === 'am' && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${minuteValue ?? '00'}`
}

function airportPair(line: string): [string, string] {
  const fromTo = line.match(/\bfrom\s+(.+?)\s+to\s+([^,;.]+?)(?:\s+and\s+|\s+\d|\s*,|$)/i)
  if (fromTo) return [cleanLocation(fromTo[1]), cleanLocation(fromTo[2])]
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
  return stripImportMarkup(value)
    .replace(/\bAlamaty\b/gi, 'Almaty')
    .replace(/\b(?:confirmation|reservation|check-?in|check-?out|depart(?:ure|s)?|arriv(?:al|es)?)\b.*$/i, '')
    .replace(/\batlas_place_link\b/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '')
    .replace(/[\u2b50â­â˜…?]+$/g, '')
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
  return stripImportMarkup(value)
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

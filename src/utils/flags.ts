import type { Item, Trip } from '../types/trip'

/** Validates/normalizes an ISO 3166-1 alpha-2 country code (e.g. 'jp' -> 'JP').
 * Returns null for missing/invalid input. */
export function normalizeCountryCode(countryCode: string | null | undefined): string | null {
  if (!countryCode || countryCode.trim().length !== 2) return null
  const code = countryCode.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}

export function countryCodesForTrip(trip: Trip, items: Item[] = []): string[] {
  const seen = new Set<string>()
  const codes: string[] = []

  for (const item of [...items].sort((a, b) => `${a.startDate}:${a.position}`.localeCompare(`${b.startDate}:${b.position}`))) {
    const code = normalizeCountryCode(item.countryCode)
    if (!code || seen.has(code)) continue
    seen.add(code)
    codes.push(code)
  }

  const fallback = normalizeCountryCode(trip.countryCode)
  if (fallback && !seen.has(fallback)) codes.push(fallback)
  return codes
}

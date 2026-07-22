/** Validates/normalizes an ISO 3166-1 alpha-2 country code (e.g. 'jp' -> 'JP').
 * Returns null for missing/invalid input. */
export function normalizeCountryCode(countryCode: string | null | undefined): string | null {
  if (!countryCode || countryCode.trim().length !== 2) return null
  const code = countryCode.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}

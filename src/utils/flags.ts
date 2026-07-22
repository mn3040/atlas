/** ISO 3166-1 alpha-2 -> flag emoji, built from Unicode regional indicator
 * symbols (no image assets needed). Returns '' for missing/invalid codes. */
export function flagEmoji(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.trim().length !== 2) return ''
  const code = countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return ''
  const points = [...code].map((c) => 127397 + c.charCodeAt(0))
  return String.fromCodePoint(...points)
}

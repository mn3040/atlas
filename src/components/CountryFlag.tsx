import { normalizeCountryCode } from '../utils/flags'

/** Renders a real flag image from flagcdn.com (free, no key). Unicode flag
 * emoji don't render as flags on Windows -- Segoe UI Emoji has no flag
 * glyphs, so Chrome falls back to showing the bare two-letter country code
 * -- so an emoji-only approach silently breaks for a large share of users. */
export function CountryFlag({
  countryCode,
  className = 'h-3 w-auto rounded-[1px]',
}: {
  countryCode: string | null | undefined
  className?: string
}) {
  const code = normalizeCountryCode(countryCode)
  if (!code) return null
  return (
    <img
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      alt={`${code} flag`}
      className={className}
      loading="lazy"
    />
  )
}

export function CountryFlags({
  countryCodes,
  max = 3,
  className = 'h-3 w-auto rounded-[1px]',
}: {
  countryCodes: string[]
  max?: number
  className?: string
}) {
  const visible = countryCodes.slice(0, max)
  const extra = countryCodes.length - visible.length
  if (visible.length === 0) return null
  return (
    <span className="inline-flex items-center gap-1">
      {visible.map((code) => (
        <CountryFlag key={code} countryCode={code} className={className} />
      ))}
      {extra > 0 && <span className="text-[10px] font-extrabold text-text-dim">+{extra}</span>}
    </span>
  )
}

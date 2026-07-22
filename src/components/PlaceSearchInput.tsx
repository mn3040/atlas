import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../api/googlePlaces'
import { hasGoogleMapsKey } from '../api/googleMapsLoader'
import type { GooglePlaceResult, PlaceSuggestion } from '../api/googlePlaces'

export function PlaceSearchInput({
  placeholder,
  defaultValue,
  onSelect,
}: {
  placeholder: string
  defaultValue?: string
  onSelect: (place: GooglePlaceResult) => void
}) {
  const [query, setQuery] = useState(defaultValue ?? '')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!hasGoogleMapsKey() || query.trim().length < 2) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      searchPlaces(query, controller.signal)
        .then((results) => {
          setSuggestions(results)
          setOpen(true)
        })
        .catch((error) => {
          if (error.name !== 'AbortError') console.error(error)
        })
        .finally(() => setLoading(false))
    }, 350)

    return () => clearTimeout(timer)
  }, [query])

  if (!hasGoogleMapsKey()) {
    return (
      <input
        disabled
        placeholder="Set VITE_GOOGLE_MAPS_API_KEY to search places"
        className="w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text-dim placeholder:text-text-dim"
      />
    )
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-paper focus:outline-none"
      />
      {(loading || resolvingId) && (
        <span className="absolute right-3 top-2.5 text-xs text-text-dim">…</span>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface shadow-2xl">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                disabled={resolvingId === s.placeId}
                onMouseDown={(e) => e.preventDefault()}
                onClick={async () => {
                  setResolvingId(s.placeId)
                  try {
                    const details = await s.fetchDetails()
                    onSelect(details)
                    setQuery(details.label)
                  } catch (error) {
                    console.error(error)
                  } finally {
                    setResolvingId(null)
                    setOpen(false)
                  }
                }}
                className="block w-full truncate px-3 py-2 text-left text-sm text-text hover:bg-surface-2 disabled:opacity-50"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../api/geocoding'
import type { PlaceResult } from '../api/geocoding'

export function PlaceSearchInput({
  placeholder,
  onSelect,
}: {
  placeholder: string
  onSelect: (place: PlaceResult) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      searchPlaces(query, controller.signal)
        .then((places) => {
          setResults(places)
          setOpen(true)
        })
        .catch((error) => {
          if (error.name !== 'AbortError') console.error(error)
        })
        .finally(() => setLoading(false))
    }, 400)

    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-line-2 focus:outline-none"
      />
      {loading && (
        <span className="absolute right-3 top-2.5 font-mono text-xs text-text-dim">…</span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface shadow-lg">
          {results.map((place, index) => (
            <li key={index}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(place)
                  setQuery(place.label)
                  setOpen(false)
                }}
                className="block w-full truncate px-3 py-2 text-left text-sm text-text hover:bg-surface-2"
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { lineColorForIndex } from '../utils/lineColors'
import type { Day, Stop } from '../types/trip'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

export function TripMap({ days, stopsByDay }: { days: Day[]; stopsByDay: Record<string, Stop[]> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [0, 20],
      zoom: 1.5,
    })
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right')

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    const bounds = new maplibregl.LngLatBounds()
    let hasStops = false

    days.forEach((day, dayIndex) => {
      const color = lineColorForIndex(dayIndex)
      const stops = stopsByDay[day.id] ?? []
      stops.forEach((stop) => {
        const el = document.createElement('div')
        el.style.width = '14px'
        el.style.height = '14px'
        el.style.borderRadius = '50%'
        el.style.background = color
        el.style.border = '2px solid #0f1e1b'
        el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.3)'

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([stop.lng, stop.lat])
          .setPopup(new maplibregl.Popup({ offset: 12 }).setText(stop.name))
          .addTo(map)

        markersRef.current.push(marker)
        bounds.extend([stop.lng, stop.lat])
        hasStops = true
      })
    })

    if (hasStops) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 500 })
    }
  }, [days, stopsByDay])

  return <div ref={containerRef} className="h-full w-full rounded-md" />
}

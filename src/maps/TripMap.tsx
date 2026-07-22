import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { lineColorForIndex } from '../utils/lineColors'
import type { Day, Item } from '../types/trip'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const STAY_COLOR = '#f2e9d8'

interface FlightPathFeature {
  type: 'Feature'
  properties: { color: string }
  geometry: { type: 'LineString'; coordinates: [number, number][] }
}

export function TripMap({ days, items }: { days: Day[]; items: Item[] }) {
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

    const dayColor = new Map(days.map((day, index) => [day.id, lineColorForIndex(index)]))

    function render() {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      if (map!.getLayer('flight-paths')) map!.removeLayer('flight-paths')
      if (map!.getSource('flight-paths')) map!.removeSource('flight-paths')

      const bounds = new maplibregl.LngLatBounds()
      let hasPoints = false
      const flightFeatures: FlightPathFeature[] = []

      items.forEach((item) => {
        const color = item.dayId ? dayColor.get(item.dayId) ?? STAY_COLOR : STAY_COLOR

        if (item.type === 'stay') {
          addMarker(map!, item.lat, item.lng, STAY_COLOR, '🛏', item.name, markersRef.current)
          bounds.extend([item.lng, item.lat])
          hasPoints = true
          return
        }

        if (item.type === 'flight') {
          addMarker(map!, item.lat, item.lng, color, '✈', item.name, markersRef.current)
          bounds.extend([item.lng, item.lat])
          hasPoints = true
          if (item.lat2 != null && item.lng2 != null) {
            addMarker(map!, item.lat2, item.lng2, color, '✈', item.name, markersRef.current)
            bounds.extend([item.lng2, item.lat2])
            flightFeatures.push({
              type: 'Feature',
              properties: { color },
              geometry: {
                type: 'LineString',
                coordinates: [
                  [item.lng, item.lat],
                  [item.lng2, item.lat2],
                ],
              },
            })
          }
          return
        }

        addMarker(map!, item.lat, item.lng, color, null, item.name, markersRef.current)
        bounds.extend([item.lng, item.lat])
        hasPoints = true
      })

      if (flightFeatures.length > 0) {
        map!.addSource('flight-paths', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: flightFeatures },
        })
        map!.addLayer({
          id: 'flight-paths',
          type: 'line',
          source: 'flight-paths',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
        })
      }

      if (hasPoints) {
        map!.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 500 })
      }
    }

    if (map.isStyleLoaded()) render()
    else map.once('load', render)
  }, [days, items])

  return <div ref={containerRef} className="h-full w-full rounded-md" />
}

function addMarker(
  map: maplibregl.Map,
  lat: number,
  lng: number,
  color: string,
  emoji: string | null,
  label: string,
  registry: maplibregl.Marker[],
) {
  const el = document.createElement('div')
  el.style.width = '18px'
  el.style.height = '18px'
  el.style.borderRadius = '50%'
  el.style.background = color
  el.style.border = '2px solid #0f1e1b'
  el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.3)'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.fontSize = '10px'
  if (emoji) el.textContent = emoji

  const marker = new maplibregl.Marker({ element: el })
    .setLngLat([lng, lat])
    .setPopup(new maplibregl.Popup({ offset: 12 }).setText(label))
    .addTo(map)

  registry.push(marker)
}

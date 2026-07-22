import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { lineColorForIndex } from '../utils/lineColors'
import type { Day, Item } from '../types/trip'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const STAY_COLOR = '#f2e9d8'
const MUTED_COLOR = '#5a6b65'

interface LineFeature {
  type: 'Feature'
  properties: { color: string }
  geometry: { type: 'LineString'; coordinates: [number, number][] }
}

export function TripMap({
  days,
  items,
  activeDayId,
  selectedItemId,
  onSelectItem,
}: {
  days: Day[]
  items: Item[]
  activeDayId: string | null
  selectedItemId: string | null
  onSelectItem: (id: string) => void
}) {
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
      if (mapRef.current !== map) return
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      ;['route-line', 'flight-line'].forEach((id) => {
        if (map!.getLayer(id)) map!.removeLayer(id)
        if (map!.getSource(id)) map!.removeSource(id)
      })

      const bounds = new maplibregl.LngLatBounds()
      let hasPoints = false
      const routeFeatures: LineFeature[] = []
      const flightFeatures: LineFeature[] = []

      const activeItems = items
        .filter((item) => item.type !== 'stay' && item.dayId === activeDayId)
        .sort((a, b) => a.position - b.position)
      const otherItems = items.filter((item) => item.type !== 'stay' && item.dayId !== activeDayId)
      const stays = items.filter((item) => item.type === 'stay')
      const activeColor = activeDayId ? dayColor.get(activeDayId) ?? MUTED_COLOR : MUTED_COLOR

      let previousExit: [number, number] | null = null
      activeItems.forEach((item, index) => {
        const entry: [number, number] = [item.lng, item.lat]
        const exit: [number, number] = item.type === 'flight' && item.lat2 != null && item.lng2 != null
          ? [item.lng2, item.lat2]
          : entry

        if (previousExit) {
          routeFeatures.push({
            type: 'Feature',
            properties: { color: activeColor },
            geometry: { type: 'LineString', coordinates: [previousExit, entry] },
          })
        }
        if (item.type === 'flight' && exit !== entry) {
          flightFeatures.push({
            type: 'Feature',
            properties: { color: activeColor },
            geometry: { type: 'LineString', coordinates: [entry, exit] },
          })
          addNumberedMarker(map!, entry, index + 1, activeColor, item.name, markersRef.current, {
            selected: item.id === selectedItemId,
            onClick: () => onSelectItem(item.id),
          })
          addIconMarker(map!, exit, activeColor, '✈', item.name, markersRef.current)
          bounds.extend(exit)
        } else {
          addNumberedMarker(map!, entry, index + 1, activeColor, item.name, markersRef.current, {
            selected: item.id === selectedItemId,
            onClick: () => onSelectItem(item.id),
          })
        }

        bounds.extend(entry)
        hasPoints = true
        previousExit = exit
      })

      otherItems.forEach((item) => {
        addMutedMarker(map!, [item.lng, item.lat], markersRef.current)
        if (item.type === 'flight' && item.lat2 != null && item.lng2 != null) {
          addMutedMarker(map!, [item.lng2, item.lat2], markersRef.current)
        }
      })

      stays.forEach((stay) => {
        addIconMarker(map!, [stay.lng, stay.lat], STAY_COLOR, '🛏', stay.name, markersRef.current)
        bounds.extend([stay.lng, stay.lat])
        hasPoints = true
      })

      if (routeFeatures.length > 0) {
        map!.addSource('route-line', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: routeFeatures },
        })
        map!.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-line',
          paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.85 },
        })
      }

      if (flightFeatures.length > 0) {
        map!.addSource('flight-line', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: flightFeatures },
        })
        map!.addLayer({
          id: 'flight-line',
          type: 'line',
          source: 'flight-line',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
        })
      }

      if (hasPoints) {
        map!.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 500 })
      }
    }

    if (map.isStyleLoaded()) render()
    else map.once('load', render)
  }, [days, items, activeDayId, selectedItemId, onSelectItem])

  return <div ref={containerRef} className="h-full w-full" />
}

function addNumberedMarker(
  map: maplibregl.Map,
  lngLat: [number, number],
  number: number,
  color: string,
  label: string,
  registry: maplibregl.Marker[],
  options: { selected: boolean; onClick: () => void },
) {
  const size = options.selected ? 34 : 26
  const wrapper = document.createElement('div')
  wrapper.style.position = 'relative'
  wrapper.style.width = `${size}px`
  wrapper.style.height = `${size}px`
  wrapper.style.cursor = 'pointer'
  if (options.selected) wrapper.className = 'pulse-ring'

  const el = document.createElement('div')
  el.style.position = 'relative'
  el.style.zIndex = '1'
  el.style.width = '100%'
  el.style.height = '100%'
  el.style.borderRadius = '50%'
  el.style.background = color
  el.style.border = '2px solid #0f1e1b'
  el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.fontSize = options.selected ? '14px' : '12px'
  el.style.fontWeight = '600'
  el.style.color = '#0f1e1b'
  el.style.fontFamily = 'var(--font-mono)'
  el.textContent = String(number)
  wrapper.appendChild(el)
  wrapper.addEventListener('click', options.onClick)

  const marker = new maplibregl.Marker({ element: wrapper })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 16 }).setText(label))
    .addTo(map)
  registry.push(marker)
}

function addIconMarker(
  map: maplibregl.Map,
  lngLat: [number, number],
  color: string,
  emoji: string,
  label: string,
  registry: maplibregl.Marker[],
) {
  const el = document.createElement('div')
  el.style.width = '22px'
  el.style.height = '22px'
  el.style.borderRadius = '50%'
  el.style.background = color
  el.style.border = '2px solid #0f1e1b'
  el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.fontSize = '11px'
  el.textContent = emoji

  const marker = new maplibregl.Marker({ element: el })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 14 }).setText(label))
    .addTo(map)
  registry.push(marker)
}

function addMutedMarker(map: maplibregl.Map, lngLat: [number, number], registry: maplibregl.Marker[]) {
  const el = document.createElement('div')
  el.style.width = '9px'
  el.style.height = '9px'
  el.style.borderRadius = '50%'
  el.style.background = MUTED_COLOR
  el.style.border = '1.5px solid #0f1e1b'
  el.style.opacity = '0.7'

  const marker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map)
  registry.push(marker)
}

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as tt from '@tomtom-international/web-sdk-maps'
import { lineColorForIndex } from '../utils/lineColors'
import type { Day, Item } from '../types/trip'

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined

interface LineFeature {
  type: 'Feature'
  properties: { color: string }
  geometry: { type: 'LineString'; coordinates: [number, number][] }
}

export interface TripMapHandle {
  zoomIn: () => void
  zoomOut: () => void
}

export const TripMap = forwardRef<
  TripMapHandle,
  {
    days: Day[]
    items: Item[]
    activeDayId: string | null
    selectedItemId: string | null
    onSelectItem: (id: string) => void
    onZoomChange: (zoom: number) => void
  }
>(function TripMap({ days, items, activeDayId, selectedItemId, onSelectItem, onZoomChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<tt.Map | null>(null)
  const markersRef = useRef<tt.Marker[]>([])
  const readyRef = useRef(false)
  const prevDayRef = useRef(activeDayId)
  const prevSelectedRef = useRef(selectedItemId)

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.easeTo({ zoom: (mapRef.current.getZoom() ?? 12) + 1 }),
    zoomOut: () => mapRef.current?.easeTo({ zoom: (mapRef.current.getZoom() ?? 12) - 1 }),
  }))

  useEffect(() => {
    if (!TOMTOM_API_KEY || !containerRef.current) return

    const map = tt.map({
      key: TOMTOM_API_KEY,
      container: containerRef.current,
      center: [20, 20],
      zoom: 1.5,
    })
    mapRef.current = map

    map.on('load', () => {
      readyRef.current = true
      map.addSource('route-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-line',
        paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.9 },
      })
      map.addSource('flight-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'flight-line',
        type: 'line',
        source: 'flight-line',
        paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [2, 2] },
      })
      render(true)
    })
    map.on('zoom', () => onZoomChange(map.getZoom()))
    map.on('error', (e) => console.error('tomtom map error', e))

    function render(fit: boolean) {
      if (!readyRef.current) return
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      const dayIndex = days.findIndex((d) => d.id === activeDayId)
      const color = dayIndex >= 0 ? lineColorForIndex(dayIndex) : lineColorForIndex(0)
      const dayItems = items
        .filter((item) => item.dayId === activeDayId)
        .sort((a, b) => a.position - b.position)

      const routeCoords: [number, number][] = []
      const flightFeatures: LineFeature[] = []
      const bounds = new tt.LngLatBounds()
      let hasPoints = false

      dayItems.forEach((item, index) => {
        const entry: [number, number] = [item.lng, item.lat]
        routeCoords.push(entry)
        bounds.extend(entry)
        hasPoints = true

        addMarker(map, markersRef.current, entry, index + 1, color, item.id === selectedItemId, () =>
          onSelectItem(item.id),
        )

        if (item.type === 'flight' && item.lat2 != null && item.lng2 != null) {
          const exit: [number, number] = [item.lng2, item.lat2]
          flightFeatures.push({
            type: 'Feature',
            properties: { color },
            geometry: { type: 'LineString', coordinates: [entry, exit] },
          })
          addMutedMarker(map, markersRef.current, exit)
          bounds.extend(exit)
        }
      })

      const routeSource = map.getSource('route-line') as tt.GeoJSONSource | undefined
      routeSource?.setData({
        type: 'FeatureCollection',
        features:
          routeCoords.length > 1
            ? [{ type: 'Feature', properties: { color }, geometry: { type: 'LineString', coordinates: routeCoords } }]
            : [],
      })
      const flightSource = map.getSource('flight-line') as tt.GeoJSONSource | undefined
      flightSource?.setData({ type: 'FeatureCollection', features: flightFeatures })

      if (fit && hasPoints) {
        map.fitBounds(bounds, { padding: 90, maxZoom: 15, duration: 0 })
      }
    }

    ;(map as unknown as { __render?: (fit: boolean) => void }).__render = render

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // Map is created once; day/item/selection updates are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const render = (map as unknown as { __render?: (fit: boolean) => void } | null)?.__render
    if (!map || !render || !readyRef.current) return

    const dayChanged = prevDayRef.current !== activeDayId
    const selectionChanged = prevSelectedRef.current !== selectedItemId
    render(dayChanged)
    if (!dayChanged && selectionChanged) {
      const item = items.find((i) => i.id === selectedItemId)
      // The SDK's flyTo() type omits center/zoom despite supporting them at runtime
      // (it's inherited from CameraOptions, like easeTo/fitBounds) — cast around it.
      if (item) {
        type FlyToOptions = Parameters<typeof map.easeTo>[0] & { curve?: number }
        map.flyTo({ center: [item.lng, item.lat], zoom: Math.max(map.getZoom(), 13) } as FlyToOptions)
      }
    }
    prevDayRef.current = activeDayId
    prevSelectedRef.current = selectedItemId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, items, activeDayId, selectedItemId])

  if (!TOMTOM_API_KEY) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-map-bg">
        <div className="max-w-[320px] rounded-2xl border border-border-strong bg-surface px-6 py-5 text-center">
          <p className="mb-1.5 text-[13.5px] font-bold text-text">Live map needs a TomTom API key</p>
          <p className="text-[11.5px] leading-relaxed text-text-dim">
            Set <code className="text-text">VITE_TOMTOM_API_KEY</code> in your .env file to load the interactive
            map.
          </p>
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className="map-invert absolute inset-0" />
})

function addMarker(
  map: tt.Map,
  registry: tt.Marker[],
  lngLat: [number, number],
  number: number,
  color: string,
  selected: boolean,
  onClick: () => void,
) {
  const size = selected ? 30 : 22
  const wrapper = document.createElement('div')
  wrapper.style.position = 'relative'
  wrapper.style.width = `${size}px`
  wrapper.style.height = `${size}px`
  wrapper.style.cursor = 'pointer'
  wrapper.style.filter = 'invert(1) hue-rotate(180deg)'
  if (selected) wrapper.className = 'pulse-ring'

  const el = document.createElement('div')
  el.style.position = 'relative'
  el.style.zIndex = '1'
  el.style.width = '100%'
  el.style.height = '100%'
  el.style.borderRadius = '50%'
  el.style.background = color
  el.style.border = '2px solid #17191f'
  el.style.boxShadow = '0 3px 8px rgba(0,0,0,.4)'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.fontSize = selected ? '13px' : '11px'
  el.style.fontWeight = '700'
  el.style.color = '#fff'
  el.style.fontFamily = 'Inter, sans-serif'
  el.textContent = String(number)
  wrapper.appendChild(el)
  wrapper.addEventListener('click', onClick)

  const marker = new tt.Marker({ element: wrapper }).setLngLat(lngLat).addTo(map)
  registry.push(marker)
}

function addMutedMarker(map: tt.Map, registry: tt.Marker[], lngLat: [number, number]) {
  const el = document.createElement('div')
  el.style.width = '10px'
  el.style.height = '10px'
  el.style.borderRadius = '50%'
  el.style.background = '#5b6b8c'
  el.style.border = '1.5px solid #17191f'
  el.style.filter = 'invert(1) hue-rotate(180deg)'

  const marker = new tt.Marker({ element: el }).setLngLat(lngLat).addTo(map)
  registry.push(marker)
}

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as tt from '@tomtom-international/web-sdk-maps'
import { lineColorForIndex, textColorForLine } from '../utils/lineColors'
import { fetchRoute, isRoutable } from '../api/tomtomRouting'
import type { Day, Item } from '../types/trip'
import type { TravelMode } from '../utils/distance'

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined

interface LineFeature {
  type: 'Feature'
  properties: { color: string }
  geometry: { type: 'LineString'; coordinates: [number, number][] }
}

export interface TripMapHandle {
  resize: () => void
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
    travelMode: TravelMode
    onSelectItem: (id: string) => void
    onZoomChange: (zoom: number) => void
  }
>(function TripMap({ days, items, activeDayId, selectedItemId, travelMode, onSelectItem, onZoomChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<tt.Map | null>(null)
  const markersRef = useRef<tt.Marker[]>([])
  const readyRef = useRef(false)
  const prevDayRef = useRef(activeDayId)
  const prevSelectedRef = useRef(selectedItemId)
  const prevDaySignatureRef = useRef(daySignature(items, activeDayId))
  const travelModeRef = useRef(travelMode)
  const routeRequestRef = useRef(0)
  const flightAnimationFramesRef = useRef<number[]>([])
  travelModeRef.current = travelMode

  // render() below is created once (mount-only effect) but must always see the
  // latest props -- a plain closure over days/items/etc. would go stale the
  // moment a new item is added or a different item is selected. Refreshing
  // this ref every render keeps render() reading current data without
  // needing to be recreated (and re-bound to the map) on every prop change.
  const latestRef = useRef({ days, items, activeDayId, selectedItemId, onSelectItem })
  latestRef.current = { days, items, activeDayId, selectedItemId, onSelectItem }

  useImperativeHandle(ref, () => ({
    resize: () => mapRef.current?.resize(),
    zoomIn: () => mapRef.current?.easeTo({ zoom: (mapRef.current.getZoom() ?? 12) + 1 }),
    zoomOut: () => mapRef.current?.easeTo({ zoom: (mapRef.current.getZoom() ?? 12) - 1 }),
  }))

  useEffect(() => {
    if (!TOMTOM_API_KEY || !containerRef.current) return

    const flightAnimationFrames = flightAnimationFramesRef.current
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
      const { days, items, activeDayId, selectedItemId, onSelectItem } = latestRef.current
      clearFlightAnimations(flightAnimationFrames)
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      const dayIndex = days.findIndex((d) => d.id === activeDayId)
      const color = dayIndex >= 0 ? lineColorForIndex(dayIndex) : lineColorForIndex(0)
      const dayItems = items
        .filter((item) => item.dayId === activeDayId && item.type !== 'stay')
        .sort((a, b) => a.position - b.position)

      const routeCoords: [number, number][] = []
      const flightFeatures: LineFeature[] = []
      const bounds = new tt.LngLatBounds()
      let hasPoints = false

      dayItems.forEach((item, index) => {
        const entry: [number, number] = [item.lng, item.lat]
        const onward: [number, number] =
          item.type === 'flight' && item.lat2 != null && item.lng2 != null ? [item.lng2, item.lat2] : entry
        routeCoords.push(onward)
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
          addAnimatedFlightMarker(
            map,
            markersRef.current,
            flightAnimationFrames,
            entry,
            exit,
            color,
            item.id === selectedItemId,
            () => onSelectItem(item.id),
          )
          bounds.extend(exit)
        }
      })

      const routeSource = map.getSource('route-line') as tt.GeoJSONSource | undefined
      const requestId = ++routeRequestRef.current
      const setRouteLine = (coords: [number, number][]) =>
        routeSource?.setData({
          type: 'FeatureCollection',
          features:
            coords.length > 1
              ? [{ type: 'Feature', properties: { color }, geometry: { type: 'LineString', coordinates: coords } }]
              : [],
        })
      setRouteLine(routeCoords)

      const flightSource = map.getSource('flight-line') as tt.GeoJSONSource | undefined
      flightSource?.setData({ type: 'FeatureCollection', features: flightFeatures })

      if (fit && hasPoints) {
        map.fitBounds(bounds, { padding: 150, maxZoom: 15, duration: 0 })
      }

      // Straight line above is the instant baseline; upgrade it to a real
      // road/path-following route once the routing API responds.
      const mode = travelModeRef.current
      if (isRoutable(mode) && dayItems.length > 1) {
        fetchRoute(
          dayItems.map((item) => ({ lat: item.lat, lng: item.lng })),
          mode,
        ).then((routed) => {
          if (routed && routeRequestRef.current === requestId) setRouteLine(routed)
        })
      }
    }

    ;(map as unknown as { __render?: (fit: boolean) => void }).__render = render

    return () => {
      clearFlightAnimations(flightAnimationFrames)
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
    const signature = daySignature(items, activeDayId)
    const dayItemsChanged = prevDaySignatureRef.current !== signature
    render(dayChanged || dayItemsChanged)
    if (!dayChanged && !dayItemsChanged && selectionChanged) {
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
    prevDaySignatureRef.current = signature
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, items, activeDayId, selectedItemId, travelMode])

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

function daySignature(items: Item[], activeDayId: string | null): string {
  return items
    .filter((item) => item.dayId === activeDayId && item.type !== 'stay')
    .sort((a, b) => a.position - b.position)
    .map((item) => `${item.id}:${item.position}:${item.lat}:${item.lng}:${item.lat2 ?? ''}:${item.lng2 ?? ''}`)
    .join('|')
}

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
  // Counter-act .map-invert on the map container so the marker keeps its
  // real color instead of inverting along with the map tiles.
  wrapper.style.filter = 'invert(1) hue-rotate(180deg)'
  if (selected) wrapper.className = 'pulse-ring'

  const el = document.createElement('div')
  el.style.position = 'relative'
  el.style.zIndex = '1'
  el.style.width = '100%'
  el.style.height = '100%'
  el.style.borderRadius = '50%'
  el.style.background = color
  el.style.border = '2px solid #ffffff'
  el.style.boxShadow = '0 0 0 1px #111111'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.fontSize = selected ? '13px' : '11px'
  el.style.fontWeight = '700'
  el.style.color = textColorForLine(color)
  el.style.fontFamily = 'Helvetica Neue, Helvetica, Arial, sans-serif'
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
  el.style.background = '#777983'
  el.style.border = '1.5px solid #ffffff'
  el.style.filter = 'invert(1) hue-rotate(180deg)'

  const marker = new tt.Marker({ element: el }).setLngLat(lngLat).addTo(map)
  registry.push(marker)
}

function addAnimatedFlightMarker(
  map: tt.Map,
  registry: tt.Marker[],
  animationFrames: number[],
  from: [number, number],
  to: [number, number],
  color: string,
  selected: boolean,
  onClick: () => void,
) {
  const el = document.createElement('button')
  el.type = 'button'
  el.setAttribute('aria-label', 'Select flight')
  el.style.width = selected ? '34px' : '28px'
  el.style.height = selected ? '34px' : '28px'
  el.style.border = selected ? '2px solid #f7ff88' : '1px solid rgba(255, 255, 255, 0.85)'
  el.style.borderRadius = '999px'
  el.style.background = '#070606'
  el.style.color = color
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.padding = '0'
  el.style.cursor = 'pointer'
  el.style.boxShadow = selected
    ? '0 0 0 4px rgba(247, 255, 136, 0.18), 0 12px 28px rgba(0, 0, 0, 0.32)'
    : '0 8px 20px rgba(0, 0, 0, 0.28)'
  el.style.filter = 'invert(1) hue-rotate(180deg)'
  const bearing = bearingDegrees(from, to)
  el.innerHTML = `
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="transform: rotate(${bearing}deg); transform-origin: center;">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" fill="currentColor"/>
    </svg>
  `
  el.addEventListener('click', onClick)

  const marker = new tt.Marker({ element: el }).setLngLat(from).addTo(map)
  registry.push(marker)

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    marker.setLngLat(interpolateLngLat(from, to, 0.55))
    return
  }

  const distance = haversineKm(from, to)
  const duration = Math.min(11000, Math.max(4200, distance * 12))
  const startedAt = performance.now()
  const frameSlot = animationFrames.length
  animationFrames.push(0)

  const tick = (time: number) => {
    const rawProgress = ((time - startedAt) % duration) / duration
    const easedProgress = rawProgress < 0.5 ? 2 * rawProgress * rawProgress : 1 - (-2 * rawProgress + 2) ** 2 / 2
    marker.setLngLat(interpolateLngLat(from, to, easedProgress))
    animationFrames[frameSlot] = requestAnimationFrame(tick)
  }

  animationFrames[frameSlot] = requestAnimationFrame(tick)
}

function clearFlightAnimations(animationFrames: number[]) {
  animationFrames.forEach((frame) => cancelAnimationFrame(frame))
  animationFrames.length = 0
}

function interpolateLngLat(from: [number, number], to: [number, number], progress: number): [number, number] {
  return [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress]
}

function bearingDegrees(from: [number, number], to: [number, number]): number {
  const fromLat = toRadians(from[1])
  const toLat = toRadians(to[1])
  const lngDelta = toRadians(to[0] - from[0])
  const y = Math.sin(lngDelta) * Math.cos(toLat)
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(lngDelta)
  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

function haversineKm(from: [number, number], to: [number, number]): number {
  const radiusKm = 6371
  const latDelta = toRadians(to[1] - from[1])
  const lngDelta = toRadians(to[0] - from[0])
  const fromLat = toRadians(from[1])
  const toLat = toRadians(to[1])
  const a =
    Math.sin(latDelta / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI
}

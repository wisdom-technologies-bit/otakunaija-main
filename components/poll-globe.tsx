'use client'

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Maximize2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Location = { name: string; code: string | null; count: number }

export function PollGlobe({ locations }: { locations: Location[] }) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [failed, setFailed] = useState(false)
  const points = locations.slice(0, 20).map((location, index) => ({ type: 'Feature', properties: { name: location.name, count: location.count }, geometry: { type: 'Point', coordinates: [index * 24 - 150, Math.min(55, 8 + index * 4)] } }))

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !locations.length) return
    const map = new maplibregl.Map({ container: containerRef.current, style: 'https://demotiles.maplibre.org/globe.json', center: [8, 12], zoom: 1.15 })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')
    map.on('error', () => setFailed(true))
    map.on('load', () => {
      map.setProjection({ type: 'globe' })
      map.addSource('poll-responses', { type: 'geojson', data: { type: 'FeatureCollection', features: points } as any })
      map.addLayer({ id: 'poll-response-glow', type: 'circle', source: 'poll-responses', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 5, 20, 16], 'circle-color': '#ff5b35', 'circle-opacity': 0.2, 'circle-blur': 0.8 } })
      map.addLayer({ id: 'poll-responses', type: 'circle', source: 'poll-responses', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 3, 20, 10], 'circle-color': '#ff6b3d', 'circle-stroke-color': '#fff5', 'circle-stroke-width': 1 } })
      map.on('click', 'poll-responses', (event) => { const feature = event.features?.[0]; if (!feature) return; new maplibregl.Popup({ closeButton: true, closeOnClick: true }).setLngLat((feature.geometry as { coordinates: [number, number] }).coordinates).setHTML(`<strong>${feature.properties?.name}</strong><br/>${feature.properties?.count} recorded responses`).addTo(map) })
      map.on('mouseenter', 'poll-responses', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'poll-responses', () => { map.getCanvas().style.cursor = '' })
    })
    return () => { map.remove(); mapRef.current = null }
  }, [locations])

  useEffect(() => { requestAnimationFrame(() => mapRef.current?.resize()) }, [expanded])
  if (!locations.length || failed) return <div className="flex min-h-72 items-center justify-center rounded-xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">Interactive geography is unavailable. See the location list below.</div>
  return <>
    <div className={expanded ? 'fixed inset-3 z-50 rounded-2xl border border-border bg-background p-2 shadow-2xl md:inset-8' : 'relative h-[300px] overflow-hidden rounded-xl sm:h-[360px]'}>
      <div ref={containerRef} className="size-full overflow-hidden rounded-lg" aria-label="Interactive globe showing aggregated poll responses" />
      <Button variant="secondary" size="icon" className="absolute bottom-3 right-3 size-9" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? 'Close expanded map' : 'Explore map'}>{expanded ? <X className="size-4" /> : <Maximize2 className="size-4" />}</Button>
    </div>
    {expanded ? <div className="fixed inset-0 z-40 bg-background/80" onClick={() => setExpanded(false)} aria-hidden="true" /> : null}
  </>
}

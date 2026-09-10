'use client'

import { useEffect, useRef, useState } from 'react'
import createGlobe, { type Globe } from 'cobe'
import { Maximize2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Location = { name: string; code: string | null; count: number }
type Coordinates = [number, number]

const COUNTRY_COORDINATES: Record<string, Coordinates> = {
  Nigeria: [9.082, 8.6753], 'United States': [37.0902, -95.7129], 'United States of America': [37.0902, -95.7129], 'New Zealand': [-40.9006, 174.886], 'United Kingdom': [55.3781, -3.436], Canada: [56.1304, -106.3468], India: [20.5937, 78.9629], Germany: [51.1657, 10.4515], France: [46.2276, 2.2137], Brazil: [-14.235, -51.9253], 'South Africa': [-30.5595, 22.9375], Australia: [-25.2744, 133.7751], Japan: [36.2048, 138.2529],
}

function toMarker(location: Location, maxCount: number) {
  const coordinates = COUNTRY_COORDINATES[location.name]
  if (!coordinates) return null
  return { location: coordinates, size: 0.04 + Math.min(location.count / Math.max(maxCount, 1), 1) * 0.075 }
}

export function PollGlobe({ locations }: { locations: Location[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<Globe | null>(null)
  const phiRef = useRef(0)
  const dragRef = useRef({ active: false, lastX: 0, velocity: 0 })
  const [expanded, setExpanded] = useState(false)
  const [failed, setFailed] = useState(false)
  const maxCount = Math.max(...locations.map((location) => location.count), 1)

  useEffect(() => {
    const canvas = canvasRef.current
    const shell = shellRef.current
    if (!canvas || !shell) return
    let frame = 0
    let globe: Globe | null = null
    const render = () => {
      const size = Math.min(shell.clientWidth, shell.clientHeight || shell.clientWidth)
      if (!size) return
      try {
        globe = createGlobe(canvas, {
          devicePixelRatio: Math.min(window.devicePixelRatio, 2),
          width: size * 2,
          height: size * 2,
          phi: phiRef.current,
          theta: 0.25,
          dark: 1,
          diffuse: 1.45,
          mapSamples: 16000,
          mapBrightness: 5,
          baseColor: [0.12, 0.13, 0.16],
          markerColor: [1, 0.42, 0.24],
          glowColor: [0.75, 0.78, 0.86],
          markers: locations.slice(0, 24).map((location) => toMarker(location, maxCount)).filter(Boolean) as { location: Coordinates; size: number }[],
        })
        globeRef.current = globe
        const animate = () => {
          const drag = dragRef.current
          if (!drag.active) phiRef.current += 0.004
          else phiRef.current += drag.velocity
          drag.velocity *= 0.92
          globe?.update({ phi: phiRef.current })
          frame = requestAnimationFrame(animate)
        }
        animate()
      } catch {
        setFailed(true)
      }
    }
    frame = requestAnimationFrame(render)
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      globe?.destroy()
      globe = null
      globeRef.current = null
      frame = requestAnimationFrame(render)
    })
    observer.observe(shell)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      globe?.destroy()
      globeRef.current?.destroy()
      globeRef.current = null
    }
  }, [expanded, locations, maxCount])

  if (failed) return <div className="flex min-h-72 items-center justify-center rounded-2xl border border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">Interactive geography is unavailable. See the location list below.</div>

  const content = <div ref={shellRef} className="relative flex size-full items-center justify-center overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_50%_48%,hsl(var(--primary)/.12),transparent_48%)]"><canvas ref={canvasRef} className="aspect-square size-full max-w-[min(100%,720px)] cursor-grab touch-none active:cursor-grabbing" aria-label="Interactive globe showing aggregated poll responses" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { active: true, lastX: event.clientX, velocity: 0 } }} onPointerMove={(event) => { const drag = dragRef.current; if (!drag.active) return; const delta = event.clientX - drag.lastX; drag.lastX = event.clientX; drag.velocity = delta * 0.004; phiRef.current -= delta * 0.004 }} onPointerUp={() => { dragRef.current.active = false }} onPointerCancel={() => { dragRef.current.active = false }} /></div>
  return <>
    <div className={expanded ? 'fixed inset-3 z-50 rounded-3xl border border-border bg-background p-2 shadow-2xl md:inset-8' : 'relative h-[300px] overflow-hidden rounded-2xl border border-border/70 sm:h-[360px]'}>{content}<Button variant="secondary" size="icon" className="absolute bottom-4 right-4 size-9 border border-border/70 bg-background/80 shadow-lg backdrop-blur" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? 'Close expanded map' : 'Explore map'}>{expanded ? <X /> : <Maximize2 />}</Button></div>
    {expanded ? <button type="button" className="fixed inset-0 z-40 cursor-default bg-background/80 backdrop-blur-sm" onClick={() => setExpanded(false)} aria-label="Close expanded map" /> : null}
  </>
}

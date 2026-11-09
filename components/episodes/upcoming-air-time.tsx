"use client"

import { useEffect, useState } from "react"
import { LAGOS_TIME_ZONE } from "@/lib/format-date"
import { timeInZone } from "@/lib/anilist/upcoming"

/**
 * Air time in the viewer's own time zone, falling back to Africa/Lagos.
 *
 * The first render is always the Lagos label so server and client markup
 * match; the effect then swaps in the visitor's zone. No hydration warnings,
 * and a visitor without Intl time zone support still sees a real time.
 */
export function UpcomingAirTime({ airingAt, className }: { airingAt: string; className?: string }) {
  const fallback = format(airingAt, LAGOS_TIME_ZONE)
  const [viewer, setViewer] = useState<string | null>(null)

  useEffect(() => {
    let zone = LAGOS_TIME_ZONE
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || LAGOS_TIME_ZONE
    } catch {
      zone = LAGOS_TIME_ZONE
    }
    setViewer(zone === LAGOS_TIME_ZONE ? fallback : format(airingAt, zone))
  }, [airingAt, fallback])

  return (
    <time dateTime={airingAt} className={className} suppressHydrationWarning>
      {viewer ?? fallback}
    </time>
  )
}

function format(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  try {
    const { time, zone } = timeInZone(date, timeZone)
    return zone ? `${time} ${zone}` : time
  } catch {
    return iso.slice(11, 16)
  }
}

export default UpcomingAirTime

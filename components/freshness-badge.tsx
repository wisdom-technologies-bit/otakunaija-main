"use client"

import { useEffect, useState } from "react"

type FreshnessBadgeProps = {
  publishedAt: string | Date | null | undefined
  /** Hours after publishing the badge stays visible. */
  windowHours: number
  label?: string
  className?: string
  /** Server-computed value so the first paint already shows the chip. */
  initial?: boolean
}

/**
 * "New" chip driven by a pure time window. The server value paints first and
 * the client recomputes after mount, so the label never hydrates with a
 * different tree than it rendered.
 */
export function FreshnessBadge({
  publishedAt,
  windowHours,
  label = "New",
  className = "otk-chip otk-chip-new",
  initial = false,
}: FreshnessBadgeProps) {
  const [isFresh, setIsFresh] = useState(initial)

  useEffect(() => {
    if (!publishedAt) {
      setIsFresh(false)
      return
    }
    const time = publishedAt instanceof Date ? publishedAt.getTime() : new Date(publishedAt).getTime()
    if (Number.isNaN(time)) {
      setIsFresh(false)
      return
    }
    const age = Date.now() - time
    setIsFresh(age >= 0 && age < windowHours * 60 * 60 * 1000)
  }, [publishedAt, windowHours])

  if (!isFresh) return null
  return (
    <span className={className} data-freshness="new">
      {label}
    </span>
  )
}

export default FreshnessBadge

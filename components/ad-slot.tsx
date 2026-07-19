"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

type AdSlotProps = {
  slot: "header" | "in-article" | "sidebar" | "footer"
  label?: string
  className?: string
}

const SIZES: Record<AdSlotProps["slot"], string> = {
  header: "h-24 md:h-28",
  "in-article": "h-32 md:h-40",
  sidebar: "h-64",
  footer: "h-24 md:h-28",
}

const ZONE_IDS: Record<AdSlotProps["slot"], string | undefined> = {
  header: process.env.NEXT_PUBLIC_MONETAG_ZONE_HEADER,
  "in-article": process.env.NEXT_PUBLIC_MONETAG_ZONE_IN_ARTICLE,
  sidebar: process.env.NEXT_PUBLIC_MONETAG_ZONE_SIDEBAR,
  footer: process.env.NEXT_PUBLIC_MONETAG_ZONE_FOOTER,
}

export function AdSlot({ slot, label = "Sponsored", className }: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const zoneId = ZONE_IDS[slot]

  useEffect(() => {
    if (!zoneId || !containerRef.current) return
    // PASTE_MONETAG_SCRIPT_LOGIC_HERE — see step 7 below for exact replacement
  }, [zoneId])

  if (!zoneId) {
    return (
      <aside
        aria-label={label}
        data-ad-slot={slot}
        className={cn(
          "flex w-full items-center justify-center rounded-lg border border-dashed border-border bg-card/40 text-xs font-medium uppercase tracking-widest text-muted-foreground",
          SIZES[slot],
          className,
        )}
      >
        <span>{label}</span>
      </aside>
    )
  }

  return (
    <div
      ref={containerRef}
      aria-label={label}
      data-ad-slot={slot}
      className={cn("flex w-full items-center justify-center", SIZES[slot], className)}
    />
  )
}
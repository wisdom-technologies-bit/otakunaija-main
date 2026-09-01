"use client"

import { useEffect, useRef, useState } from "react"
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
  const [collapsed, setCollapsed] = useState(!zoneId)

  useEffect(() => {
    if (!zoneId || !containerRef.current) return

    const container = containerRef.current
    const isDesktopHeader = slot === "header" && window.matchMedia("(min-width: 768px)").matches
    if (isDesktopHeader) {
      setCollapsed(true)
      return
    }

    let hasAdContent = false
    const observer = new MutationObserver(() => {
      hasAdContent = Array.from(container.childNodes).some((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) return (node as Element).tagName !== "SCRIPT"
        return Boolean(node.textContent?.trim().length)
      })
      if (hasAdContent) observer.disconnect()
    })
    observer.observe(container, { childList: true, subtree: true, characterData: true })

    const collapseTimer = window.setTimeout(() => {
      if (!hasAdContent) setCollapsed(true)
      observer.disconnect()
    }, 5000)

    const script = document.createElement("script")
    script.async = true
    script.referrerPolicy = "no-referrer-when-downgrade"
    script.src = zoneId
    container.appendChild(script)

    return () => {
      window.clearTimeout(collapseTimer)
      observer.disconnect()
      if (container.contains(script)) container.removeChild(script)
    }
  }, [slot, zoneId])

  if (collapsed) return null

  return (
    <div
      ref={containerRef}
      aria-label={label}
      data-ad-slot={slot}
      className={cn(
        "flex w-full items-center justify-center",
        slot === "header" && "md:hidden",
        SIZES[slot],
        className,
      )}
    />
  )
}

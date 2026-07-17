"use client"

import { useEffect } from "react"

export function HideV0Badge() {
  useEffect(() => {
    const interval = setInterval(() => {
      const badge = document.querySelector('[class*="v0"], [id*="v0"], a[href*="v0.app"]')
      if (badge) {
        badge.remove()
        clearInterval(interval)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return null
}


"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

const STORAGE_PREFIX = "otakunaija-scroll:"

export function ScrollToTop() {
  const pathname = usePathname()
  const currentPathRef = useRef(pathname)
  const initializedRef = useRef(false)
  const isPopStateRef = useRef(false)

  useEffect(() => {
    const savePosition = (path: string) => {
      try {
        sessionStorage.setItem(
          STORAGE_PREFIX + path,
          JSON.stringify({
            x: window.scrollX,
            y: window.scrollY,
          }),
        )
      } catch {
        // Ignore unavailable session storage.
      }
    }

    const handleScroll = () => {
      savePosition(currentPathRef.current)
    }

    const handlePopState = () => {
      savePosition(currentPathRef.current)
      isPopStateRef.current = true
    }

    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = "manual"

    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("popstate", handlePopState)

    return () => {
      savePosition(currentPathRef.current)
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("popstate", handlePopState)
      window.history.scrollRestoration = previousRestoration
    }
  }, [])

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      currentPathRef.current = pathname
      return
    }

    currentPathRef.current = pathname

    if (isPopStateRef.current) {
      isPopStateRef.current = false

      let savedPosition: { x: number; y: number } | null = null

      try {
        const saved = sessionStorage.getItem(STORAGE_PREFIX + pathname)
        savedPosition = saved ? JSON.parse(saved) : null
      } catch {
        savedPosition = null
      }

      requestAnimationFrame(() => {
        if (savedPosition) {
          window.scrollTo({
            left: savedPosition.x,
            top: savedPosition.y,
            behavior: "instant",
          })
        } else {
          window.scrollTo(0, 0)
        }
      })

      return
    }

    window.scrollTo({
      left: 0,
      top: 0,
      behavior: "instant",
    })
  }, [pathname])

  return null
}

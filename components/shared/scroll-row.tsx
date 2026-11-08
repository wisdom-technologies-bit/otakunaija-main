"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type ScrollRowProps = {
  children: ReactNode
  ariaLabel: string
  className?: string
  railClassName?: string
  /** Arrows are desktop only and never shown when there is nothing to scroll. */
  arrows?: boolean
  fade?: boolean
}

/**
 * Client shell that adds desktop arrows around a server-rendered scroll-snap
 * rail. Arrows only render as visible when the rail can actually scroll.
 */
export function ScrollRow({
  children,
  ariaLabel,
  className,
  railClassName,
  arrows = true,
  fade = false,
}: ScrollRowProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const element = viewportRef.current
    if (!element) return
    const max = element.scrollWidth - element.clientWidth
    setCanScroll({
      left: element.scrollLeft > 8,
      right: max > 8 && element.scrollLeft < max - 8,
    })
  }, [])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    measure()
    element.addEventListener("scroll", measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      element.removeEventListener("scroll", measure)
      observer.disconnect()
    }
  }, [measure])

  const scrollByPage = (direction: 1 | -1) => {
    const element = viewportRef.current
    if (!element) return
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    element.scrollBy({
      left: direction * element.clientWidth * 0.85,
      behavior: reduce ? "auto" : "smooth",
    })
  }

  return (
    <div className={cn("otk-rail-wrap", className)}>
      <div
        ref={viewportRef}
        role="group"
        aria-label={ariaLabel}
        tabIndex={0}
        className={cn("otk-rail", fade && "otk-rail-fade", railClassName)}
      >
        {children}
      </div>
      {arrows ? (
        <>
          <button
            type="button"
            aria-label="Scroll left"
            className="otk-arrow otk-arrow-left otk-focus"
            data-visible={canScroll.left}
            tabIndex={canScroll.left ? 0 : -1}
            onClick={() => scrollByPage(-1)}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            className="otk-arrow otk-arrow-right otk-focus"
            data-visible={canScroll.right}
            tabIndex={canScroll.right ? 0 : -1}
            onClick={() => scrollByPage(1)}
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </>
      ) : null}
    </div>
  )
}

export default ScrollRow

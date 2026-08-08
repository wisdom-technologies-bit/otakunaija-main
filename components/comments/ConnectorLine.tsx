"use client"

import { useEffect, useState } from "react"

interface ConnectorLineProps {
  activeAnnotationId: number | null
}

export function ConnectorLine({ activeAnnotationId }: ConnectorLineProps) {
  const [linePoints, setLinePoints] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  useEffect(() => {
    if (activeAnnotationId === null) {
      setLinePoints(null)
      return
    }

    const updateLine = () => {
      const highlightEl = document.querySelector(`[data-annotation-id="${activeAnnotationId}"]`)
      const panelEl = document.getElementById("comments-pin-panel")
      if (!highlightEl || !panelEl) return

      const highlightRect = highlightEl.getBoundingClientRect()
      const panelRect = panelEl.getBoundingClientRect()

      const x1 = highlightRect.right
      const y1 = highlightRect.top + highlightRect.height / 2
      const x2 = panelRect.left
      const y2 = panelRect.top + panelRect.height / 2

      setLinePoints({ x1, y1, x2, y2 })
    }

    updateLine()
    window.addEventListener("scroll", updateLine, { passive: true })
    window.addEventListener("resize", updateLine)

    return () => {
      window.removeEventListener("scroll", updateLine)
      window.removeEventListener("resize", updateLine)
    }
  }, [activeAnnotationId])

  if (!linePoints) return null

  return (
    <svg
      className="fixed inset-0 pointer-events-none z-40"
      style={{ width: "100vw", height: "100vh" }}
    >
      <line
        x1={linePoints.x1}
        y1={linePoints.y1}
        x2={linePoints.x2}
        y2={linePoints.y2}
        stroke="#FF4C4D"
        strokeWidth="2"
        strokeDasharray="4 4"
        opacity="0.7"
      />
    </svg>
  )
}
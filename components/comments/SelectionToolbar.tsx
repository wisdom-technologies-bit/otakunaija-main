"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, MessageCircle } from "lucide-react"

interface SelectionToolbarProps {
  onComment: (selectedText: string, rangeData: RangeData) => void
}

export interface RangeData {
  text: string
  startOffset: number
  endOffset: number
  contextHash: string
}

export function SelectionToolbar({ onComment }: SelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const toolbarVisibleRef = useRef(false)

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [selectedText, setSelectedText] = useState("")

  useEffect(() => {
    toolbarVisibleRef.current = position !== null
  }, [position])

  // Prevent the browser context menu from appearing on top of our
  // custom toolbar while the selection toolbar is visible.
  useEffect(() => {
    const article = document.querySelector("article")
    if (!article) return

    const preventContextMenu = (e: MouseEvent) => {
      if (toolbarVisibleRef.current) {
        e.preventDefault()
      }
    }

    article.addEventListener("contextmenu", preventContextMenu)

    return () => {
      article.removeEventListener("contextmenu", preventContextMenu)
    }
  }, [])

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setPosition(null)
        return
      }

      const text = selection.toString().trim()
      // Ensure selection is within the article content area
      const article = document.querySelector("article")
      if (!article) return
      const range = selection.getRangeAt(0)
      if (!article.contains(range.commonAncestorContainer)) {
        setPosition(null)
        return
      }

      const rect = range.getBoundingClientRect()

      // The toolbar uses position: fixed, so getBoundingClientRect()
      // is already relative to the viewport. Do not add window.scrollY.
      const x = rect.left + rect.width / 2
      const y = rect.top - 8

      setPosition({ x, y })
      setSelectedText(text)
    }

    document.addEventListener("selectionchange", handleSelectionChange)
    return () => document.removeEventListener("selectionchange", handleSelectionChange)
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedText)
      // Could add a small feedback
    } catch (err) {
      console.error("Copy failed", err)
    }
    setPosition(null) // dismiss toolbar
  }

  const handleCommentClick = () => {
    if (!selectedText) return
    // Calculate offsets relative to the article
    const article = document.querySelector("article")
    if (!article) return

    // Compute plain text of the article and find offsets
    const plainText = article.textContent || ""
    const startOffset = plainText.indexOf(selectedText)
    if (startOffset === -1) {
      // fallback: maybe selection not exact? In that case we can't annotate.
      return
    }
    const endOffset = startOffset + selectedText.length

    // Generate a simple context hash from surrounding text
    const contextStart = Math.max(0, startOffset - 50)
    const contextEnd = Math.min(plainText.length, endOffset + 50)
    const context = plainText.slice(contextStart, contextEnd)
    const contextHash = simpleHash(context)

    const rangeData: RangeData = {
      text: selectedText,
      startOffset,
      endOffset,
      contextHash,
    }

    onComment(selectedText, rangeData)
    setPosition(null) // dismiss toolbar
  }

  if (!position) return null

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 shadow-lg"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -100%)",
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleCopy}
        className="h-7 px-2 text-xs"
      >
        <Copy className="h-3.5 w-3.5 mr-1" />
        Copy
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleCommentClick}
        className="h-7 px-2 text-xs text-primary"
      >
        <MessageCircle className="h-3.5 w-3.5 mr-1" />
        Comment
      </Button>
    </div>
  )
}

// Simple hash function for context matching
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Convert to 32bit integer
  }
  return hash.toString(16)
}
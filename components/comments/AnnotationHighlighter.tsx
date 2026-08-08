"use client"

import { useEffect, useRef } from "react"

interface Annotation {
  id: number
  selectedText: string
  contextHash: string
  startOffset: number
  endOffset: number
  commentId: number
}

interface AnnotationHighlighterProps {
  annotations: Annotation[]
  onAnnotationClick?: (annotationId: number) => void
}

export function AnnotationHighlighter({ annotations, onAnnotationClick }: AnnotationHighlighterProps) {
  const articleRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const article = document.querySelector("article")
    if (!article) return
    articleRef.current = article

    // Clear previous highlights
    article.querySelectorAll(".otaku-annotation-highlight").forEach((el) => {
      const parent = el.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ""), el)
        parent.normalize()
      }
    })

    // Walk through each annotation
    annotations.forEach((ann) => {
      highlightAnnotation(ann, article)
    })
  }, [annotations])

  const highlightAnnotation = (annotation: Annotation, container: HTMLElement) => {
    const plainText = container.textContent || ""
    // Verify offset still matches (text could have changed? unlikely)
    const snippet = plainText.slice(annotation.startOffset, annotation.endOffset)
    if (snippet !== annotation.selectedText) {
      console.warn("Annotation text mismatch, falling back to substring search")
      // Fallback: search for the selected text
      const idx = plainText.indexOf(annotation.selectedText)
      if (idx !== -1) {
        // adjust offsets
        annotation.startOffset = idx
        annotation.endOffset = idx + annotation.selectedText.length
      } else {
        return // cannot find text, skip
      }
    }

    // Find text nodes that contain this range
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
      },
    })

    let currentOffset = 0
    let startNode: Text | null = null
    let startNodeOffset = 0
    let endNode: Text | null = null
    let endNodeOffset = 0

    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const nodeLength = node.textContent?.length || 0
      const nodeEnd = currentOffset + nodeLength

      if (!startNode && annotation.startOffset < nodeEnd) {
        startNode = node
        startNodeOffset = annotation.startOffset - currentOffset
      }
      if (!endNode && annotation.endOffset <= nodeEnd) {
        endNode = node
        endNodeOffset = annotation.endOffset - currentOffset
        break
      }

      currentOffset = nodeEnd
    }

    if (!startNode || !endNode) {
      console.warn("Could not locate text nodes for annotation", annotation.id)
      return
    }

    // Create a span to wrap the text
    const span = document.createElement("span")
    span.className = "otaku-annotation-highlight"
    span.setAttribute("data-annotation-id", String(annotation.id))
    span.style.backgroundColor = "#FF4C4D"
    span.style.opacity = "0.25"
    span.style.borderRadius = "2px"
    span.style.cursor = "pointer"

    // If the selection is within a single node
    if (startNode === endNode) {
      const before = document.createTextNode(startNode.textContent!.slice(0, startNodeOffset))
      const highlight = document.createTextNode(startNode.textContent!.slice(startNodeOffset, endNodeOffset))
      const after = document.createTextNode(startNode.textContent!.slice(endNodeOffset))
      const parent = startNode.parentNode!
      parent.insertBefore(before, startNode)
      parent.insertBefore(span, before.nextSibling)
      span.appendChild(highlight)
      parent.insertBefore(after, span.nextSibling)
      parent.removeChild(startNode)
    } else {
      // Multi-node selection: split start and end nodes
      const parent = startNode.parentNode!

      // Start node
      const beforeStart = document.createTextNode(startNode.textContent!.slice(0, startNodeOffset))
      const startHighlight = document.createTextNode(startNode.textContent!.slice(startNodeOffset))
      parent.insertBefore(beforeStart, startNode)
      parent.insertBefore(span, beforeStart.nextSibling)
      span.appendChild(startHighlight)
      parent.removeChild(startNode)

      // Now move the span through siblings until endNode
      let current = span.nextSibling
      while (current && current !== endNode) {
        const next = current.nextSibling
        span.appendChild(current) // move text node into span
        current = next
      }

      if (current === endNode) {
        const endHighlight = document.createTextNode(endNode.textContent!.slice(0, endNodeOffset))
        span.appendChild(endHighlight)
        const afterEnd = document.createTextNode(endNode.textContent!.slice(endNodeOffset))
        parent.insertBefore(afterEnd, endNode.nextSibling)
        parent.removeChild(endNode)
      }
    }

    // Add click handler for mobile/desktop (we'll handle it in CommentsWidget)
    span.addEventListener("click", () => {
      if (onAnnotationClick) {
        onAnnotationClick(annotation.id)
      }
    })
  }

  return null // This component doesn't render anything directly
}
"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { CommentThread, type CommentData } from "./CommentThread"
import { useAuth } from "./AuthProvider"

interface PinPanelProps {
  activeAnnotationId: number | null
  comments: CommentData[] // The root comment of the active annotation
  onClose: () => void
  onReply: (parentId: number, body: string) => Promise<void>
  onLike: (commentId: number) => Promise<void>
  onReact: (commentId: number, type: string) => Promise<void>
  onLoadReplies: (commentId: number) => Promise<CommentData[]>
}

export function PinPanel({
  activeAnnotationId,
  comments,
  onClose,
  onReply,
  onLike,
  onReact,
  onLoadReplies,
}: PinPanelProps) {
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    const findMount = () => setPortalElement(document.getElementById("comments-pin-panel"))
    findMount()
    const observer = new MutationObserver(findMount)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  if (!portalElement || activeAnnotationId === null) return null

  const comment = comments[0] // assuming comments array has one entry for the annotation's root comment

  return createPortal(
    <div className="otaku-comments-panel rounded-xl border border-border bg-card p-4 min-h-[300px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold text-foreground">Annotation Comment</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ✕
        </button>
      </div>
      {comment ? (
        <CommentThread
          comment={comment}
          depth={0}
          onReply={onReply}
          onLike={onLike}
          onReact={onReact}
          onLoadReplies={onLoadReplies}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}
    </div>,
    portalElement
  )
}

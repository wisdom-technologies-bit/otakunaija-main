"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { AuthProvider, useAuth } from "./AuthProvider"
import { AuthModal } from "./AuthModal"
import { SelectionToolbar, type RangeData } from "./SelectionToolbar"
import { AnnotationCommentModal } from "./AnnotationCommentModal"
import { AnnotationHighlighter } from "./AnnotationHighlighter"
import { PinPanel } from "./PinPanel"
import { ConnectorLine } from "./ConnectorLine"
import { MobileOverlay } from "./MobileOverlay"
import { CommentThread, type CommentData } from "./CommentThread"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useMediaQuery } from "@/hooks/use-media-query" // we'll create a simple hook
import { Loader2 } from "lucide-react"

interface CommentsWidgetProps {
  postSlug: string
}

export function CommentsWidget({ postSlug }: CommentsWidgetProps) {
  return (
    <AuthProvider>
      <CommentsWidgetInner postSlug={postSlug} />
    </AuthProvider>
  )
}

function CommentsWidgetInner({ postSlug }: CommentsWidgetProps) {
  const { user } = useAuth()
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showAnnotationCommentModal, setShowAnnotationCommentModal] = useState(false)

  const [annotations, setAnnotations] = useState<any[]>([])
  const [comments, setComments] = useState<CommentData[]>([])
  const [activeAnnotationId, setActiveAnnotationId] = useState<number | null>(null)
  const [mobileAnnotationId, setMobileAnnotationId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAllComments, setShowAllComments] = useState(false)

  const pendingAnnotation = useRef<{
    selectedText: string
    rangeData: RangeData
  } | null>(null)

  // Activation and initial data fetch
  useEffect(() => {
    const init = async () => {
      try {
        // Activate post
        await fetch(`/api/posts/${postSlug}/activate`)

        // Fetch annotations
        const annRes = await fetch(`/api/posts/${postSlug}/annotations`)
        const annData = await annRes.json()
        setAnnotations(annData.annotations || [])

        // Fetch all comments (for the bottom comment list)
        const comRes = await fetch(`/api/posts/${postSlug}/comments`)
        const comData = await comRes.json()
        setComments(comData.comments || [])
      } catch (err) {
        console.error("Failed to load comments", err)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [postSlug])

  // Reload comments (after adding a new one)
  const refreshComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postSlug}/comments`, {
        cache: "no-store",
      })

      if (!res.ok) {
        console.error("Failed to refresh comments:", res.status)
        return
      }

      const data = await res.json()

      // Only replace the existing comments when the API actually
      // returned a valid comments array. This prevents a temporary
      // API failure from making all comments disappear from the UI.
      if (Array.isArray(data.comments)) {
        setComments(data.comments)
      }

      const annRes = await fetch(`/api/posts/${postSlug}/annotations`, {
        cache: "no-store",
      })

      if (annRes.ok) {
        const annData = await annRes.json()
        if (Array.isArray(annData.annotations)) {
          setAnnotations(annData.annotations)
        }
      }
    } catch (err) {
      console.error("Failed to refresh comments:", err)
    }
  }, [postSlug])

  // Intersection Observer for active annotation (desktop only)
  useEffect(() => {
    if (!isDesktop) return
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first visible annotation
        const visible = entries.find((entry) => entry.isIntersecting)
        if (visible) {
          const id = Number(visible.target.getAttribute("data-annotation-id"))
          if (!isNaN(id)) {
            setActiveAnnotationId(id)
          }
        } else {
          // If no annotation visible, set to null
          setActiveAnnotationId(null)
        }
      },
      { threshold: 0, rootMargin: "-35% 0px -50% 0px" }
    )

    const observeHighlights = () => {
      document.querySelectorAll(".otaku-annotation-highlight").forEach((el) => observer.observe(el))
    }
    observeHighlights()
    const frame = requestAnimationFrame(observeHighlights)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [isDesktop, annotations])

  // Create an annotation together with its actual comment.
  const createAnnotation = async (
    selectedText: string,
    rangeData: RangeData,
    commentBody: string,
    token: string
  ) => {
    try {
      const res = await fetch(`/api/posts/${postSlug}/annotations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          selected_text: selectedText,
          context_hash: rangeData.contextHash,
          start_offset: rangeData.startOffset,
          end_offset: rangeData.endOffset,
          comment_body: commentBody,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        console.error("Failed to create annotation:", errorData || res.status)
        throw new Error("Failed to create annotation")
      }

      await refreshComments()
    } catch (err) {
      console.error("Failed to create annotation", err)
      throw err
    }
  }

  // Selecting text and clicking Comment opens the annotation
  // comment modal. If authentication is required, remember the
  // selection until login succeeds.
  const handleAnnotationComment = async (
    selectedText: string,
    rangeData: RangeData
  ) => {
    pendingAnnotation.current = {
      selectedText,
      rangeData,
    }

    if (!user) {
      setShowAuthModal(true)
      return
    }

    setShowAnnotationCommentModal(true)
  }

  const handleAnnotationSubmit = async (commentBody: string) => {
    const pending = pendingAnnotation.current

    if (!pending || !user) {
      return
    }

    await createAnnotation(
      pending.selectedText,
      pending.rangeData,
      commentBody,
      user.token
    )

    pendingAnnotation.current = null
  }

  // Handlers for comments
  const handleReply = async (parentId: number, body: string) => {
    if (!user) return
    await fetch(`/api/posts/${postSlug}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({ body, parent_id: parentId }),
    })
    await refreshComments()
  }

  const handleLike = async (commentId: number) => {
    if (!user) return
    await fetch(`/api/comments/${commentId}/like`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    })
    await refreshComments()
  }

  const handleReact = async (commentId: number, type: string) => {
    if (!user) return
    await fetch(`/api/comments/${commentId}/react`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({ type }),
    })
    await refreshComments()
  }

  // Load more replies callback for CommentThread
  const handleLoadReplies = async (commentId: number): Promise<CommentData[]> => {
  const res = await fetch(`/api/comments/${commentId}/replies`)
  const data = await res.json()
  return data.replies || []
}

  // Clicking a highlight should always select its own comment; desktop opens the sidebar card.
  const handleAnnotationClick = (annotationId: number) => {
    if (isDesktop) {
      setActiveAnnotationId(annotationId)
    } else {
      setMobileAnnotationId(annotationId)
    }
  }

  // Compute the root comment for active annotation
  const activeAnnotation = annotations.find((a: any) => a.annotation.id === activeAnnotationId)
  const activeAnnotationComments = activeAnnotation
    ? comments.filter((c: any) => c.id === activeAnnotation.comment.id) // this is not accurate; we need to get the root comment for the annotation
    : []

  // Actually, we need to find the comment with id equal to annotation.comment_id.
  // We'll create a helper.
  const getRootCommentForAnnotation = (annotationId: number) => {
    const ann = annotations.find((a: any) => a.annotation.id === annotationId)
    if (!ann) return null
    // Find comment with ann.comment.id
    return findCommentById(comments, ann.comment.id)
  }

  // Helper to find a comment by id in a nested structure
  function findCommentById(commentList: CommentData[], id: number): CommentData | null {
    for (const c of commentList) {
      if (c.id === id) return c
      if (c.replies) {
        const found = findCommentById(c.replies, id)
        if (found) return found
      }
    }
    return null
  }

  const rootCommentForActive = activeAnnotationId ? getRootCommentForAnnotation(activeAnnotationId) : null

  // Similarly for mobile
  const mobileRootComment = mobileAnnotationId ? getRootCommentForAnnotation(mobileAnnotationId) : null

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      {/* Selection toolbar appears everywhere */}
      <SelectionToolbar onComment={handleAnnotationComment} />
      <AnnotationHighlighter annotations={annotations.map((a: any) => a.annotation)} onAnnotationClick={handleAnnotationClick} />

      {/* Auth modal */}
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onSuccess={() => {
          // AuthProvider has already stored the new user. The next render
          // will provide it through useAuth(), so open the annotation
          // comment modal after successful authentication.
          if (pendingAnnotation.current) {
            setShowAnnotationCommentModal(true)
          }
        }}
      />

      <AnnotationCommentModal
        open={showAnnotationCommentModal}
        onOpenChange={(open) => {
          setShowAnnotationCommentModal(open)

          if (!open) {
            pendingAnnotation.current = null
          }
        }}
        selectedText={pendingAnnotation.current?.selectedText || ""}
        onSubmit={handleAnnotationSubmit}
      />

      {/* Desktop: Connector line + PinPanel */}
      {isDesktop && (
        <>
          <ConnectorLine activeAnnotationId={activeAnnotationId} />
          <PinPanel
            activeAnnotationId={activeAnnotationId}
            comments={rootCommentForActive ? [rootCommentForActive] : []}
            onClose={() => setActiveAnnotationId(null)}
            onReply={handleReply}
            onLike={handleLike}
            onReact={handleReact}
            onLoadReplies={handleLoadReplies}
          />
        </>
      )}

      {/* Mobile: Overlay */}
      {!isDesktop && (
        <MobileOverlay
          open={mobileAnnotationId !== null}
          onOpenChange={(open) => {
            if (!open) setMobileAnnotationId(null)
          }}
          annotationId={mobileAnnotationId}
          comments={mobileRootComment ? [mobileRootComment] : []}
          onReply={handleReply}
          onLike={handleLike}
          onReact={handleReact}
          onLoadReplies={handleLoadReplies}
        />
      )}

      {/* Bottom comment section (global comments) */}
      <div className="mt-10 border-t border-border pt-6">
        <h2 className="font-display text-2xl font-bold mb-4">Comments</h2>
        {user ? (
          <NewCommentForm
            postSlug={postSlug}
            onCommentAdded={refreshComments}
          />
        ) : (
          <div className="mb-4 p-4 border border-border rounded-lg bg-card text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Sign in to join the conversation.
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowAuthModal(true)}>
              Sign In / Register
            </Button>
          </div>
        )}
        {comments.length > 0 ? (
          <div className="mt-6 space-y-4">
            {(showAllComments ? comments : comments.slice(0, 5)).map((c) => (
              <CommentThread
                key={c.id}
                comment={c}
                depth={0}
                onReply={handleReply}
                onLike={handleLike}
                onReact={handleReact}
                onLoadReplies={handleLoadReplies}
              />
            ))}
            {comments.length > 5 && !showAllComments && (
              <Button variant="outline" className="w-full" onClick={() => setShowAllComments(true)}>
                See more comments
              </Button>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No comments yet. Be the first to share your thoughts!</p>
        )}
      </div>
    </>
  )
}

// Internal component for new comment form
function NewCommentForm({
  postSlug,
  onCommentAdded,
}: {
  postSlug: string
  onCommentAdded: () => void
}) {
  const { user } = useAuth()
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!body.trim() || !user) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/posts/${postSlug}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ body }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        console.error("Failed to post comment:", errorData || res.status)
        return
      }

      setBody("")
      await onCommentAdded()
    } catch (err) {
      console.error("Failed to post comment", err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-4 space-y-2">
      <Textarea
        placeholder="Add a comment..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-[80px] max-w-full [overflow-wrap:anywhere]"
      />
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!body.trim() || submitting}>
          {submitting ? "Posting..." : "Post Comment"}
        </Button>
      </div>
    </div>
  )
}

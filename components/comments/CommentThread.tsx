"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Heart, Smile, MessageCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns" // you can install date-fns if not already
import { useAuth } from "./AuthProvider"

interface User {
  id: number
  name: string | null
  username: string
}

export interface CommentData {
  id: number
  body: string
  likes: number
  userLiked: boolean
  reactions: Record<string, number>
  createdAt: string
  user: User
  replies?: CommentData[]
  repliesCount?: number
}

interface CommentThreadProps {
  comment: CommentData
  depth?: number
  onReply: (parentId: number, body: string) => Promise<void>
  onLike: (commentId: number) => Promise<void>
  onReact: (commentId: number, type: string) => Promise<void>
  onLoadReplies?: (commentId: number) => Promise<CommentData[]>   // <-- ADD THIS LINE
}

export function CommentThread({
  comment,
  depth = 0,
  onReply,
  onLike,
  onReact,
  onLoadReplies,
}: CommentThreadProps) {
  const { user } = useAuth()
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [replyBody, setReplyBody] = useState("")
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [loadedReplies, setLoadedReplies] = useState<CommentData[]>(comment.replies || [])
  const [loadingMore, setLoadingMore] = useState(false)

  const handleReplySubmit = async () => {
    if (!replyBody.trim()) return
    setIsSubmittingReply(true)
    try {
      await onReply(comment.id, replyBody.trim())
      setReplyBody("")
      setShowReplyInput(false)
    } finally {
      setIsSubmittingReply(false)
    }
  }

  const handleLike = () => {
    onLike(comment.id)
  }

  const handleReact = (type: string) => {
    onReact(comment.id, type)
  }

  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })
    .replace(/minutes? ago$/, "mins ago")
    .replace(/^about /, "")
  const displayName = comment.user.name || comment.user.username
  const shortName = displayName.length > 18 ? `${displayName.slice(0, 15)}...` : displayName

  // Determine max depth to avoid infinite rendering
  const shouldShowReplyButton = depth < 5 // limit depth

  return (
    <div className={`${depth > 0 ? "ml-3 border-l-2 border-border pl-3 sm:ml-6 sm:pl-4" : ""} mb-4 min-w-0 max-w-full`}>
      {/* Comment card */}
      <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-card p-3">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="min-w-0 truncate font-semibold text-foreground" title={displayName}>
                {shortName}
              </span>
              <span className="shrink-0 text-muted-foreground text-xs">{timeAgo}</span>
            </div>
            <p className="mt-1 max-w-full [overflow-wrap:anywhere] whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>

            <div className="mt-2 flex items-center gap-2">
              {/* Like button */}
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 text-xs ${comment.userLiked ? "text-red-500" : "text-muted-foreground"}`}
                onClick={handleLike}
              >
                <Heart className={`h-3.5 w-3.5 mr-1 ${comment.userLiked ? "fill-current" : ""}`} />
                {comment.likes > 0 && comment.likes}
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Open reactions" className="h-7 px-2 text-xs text-muted-foreground">
                    <Smile className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="flex w-auto gap-1 p-2">
                  {[['👍', 'like'], ['❤️', 'love'], ['😂', 'laugh'], ['😮', 'wow']].map(([emoji, type]) => (
                    <button key={type} type="button" className="rounded p-1 text-sm hover:bg-accent" onClick={() => handleReact(type)}>
                      {emoji} {comment.reactions[type] > 0 ? comment.reactions[type] : null}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              {/* Reply button */}
              {shouldShowReplyButton && user && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setShowReplyInput(!showReplyInput)}
                >
                  <MessageCircle className="h-3.5 w-3.5 mr-1" />
                  Reply
                </Button>
              )}
            </div>

            {/* Reply input */}
            {showReplyInput && (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-[60px] max-w-full [overflow-wrap:anywhere] text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowReplyInput(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleReplySubmit}
                    disabled={!replyBody.trim() || isSubmittingReply}
                  >
                    {isSubmittingReply ? "Posting..." : "Post Reply"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {loadedReplies.length > 0 && (
        <div className="mt-2">
          {loadedReplies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              onLike={onLike}
              onReact={onReact}
              onLoadReplies={onLoadReplies}
            />
          ))}
        </div>
      )}

      {/* Load more button */}
      {Boolean(comment.repliesCount && comment.repliesCount > loadedReplies.length) && (
        <div className="ml-6 mt-2">
          <Button
            variant="link"
            size="sm"
            className="text-xs h-auto p-0"
            disabled={loadingMore}
            onClick={async () => {
  setLoadingMore(true)
  try {
    if (onLoadReplies) {
      const newReplies = await onLoadReplies(comment.id)
      setLoadedReplies(prev => [...prev, ...newReplies])
    }
  } finally {
    setLoadingMore(false)
  }
}}
          >
            View {(comment.repliesCount ?? 0) - loadedReplies.length} more replies
          </Button>
        </div>
      )}
    </div>
  )
}

"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CommentThread, type CommentData } from "./CommentThread"
import { useAuth } from "./AuthProvider"

interface MobileOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  annotationId: number | null
  comments: CommentData[]
  onReply: (parentId: number, body: string) => Promise<void>
  onLike: (commentId: number) => Promise<void>
  onReact: (commentId: number, type: string) => Promise<void>
  onLoadReplies: (commentId: number) => Promise<CommentData[]>
}

export function MobileOverlay({
  open,
  onOpenChange,
  annotationId,
  comments,
  onReply,
  onLike,
  onReact,
  onLoadReplies,
}: MobileOverlayProps) {
  const rootComment = comments[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(80dvh,680px)] w-[calc(100%-1rem)] max-w-lg flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Comment</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
          {rootComment ? (
            <CommentThread
              comment={rootComment}
              depth={0}
              onReply={onReply}
              onLike={onLike}
              onReact={onReact}
              onLoadReplies={onLoadReplies}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

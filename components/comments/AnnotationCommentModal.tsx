"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface AnnotationCommentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedText: string
  onSubmit: (commentBody: string) => Promise<void>
}

export function AnnotationCommentModal({
  open,
  onOpenChange,
  selectedText,
  onSubmit,
}: AnnotationCommentModalProps) {
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setBody("")
      setSubmitting(false)
    }
  }, [open])

  const handleSubmit = async () => {
    const trimmed = body.trim()

    if (!trimmed || submitting) return

    setSubmitting(true)

    try {
      await onSubmit(trimmed)
      setBody("")
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to create annotation comment:", error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comment on selected text</DialogTitle>
          <DialogDescription>
            Add a comment about the text you selected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Selected text
            </p>
            <p className="text-sm text-foreground max-h-28 overflow-y-auto whitespace-pre-wrap">
              "{selectedText}"
            </p>
          </div>

          <Textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your comment..."
            className="min-h-[110px]"
            disabled={submitting}
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!body.trim() || submitting}
            >
              {submitting ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

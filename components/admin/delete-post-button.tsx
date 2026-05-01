"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { deletePostAction } from "@/app/actions/admin"

export function DeletePostButton({ id, title }: { id: number; title: string }) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${title}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    )
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          await deletePostAction(formData)
        })
      }
      className="flex items-center gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
      >
        {isPending ? "Deleting..." : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-card"
      >
        Cancel
      </button>
    </form>
  )
}

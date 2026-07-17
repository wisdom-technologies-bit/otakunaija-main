"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { deleteSeriesAction } from "@/app/actions/admin"

export function DeleteSeriesButton({ id, title }: { id: number; title: string }) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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
          const result = await deleteSeriesAction(formData)
          if (result && "error" in result) {
            setError(result.error)
          }
        })
      }
      className="flex items-center gap-1"
    >
      <input type="hidden" name="id" value={id} />
      {error && (
        <span className="text-xs text-destructive mr-2 max-w-xs truncate">{error}</span>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
      >
        {isPending ? "Deleting..." : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => {
          setConfirming(false)
          setError(null)
        }}
        className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-card"
      >
        Cancel
      </button>
    </form>
  )
}

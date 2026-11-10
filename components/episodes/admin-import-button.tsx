"use client"

import { Loader2, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

/**
 * Admin-only "Add to OtakuNaija" for an AniList title that is not on site yet.
 * Queues the title through the play service via /api/admin/anime-import.
 *
 * Rendered only when the server page confirmed a session; the endpoint checks
 * the session again, so the button is convenience, never the guard.
 */
export function AdminImportButton({
  anilistId,
  title,
  compact = false,
  className = "",
}: {
  anilistId: number
  title?: string
  compact?: boolean
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function run(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (busy) return

    setBusy(true)
    try {
      const response = await fetch("/api/admin/anime-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anilistId }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(typeof json.message === "string" ? json.message : "Import failed")
        return
      }

      setDone(true)
      toast.success(
        json.status === "placeholder" ? "Placeholder created" : "Queued for sync",
      )
    } catch {
      toast.error("Import failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy || done}
      aria-label={title ? `Add ${title} to OtakuNaija` : "Add to OtakuNaija"}
      data-testid={`admin-import-${anilistId}`}
      className={[
        "otk-focus inline-flex items-center gap-1 rounded-[calc(var(--otk-radius)-0.35rem)] border border-dashed border-primary/60 bg-primary/10 font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-60",
        compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        className,
      ].join(" ")}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="h-3 w-3" aria-hidden="true" />
      )}
      {done ? "Requested" : "Add to OtakuNaija"}
    </button>
  )
}

export default AdminImportButton

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ImportLogRow = {
  id: number
  anilistId: number
  status: "placeholder" | "queued" | "error"
  message: string | null
  requestedBy: string | null
  createdAt: string | null
}

const STATUS_STYLE: Record<string, string> = {
  placeholder: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  queued: "bg-primary/15 text-primary",
  error: "bg-red-500/15 text-red-600 dark:text-red-400",
}

const STATUS_LABEL: Record<string, string> = {
  placeholder: "Placeholder created",
  queued: "Queued for sync",
  error: "Error",
}

/**
 * Admin: queue an AniList title through the play service by id or link.
 * The play service creates the upcoming placeholder (or runs a full sync);
 * this page shows what it answered and the last 20 requests.
 */
export default function AnimeImportPage() {
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ status: string; message: string; anilistId: number } | null>(null)
  const [history, setHistory] = useState<ImportLogRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch("/api/admin/anime-import", { cache: "no-store" })
      const json = await response.json()
      setHistory(Array.isArray(json.requests) ? json.requests : [])
    } catch {
      toast.error("Could not load the import history")
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setResult(null)
    try {
      const response = await fetch("/api/admin/anime-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anilistId: input }),
      })
      const json = await response.json()
      if (!response.ok) {
        const message = typeof json.message === "string" ? json.message : "Import failed"
        setResult({ status: "error", message, anilistId: Number(json.anilistId) || 0 })
        toast.error(message)
      } else {
        setResult({ status: String(json.status), message: String(json.message ?? ""), anilistId: Number(json.anilistId) })
        toast.success(STATUS_LABEL[String(json.status)] ?? "Request sent")
        setInput("")
      }
      await loadHistory()
    } catch {
      setResult({ status: "error", message: "Import failed", anilistId: 0 })
      toast.error("Import failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Import by AniList ID</h1>
        <p className="text-sm text-muted-foreground">
          Paste an AniList link (anilist.co/anime/21) or just the id. OtakuNaija asks the play service to create an
          upcoming placeholder or queue a full metadata sync.
        </p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="21 or https://anilist.co/anime/21"
          aria-label="AniList id or URL"
          className="flex-1"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Import
        </Button>
      </form>

      {result ? (
        <div
          className="rounded-xl border border-border bg-card p-4 text-sm"
          data-testid="import-result"
          role="status"
        >
          <Badge className={STATUS_STYLE[result.status] ?? ""}>{STATUS_LABEL[result.status] ?? result.status}</Badge>
          <p className="mt-2 text-muted-foreground">
            {result.message}
            {result.anilistId ? (
              <>
                {" "}
                · AniList id {result.anilistId}
                {" · "}
                <Link href={`https://anilist.co/anime/${result.anilistId}`} target="_blank" rel="noreferrer" className="underline">
                  open on AniList
                </Link>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Last 20 requests</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadHistory()} disabled={loadingHistory}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loadingHistory && !history.length ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : history.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card" data-testid="import-history">
            {history.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <Link
                    href={`https://anilist.co/anime/${row.anilistId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    AniList #{row.anilistId}
                  </Link>
                  {row.message ? <p className="truncate text-xs text-muted-foreground">{row.message}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_STYLE[row.status] ?? ""}>{STATUS_LABEL[row.status] ?? row.status}</Badge>
                  <time className="text-xs text-muted-foreground" dateTime={row.createdAt ?? undefined}>
                    {row.createdAt ? new Date(row.createdAt).toLocaleString("en-NG") : ""}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No imports yet.
          </p>
        )}
      </section>
    </div>
  )
}

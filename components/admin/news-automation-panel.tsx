"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bot, ExternalLink, Loader2, RefreshCw, RotateCcw, SkipForward, Upload } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTime } from "@/lib/posts"

type AutomationRow = {
  id: number
  guid: string
  status: string
  original_title: string | null
  source_url: string
  source_name: string | null
  original_published_at: string | null
  image_url: string | null
  topics: string[] | null
  attempts: number
  last_error: string | null
  has_rewrite: boolean
  post_id: number | null
  post_slug: string | null
  created_at: string
  updated_at: string
}

type AutomationPayload = {
  rows: AutomationRow[]
  counts: Record<string, number>
  autopublish: boolean
  pushEnabled: boolean
  maxPerRun: number
}

const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rewritten: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  published: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  skipped: "border-border bg-muted text-muted-foreground",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
}

export function NewsAutomationPanel() {
  const [rows, setRows] = useState<AutomationRow[]>([])
  const [payload, setPayload] = useState<AutomationPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/news/automation", { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.hint || data?.message || "Unable to load the automation queue")
      }
      setRows(data.rows ?? [])
      setPayload(data as AutomationPayload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the automation queue")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function run(id: number, action: "publish" | "retry" | "skip") {
    setBusyId(id)
    try {
      const response = await fetch(`/api/admin/news/automation/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Action failed")
      toast.success(
        action === "publish" ? "Published to the blog." : action === "retry" ? "Queued for the next run." : "Skipped.",
      )
      await load()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Action failed")
    } finally {
      setBusyId(null)
    }
  }

  const counts = payload?.counts ?? {}

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium">
                Auto-publish is{" "}
                <span className={payload?.autopublish ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                  {payload?.autopublish ? "ON" : "OFF"}
                </span>
              </p>
              <p className="mt-1 max-w-2xl text-muted-foreground">
                Controlled by the <code className="rounded bg-muted px-1 py-0.5 text-xs">NEWS_AUTOPUBLISH</code> environment
                variable (default <code className="rounded bg-muted px-1 py-0.5 text-xs">true</code>). When it is on, each cron
                run publishes up to{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">NEWS_MAX_PER_RUN</code> (
                {payload?.maxPerRun ?? 3}) rewritten stories straight to the blog. When it is off, the cron only prepares drafts
                and they wait here for you to press <span className="font-medium">Publish now</span>. Push notifications after
                publishing are controlled by{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">NEWS_PUSH</code> ({payload?.pushEnabled ? "on" : "off"}).
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Refresh
          </Button>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {(["pending", "rewritten", "published", "skipped", "failed", "total"] as const).map((key) => (
            <div key={key} className="flex items-center gap-1.5">
              <dt className="uppercase tracking-wider">{key}</dt>
              <dd className="font-semibold text-foreground">{counts[key] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="font-medium">The automation queue is unavailable.</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-3" aria-label="Loading automation queue">
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty className="rounded-xl border border-border bg-card py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bot />
            </EmptyMedia>
            <EmptyTitle>Nothing ingested yet</EmptyTitle>
            <EmptyDescription>
              The cron job picks up new Anime News Network stories every 30 minutes.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] uppercase ${STATUS_STYLES[row.status] ?? ""}`}>
                        {row.status}
                      </Badge>
                      {row.topics?.length ? (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {row.topics.slice(0, 3).join(" · ")}
                        </span>
                      ) : null}
                      {row.attempts > 0 ? (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {row.attempts} attempt{row.attempts === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-1.5 line-clamp-2 text-sm font-semibold">
                      {row.original_title || row.guid}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <a
                        href={row.source_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        {row.source_name || "Anime News Network"} <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                      <time dateTime={row.created_at}>queued {formatRelativeTime(row.created_at)}</time>
                    </div>
                    {row.last_error ? (
                      <p className="mt-2 break-words rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                        {row.last_error}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {row.post_slug ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/blog/${row.post_slug}`} target="_blank">
                          <ExternalLink aria-hidden="true" /> Live post
                        </Link>
                      </Button>
                    ) : null}
                    {row.has_rewrite && row.status !== "published" ? (
                      <Button size="sm" disabled={busyId === row.id} onClick={() => void run(row.id, "publish")}>
                        {busyId === row.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                        Publish now
                      </Button>
                    ) : null}
                    {row.status === "failed" || row.status === "skipped" ? (
                      <Button variant="outline" size="sm" disabled={busyId === row.id} onClick={() => void run(row.id, "retry")}>
                        <RotateCcw aria-hidden="true" /> Retry
                      </Button>
                    ) : null}
                    {row.status !== "published" && row.status !== "skipped" ? (
                      <Button variant="ghost" size="sm" disabled={busyId === row.id} onClick={() => void run(row.id, "skip")}>
                        <SkipForward aria-hidden="true" /> Skip
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

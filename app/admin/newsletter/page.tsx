"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, MailPlus, Pause, Play } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"

type IssueSummary = {
  id: number
  issueDate: string
  layout: string | null
  status: string
  subject: string | null
  recipients: number
  sent: number
  failed: number
  openedPct: number
  clickedPct: number
  bounced: number
  htmlKb: number | null
  error: string | null
}

type Overview = {
  brevoConfigured: boolean
  webhookConfigured: boolean
  mode: "approve" | "auto"
  paused: boolean
  dailyCap: number
  sentToday: number
  capRemaining: number
  from: string
  counts: { subscribers: Record<string, number>; issues: Record<string, number> }
  issues: IssueSummary[]
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  approved: "bg-primary/15 text-primary",
  sending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  sent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  skipped: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
}

export default function AdminNewsletterPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingPause, setSavingPause] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/newsletter", { cache: "no-store" })
      if (!response.ok) throw new Error("load failed")
      setData((await response.json()) as Overview)
    } catch {
      toast.error("Could not load newsletter data.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function togglePause(next: boolean) {
    setSavingPause(true)
    try {
      const response = await fetch("/api/admin/newsletter/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: next }),
      })
      const payload = (await response.json()) as { paused?: boolean; error?: string }
      if (!response.ok) throw new Error(payload.error ?? "failed")
      setData((current) => (current ? { ...current, paused: Boolean(payload.paused) } : current))
      toast.success(next ? "Sending paused." : "Sending resumed.")
    } catch {
      toast.error("Could not change the pause switch.")
    } finally {
      setSavingPause(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Daily newsletter</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One issue per morning, prepared at 06:30 and sent at 07:00 West Africa Time.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {!data?.brevoConfigured ? (
        <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold">Brevo is not configured</p>
          <p className="mt-1 text-muted-foreground">
            Set <code className="font-mono text-xs">BREVO_API_KEY</code> (and the sender variables) before approving
            anything. Issues can still be prepared and previewed; nothing can be sent.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Sending</p>
              <p className="text-xs text-muted-foreground">
                {data?.paused ? "Paused. Nothing goes out." : "Live. Approved issues send at 07:00."}
              </p>
            </div>
            {data?.paused ? <Pause className="size-5 text-amber-500" /> : <Play className="size-5 text-emerald-500" />}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Switch
              checked={!data?.paused}
              disabled={loading || savingPause}
              onCheckedChange={(checked) => void togglePause(!checked)}
              aria-label="Toggle sending"
            />
            <span className="text-xs text-muted-foreground">{data?.paused ? "Paused" : "Running"}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Today&apos;s cap</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {data ? Math.min(data.sentToday, data.dailyCap) : 0}
            <span className="text-sm font-normal text-muted-foreground"> / {data?.dailyCap ?? 250}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Oldest-served first, so the queue rotates. {data?.capRemaining ?? 0} left today.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Subscribers</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {Object.entries(data?.counts.subscribers ?? {}).length ? (
              Object.entries(data?.counts.subscribers ?? {}).map(([status, count]) => (
                <Badge key={status} variant="secondary" className="font-normal">
                  {status}: {count}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">No subscribers yet.</span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Mode: <span className="font-medium">{data?.mode ?? "approve"}</span> · Webhook{" "}
            {data?.webhookConfigured ? "verified" : "not configured"}
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Layout</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 text-right font-medium">Sent</th>
              <th className="px-3 py-2 text-right font-medium">Opened</th>
              <th className="px-3 py-2 text-right font-medium">Clicked</th>
              <th className="px-3 py-2 text-right font-medium">Bounced</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data
              ? Array.from({ length: 5 }).map((_value, index) => (
                  <tr key={index} className="border-t border-border">
                    <td colSpan={8} className="px-3 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              : (data?.issues ?? []).map((issue) => (
                  <tr key={issue.id} className="border-t border-border align-top hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/admin/newsletter/${issue.id}`} className="hover:underline">
                        {issue.issueDate}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{issue.layout ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLE[issue.status] ?? "bg-muted"
                        }`}
                      >
                        {issue.status}
                      </span>
                    </td>
                    <td className="max-w-[22rem] px-3 py-2">
                      <Link href={`/admin/newsletter/${issue.id}`} className="line-clamp-2 hover:underline">
                        {issue.subject ?? "—"}
                      </Link>
                      {issue.error ? <p className="mt-1 text-xs text-destructive">{issue.error}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{issue.sent}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{issue.openedPct}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{issue.clickedPct}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{issue.bounced}</td>
                  </tr>
                ))}
            {!loading && data && data.issues.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                  <MailPlus className="mx-auto mb-2 size-6" />
                  No issues yet. The first one is prepared by the 06:30 cron run.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

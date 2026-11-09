"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, Monitor, RefreshCw, Send, Smartphone, SkipForward, Check } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type IssueDetail = {
  id: number
  issueDate: string
  status: string
  layout: string | null
  subject: string | null
  preheader: string | null
  editorsNote: string | null
  recipients: number
  sent: number
  failed: number
  htmlKb: number | null
  error: string | null
  layoutReason: string | null
  copySource: string | null
  copyReasons: string[]
  items: { posts: number; episodes: number; series: number; airing: number; upcoming: number; meaningful: number } | null
  posts: { id: number; title: string; category: string; url: string }[]
  series: { title: string; episodes: (number | null)[] }[]
}

type DetailResponse = {
  issue: IssueDetail
  preview: { html: string; text: string; kb: number } | null
  stats: { delivered: number; opened: number; clicked: number; bounced: number; complained: number; unsubscribed: number }
}

export default function AdminNewsletterIssuePage() {
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [data, setData] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [width, setWidth] = useState<"desktop" | "phone">("desktop")
  const [testTo, setTestTo] = useState("")
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [editorsNote, setEditorsNote] = useState("")

  const load = useCallback(async () => {
    if (!id) return
    try {
      const response = await fetch(`/api/admin/newsletter/${id}`, { cache: "no-store" })
      if (!response.ok) throw new Error("load failed")
      const payload = (await response.json()) as DetailResponse
      setData(payload)
      setSubject(payload.issue.subject ?? "")
      setPreheader(payload.issue.preheader ?? "")
      setEditorsNote(payload.issue.editorsNote ?? "")
    } catch {
      toast.error("Could not load this issue.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function act(action: string, body: Record<string, unknown> = {}) {
    if (!id) return
    setBusy(action)
    try {
      const response = await fetch(`/api/admin/newsletter/${id}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      })
      const payload = (await response.json()) as Record<string, unknown>
      if (!response.ok) {
        toast.error(String(payload.error ?? "That did not work."))
        return
      }
      toast.success(
        action === "approve"
          ? "Approved. It sends at 07:00."
          : action === "skip"
            ? "Skipped for today."
            : action === "test"
              ? `Test sent to ${String(payload.sentTo ?? "your address")}.`
              : action === "send"
                ? `Sent ${String(payload.sent ?? 0)}, failed ${String(payload.failed ?? 0)}.`
                : "Copy regenerated.",
      )
      await load()
    } catch {
      toast.error("Request failed.")
    } finally {
      setBusy(null)
    }
  }

  async function saveCopy() {
    if (!id) return
    setBusy("save")
    try {
      const response = await fetch(`/api/admin/newsletter/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, preheader, editorsNote }),
      })
      if (!response.ok) throw new Error("failed")
      toast.success("Copy saved.")
      await load()
    } catch {
      toast.error("Could not save the copy.")
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">This issue could not be loaded.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/admin/newsletter">Back to the newsletter list</Link>
        </Button>
      </div>
    )
  }

  const { issue, preview, stats } = data
  const locked = issue.status === "sent" || issue.status === "sending"
  const frameWidth = width === "desktop" ? 600 : 375

  return (
    <div className="mx-auto max-w-[110rem] px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/newsletter"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> All issues
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
            {issue.issueDate} · {issue.layout ?? "no layout"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{issue.status}</Badge>
            <span>{issue.recipients || issue.sent} recipients</span>
            <span>· {issue.htmlKb ?? preview?.kb ?? 0} KB HTML</span>
            <span>· copy: {issue.copySource ?? "unknown"}</span>
            <span>· layout: {issue.layoutReason ?? "—"}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={busy !== null}>
            <RefreshCw className="mr-2 size-4" /> Reload
          </Button>
          <Button variant="outline" onClick={() => void act("skip")} disabled={busy !== null || locked}>
            <SkipForward className="mr-2 size-4" /> Skip today
          </Button>
          <Button onClick={() => void act("approve")} disabled={busy !== null || locked || issue.status === "approved"}>
            <Check className="mr-2 size-4" /> Approve
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border p-1">
              <button
                type="button"
                onClick={() => setWidth("desktop")}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                  width === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <Monitor className="size-3" /> 600px
              </button>
              <button
                type="button"
                onClick={() => setWidth("phone")}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                  width === "phone" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <Smartphone className="size-3" /> 375px
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Exact HTML that will be sent (one per preferences combination).
            </p>
          </div>

          {preview ? (
            <div className="overflow-auto rounded-lg border border-border bg-white">
              <iframe
                title="Newsletter preview"
                srcDoc={preview.html}
                width={frameWidth}
                style={{ width: frameWidth, height: 900, border: 0, display: "block", margin: "0 auto" }}
              />
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No stored payload, so there is nothing to render.
            </p>
          )}

          <Tabs defaultValue="text" className="mt-4">
            <TabsList>
              <TabsTrigger value="text">Plain text version</TabsTrigger>
              <TabsTrigger value="content">Content used</TabsTrigger>
            </TabsList>
            <TabsContent value="text">
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-xs">
                {preview?.text ?? "No text version."}
              </pre>
            </TabsContent>
            <TabsContent value="content">
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {issue.items
                    ? `${issue.items.posts} posts · ${issue.items.episodes} episodes from ${issue.items.series} series · ${issue.items.airing} airing · ${issue.items.upcoming} upcoming (${issue.items.meaningful} meaningful items)`
                    : "No content counts stored."}
                </p>
                <ul className="space-y-1">
                  {issue.posts.map((post) => (
                    <li key={post.id} className="truncate">
                      <span className="text-xs text-muted-foreground">{post.category}</span>{" "}
                      <a href={post.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {post.title}
                      </a>
                    </li>
                  ))}
                </ul>
                {issue.series.length ? (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {issue.series.map((group) => (
                      <li key={group.title}>
                        {group.title} — ep {group.episodes.join(", ")}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Copy</p>
            <label className="mt-3 block text-xs font-medium text-muted-foreground" htmlFor="subject">
              Subject ({subject.length}/60)
            </label>
            <Input
              id="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={120}
              disabled={locked}
            />
            <label className="mt-3 block text-xs font-medium text-muted-foreground" htmlFor="preheader">
              Preheader ({preheader.length}/90)
            </label>
            <Input
              id="preheader"
              value={preheader}
              onChange={(event) => setPreheader(event.target.value)}
              maxLength={200}
              disabled={locked}
            />
            <label className="mt-3 block text-xs font-medium text-muted-foreground" htmlFor="note">
              Editor&apos;s note
            </label>
            <Textarea
              id="note"
              value={editorsNote}
              onChange={(event) => setEditorsNote(event.target.value)}
              rows={5}
              maxLength={600}
              disabled={locked}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void saveCopy()} disabled={busy !== null || locked}>
                Save copy
              </Button>
              <Button variant="outline" onClick={() => void act("regenerate")} disabled={busy !== null || locked}>
                <RefreshCw className="mr-2 size-4" /> Regenerate copy
              </Button>
            </div>
            {issue.copyReasons?.length ? (
              <p className="mt-2 break-words text-xs text-muted-foreground">
                Model notes: {issue.copyReasons.slice(0, 3).join("; ")}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Send a test</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Goes only to this address, with [TEST] in the subject. It does not touch subscriber history.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                type="email"
                placeholder="you@example.com"
                value={testTo}
                onChange={(event) => setTestTo(event.target.value)}
              />
              <Button onClick={() => void act("test", { to: testTo })} disabled={busy !== null || !testTo}>
                <Send className="mr-2 size-4" /> Send
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Send now</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Only works once the issue is approved, and never above the daily cap. Re-running resumes without
              duplicating.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="default"
                onClick={() => void act("send", { limit: 5 })}
                disabled={busy !== null || issue.status !== "approved"}
              >
                Send to 5
              </Button>
              <Button
                variant="outline"
                onClick={() => void act("send")}
                disabled={busy !== null || issue.status !== "approved"}
              >
                Send to everyone due
              </Button>
            </div>
            {busy ? (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Working…
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 text-xs">
            <p className="text-sm font-semibold">Engagement</p>
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-muted-foreground">
              <dt>Delivered</dt>
              <dd className="text-right tabular-nums text-foreground">{stats.delivered}</dd>
              <dt>Opened (unique)</dt>
              <dd className="text-right tabular-nums text-foreground">{stats.opened}</dd>
              <dt>Clicked (unique)</dt>
              <dd className="text-right tabular-nums text-foreground">{stats.clicked}</dd>
              <dt>Bounced</dt>
              <dd className="text-right tabular-nums text-foreground">{stats.bounced}</dd>
              <dt>Complaints</dt>
              <dd className="text-right tabular-nums text-foreground">{stats.complained}</dd>
              <dt>Unsubscribed</dt>
              <dd className="text-right tabular-nums text-foreground">{stats.unsubscribed}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, unauthorized } from "@/lib/newsletter/admin"
import { getIssue, issueStats, updateIssue } from "@/lib/newsletter/store"
import { renderIssuePreview } from "@/lib/newsletter/preview"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function issueId(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Issue detail: exact rendered HTML (for the iframe), the text part, and stats. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return unauthorized()

  const { id: raw } = await context.params
  const id = issueId(raw)
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const issue = await getIssue(id)
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [preview, stats] = await Promise.all([renderIssuePreview(issue), issueStats(id)])

  return NextResponse.json({
    issue: {
      id: issue.id,
      issueDate: issue.issueDate,
      status: issue.status,
      layout: issue.layout,
      subject: issue.subject,
      preheader: issue.preheader,
      editorsNote: issue.editorsNote,
      recipients: issue.recipients,
      sent: issue.sent,
      failed: issue.failed,
      htmlKb: issue.htmlSize ? Math.round((issue.htmlSize / 1024) * 10) / 10 : null,
      error: issue.error,
      approvedAt: issue.approvedAt,
      sentAt: issue.sentAt,
      layoutReason: issue.payload?.meta?.layoutReason ?? null,
      copySource: issue.payload?.meta?.copySource ?? null,
      copyReasons: issue.payload?.meta?.copyReasons ?? [],
      items: issue.payload?.content
        ? {
            posts: issue.payload.content.counts?.posts ?? 0,
            episodes: issue.payload.content.counts?.episodes ?? 0,
            series: issue.payload.content.counts?.series ?? 0,
            airing: issue.payload.content.counts?.airing ?? 0,
            upcoming: issue.payload.content.counts?.upcoming ?? 0,
            meaningful: issue.payload.content.meaningfulItems ?? 0,
          }
        : null,
      posts: issue.payload?.content
        ? [
            ...(issue.payload.content.topStory ? [issue.payload.content.topStory] : []),
            ...issue.payload.content.posts,
          ].map((post) => ({ id: post.id, title: post.title, category: post.category, url: post.url }))
        : [],
      series: (issue.payload?.content?.seriesGroups ?? []).map((group) => ({
        title: group.title,
        episodes: group.episodes.map((episode) => episode.number),
      })),
    },
    preview,
    stats,
  })
}

/**
 * Copy edits. Subject, preheader and the editor's note are the three things an
 * editor is allowed to override before approving.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return unauthorized()

  const { id: raw } = await context.params
  const id = issueId(raw)
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const issue = await getIssue(id)
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (issue.status === "sent" || issue.status === "sending") {
    return NextResponse.json({ error: "This issue has already gone out." }, { status: 409 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    subject?: string
    preheader?: string
    editorsNote?: string
  }

  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 120) : undefined
  const preheader = typeof body.preheader === "string" ? body.preheader.trim().slice(0, 200) : undefined
  const editorsNote = typeof body.editorsNote === "string" ? body.editorsNote.trim().slice(0, 600) : undefined

  const payload = issue.payload
    ? {
        ...issue.payload,
        copy: {
          ...issue.payload.copy,
          ...(subject !== undefined ? { subject } : {}),
          ...(preheader !== undefined ? { preheader } : {}),
          ...(editorsNote !== undefined ? { editorsNote } : {}),
          generatedBy: "admin" as const,
        },
      }
    : issue.payload

  const updated = await updateIssue(id, { subject, preheader, editorsNote, payload })
  return NextResponse.json({ ok: true, issue: updated ? { id: updated.id, subject: updated.subject } : null })
}

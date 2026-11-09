import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, unauthorized } from "@/lib/newsletter/admin"
import { newsletterConfig, maskEmail } from "@/lib/newsletter/config"
import { BrevoClient } from "@/lib/newsletter/brevo"
import { generateCopy } from "@/lib/newsletter/copy"
import { renderIssuePreview } from "@/lib/newsletter/preview"
import { sendTestIssue } from "@/lib/newsletter/send"
import { siteBrand } from "@/lib/newsletter/runtime"
import { getIssue, recentIssues, updateIssue } from "@/lib/newsletter/store"
import { runSend } from "@/lib/newsletter/send"
import { sendDeps } from "@/lib/newsletter/runtime"
import type { LayoutId } from "@/lib/newsletter/layout"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type Body = {
  action?: "approve" | "skip" | "regenerate" | "test" | "send" | "unsend-preview"
  to?: string
  limit?: number
}

function issueId(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Everything an editor can do to one issue, in one place. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return unauthorized()

  const { id: raw } = await context.params
  const id = issueId(raw)
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const issue = await getIssue(id)
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Body
  const action = body.action
  const config = newsletterConfig()

  if (action === "approve") {
    if (issue.status === "sent" || issue.status === "sending") {
      return NextResponse.json({ error: "Already sent." }, { status: 409 })
    }
    const updated = await updateIssue(id, { status: "approved", approvedAt: new Date().toISOString() })
    return NextResponse.json({ ok: true, status: updated?.status ?? "approved" })
  }

  if (action === "skip") {
    if (issue.status === "sent") return NextResponse.json({ error: "Already sent." }, { status: 409 })
    const updated = await updateIssue(id, { status: "skipped", error: "skipped by admin" })
    return NextResponse.json({ ok: true, status: updated?.status ?? "skipped" })
  }

  if (action === "regenerate") {
    if (!issue.payload?.content || !issue.layout) {
      return NextResponse.json({ error: "This issue has no stored content." }, { status: 409 })
    }
    if (!process.env.GROQ_API_KEY?.trim()) {
      return NextResponse.json({ error: "GROQ_API_KEY is not configured." }, { status: 503 })
    }

    const recent = await recentIssues(14)
    const recentSubjects = recent.filter((row) => row.id !== id).map((row) => row.subject ?? "").filter(Boolean)

    const result = await generateCopy({
      content: issue.payload.content,
      layout: issue.layout as LayoutId,
      issueDate: issue.issueDate,
      seed: Number(issue.payload.variant?.seed ?? 0),
      recentSubjects,
    })

    const payload = {
      ...issue.payload,
      copy: result.copy,
      meta: {
        ...(issue.payload.meta ?? {}),
        copyReasons: result.reasons,
        copySource: result.usedModel ? "groq" : "fallback",
        format: result.format,
      },
    }

    await updateIssue(id, {
      subject: result.copy.subject,
      preheader: result.copy.preheader,
      editorsNote: result.copy.editorsNote,
      payload,
    })

    return NextResponse.json({
      ok: true,
      copySource: result.usedModel ? "groq" : "fallback",
      reasons: result.reasons,
      subject: result.copy.subject,
      preheader: result.copy.preheader,
      editorsNote: result.copy.editorsNote,
    })
  }

  if (action === "test") {
    const to = (body.to ?? "").trim().toLowerCase()
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ error: "Enter a valid test address." }, { status: 400 })
    }
    if (!config.brevoApiKey) {
      return NextResponse.json({ error: "BREVO_API_KEY is not configured: nothing was sent." }, { status: 503 })
    }

    const result = await sendTestIssue({
      issue,
      to,
      config,
      brevo: new BrevoClient(config),
      now: new Date(),
      logoUrl: siteBrand(config).logoUrl,
    })

    // Never echo the address back in full.
    return NextResponse.json(
      result.ok
        ? { ok: true, sentTo: maskEmail(to), messageIds: result.messageIds }
        : { ok: false, error: result.reason ?? "Test send failed." },
      { status: result.ok ? 200 : 502 },
    )
  }

  if (action === "send") {
    if (issue.status !== "approved" && issue.status !== "sending") {
      return NextResponse.json({ error: "Approve the issue before sending." }, { status: 409 })
    }
    if (!config.brevoApiKey) {
      return NextResponse.json({ error: "BREVO_API_KEY is not configured: nothing was sent." }, { status: 503 })
    }

    const limit = Number.isFinite(body.limit) && Number(body.limit) > 0 ? Number(body.limit) : null
    const result = await runSend(sendDeps({ now: new Date(), dry: false, limit }))
    return NextResponse.json(result, { status: 200 })
  }

  if (action === "unsend-preview") {
    const preview = await renderIssuePreview(issue)
    return NextResponse.json({ ok: true, preview })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

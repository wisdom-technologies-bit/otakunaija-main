import { NextResponse } from "next/server"
import { requireAdmin, unauthorized } from "@/lib/newsletter/admin"
import { newsletterConfig } from "@/lib/newsletter/config"
import {
  countIssuesByStatus,
  countSentToday,
} from "@/lib/newsletter/store"
import { countSubscribersByStatus, isPaused, listIssues, statsForIssues } from "@/lib/newsletter/store"
import { utcDayStart } from "@/lib/newsletter/send"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Overview used by /admin/newsletter: issues, settings and subscriber counts. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return unauthorized()

  const config = newsletterConfig()
  const now = new Date()

  const [issues, subscriberCounts, issueCounts, paused, sentToday] = await Promise.all([
    listIssues(40),
    countSubscribersByStatus(),
    countIssuesByStatus(),
    isPaused(),
    countSentToday(utcDayStart(now)),
  ])

  const stats = await statsForIssues(issues.map((issue) => issue.id))

  return NextResponse.json({
    /** Says whether sending is possible; never the key itself. */
    brevoConfigured: Boolean(config.brevoApiKey),
    webhookConfigured: Boolean(config.brevoWebhookSecret),
    mode: config.mode,
    paused,
    dailyCap: config.dailyCap,
    sentToday,
    capRemaining: Math.max(0, config.dailyCap - sentToday),
    from: config.fromEmail,
    siteUrl: config.siteUrl,
    counts: { subscribers: subscriberCounts, issues: issueCounts },
    issues: issues.map((issue) => {
      const issueStat = stats.get(issue.id)
      const denom = issue.recipients || issue.sent || 0
      return {
        id: issue.id,
        issueDate: issue.issueDate,
        layout: issue.layout,
        status: issue.status,
        subject: issue.subject,
        recipients: issue.recipients,
        sent: issue.sent,
        failed: issue.failed,
        openedPct: denom && issueStat ? Math.round((issueStat.opened / denom) * 100) : 0,
        clickedPct: denom && issueStat ? Math.round((issueStat.clicked / denom) * 100) : 0,
        bounced: issueStat?.bounced ?? 0,
        htmlKb: issue.htmlSize ? Math.round((issue.htmlSize / 1024) * 10) / 10 : null,
        error: issue.error,
        sentAt: issue.sentAt,
      }
    }),
  })
}

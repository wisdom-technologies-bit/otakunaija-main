/**
 * Stage 2 of the pipeline: send today's approved issue.
 *
 * The three properties that matter most here:
 *   - **Never twice.** A subscriber who already received this issue is filtered
 *     out by `last_issue_id` and by `last_sent_at >= issue start`, so a re-run
 *     after a partial failure resumes and never duplicates.
 *   - **Fair under the cap.** Recipients are read oldest-`last_sent_at`-first,
 *     so with a 250/day cap the backlog rotates instead of the same people
 *     being served first every day.
 *   - **Honest about failure.** 429 stops the run and leaves the rest for the
 *     next one; 4xx counts the chunk as failed and moves on; 5xx gets exactly
 *     one retry inside BrevoClient.
 */

import { dayKeyInZone, weekdayInZone } from "./select"
import { applyToken, prefsKey, type RenderContext } from "./render/context"
import { renderIssue } from "./render"
import { longDateLabel } from "./prepare"
import type { BrevoChunkResult, BrevoClient, BrevoRecipientMessage } from "./brevo"
import type { NewsletterConfig } from "./config"
import { normalisePrefs, type NewsletterPrefs } from "./types"
import type { IssueRow, IssueStatus, RecipientRow } from "./store"

export type { RecipientRow }

export type SendStore = {
  getIssueByDate(issueDate: string): Promise<IssueRow | null>
  updateIssue(id: number, patch: { status?: IssueStatus; recipients?: number; sent?: number; failed?: number; error?: string | null; sentAt?: string | null }): Promise<IssueRow | null>
  isPaused(): Promise<boolean>
  countSentToday(dayStart: Date): Promise<number>
  listRecipients(input: { issueId: number; issueStart: Date; limit: number; includeWeekly: boolean }): Promise<RecipientRow[]>
  markSent(ids: number[], issueId: number, at: Date): Promise<void>
  /** Active subscribers on the weekly cadence, for the "who was left out" count. */
  countWeekly(): Promise<number>
}

export type SendDeps = {
  now: Date
  config: NewsletterConfig
  store: SendStore
  brevo: BrevoClient
  render?: typeof renderIssue
  dry: boolean
  limit?: number | null
  logoUrl?: string | null
}

export type SendResult = {
  issueDate: string
  issueId: number | null
  status: IssueStatus | null
  dry: boolean
  paused: boolean
  candidates: number
  sent: number
  failed: number
  remaining: number
  capRemaining: number
  sentToday: number
  weeklyExcluded: number
  reason: string | null
  error?: string
}

/** UTC midnight, the boundary the daily cap counts against. */
export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export function unsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    // https only: we do not run a working unsubscribe@ mailbox, and a dead
    // mailto in this header is worse than none.
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}

function issueStart(issue: IssueRow): Date {
  const candidate = issue.approvedAt ?? issue.createdAt ?? issue.sentAt
  const parsed = candidate ? new Date(candidate) : new Date()
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export type PreparedRecipientMessage = {
  recipient: RecipientRow
  prefs: NewsletterPrefs
  html: string
  text: string
}

export async function runSend(deps: SendDeps): Promise<SendResult> {
  const issueDate = dayKeyInZone(deps.now)
  const base: SendResult = {
    issueDate,
    issueId: null,
    status: null,
    dry: deps.dry,
    paused: false,
    candidates: 0,
    sent: 0,
    failed: 0,
    remaining: 0,
    capRemaining: 0,
    sentToday: 0,
    weeklyExcluded: 0,
    reason: null,
  }

  const issue = await deps.store.getIssueByDate(issueDate)
  if (!issue) return { ...base, reason: "no-issue-prepared" }
  base.issueId = issue.id
  base.status = issue.status

  if (issue.status === "sent") return { ...base, reason: "already-sent" }
  if (issue.status === "skipped") return { ...base, reason: "issue-skipped" }
  if (issue.status !== "approved" && issue.status !== "sending") {
    return { ...base, reason: `issue-not-approved:${issue.status}` }
  }

  const paused = await deps.store.isPaused()
  if (paused) return { ...base, paused: true, reason: "paused" }

  if (!deps.config.brevoApiKey) {
    return {
      ...base,
      reason: "brevo-not-configured",
      error: "BREVO_API_KEY is not configured: nothing was sent.",
    }
  }

  if (!issue.payload?.content || !issue.payload.copy || !issue.payload.variant || !issue.layout) {
    return { ...base, reason: "issue-payload-missing", error: "The issue has no stored content to render." }
  }

  const sentToday = await deps.store.countSentToday(utcDayStart(deps.now))
  const capRemaining = Math.max(0, deps.config.dailyCap - sentToday)
  base.sentToday = sentToday
  base.capRemaining = capRemaining

  if (capRemaining === 0) return { ...base, reason: "daily-cap-reached" }

  const limited = deps.limit && deps.limit > 0 ? Math.min(deps.limit, capRemaining) : capRemaining
  const includeWeekly = weekdayInZone(deps.now) === 0

  const recipients = await deps.store.listRecipients({
    issueId: issue.id,
    issueStart: issueStart(issue),
    limit: limited,
    includeWeekly,
  })
  base.candidates = recipients.length
  if (!recipients.length) {
    return { ...base, reason: includeWeekly ? "no-recipients" : "no-daily-recipients" }
  }

  // Render once per preferences combination, then bind each recipient's token.
  const render = deps.render ?? renderIssue
  const ctxBase: Omit<RenderContext, "prefs" | "content"> = {
    copy: issue.payload.copy,
    variant: issue.payload.variant,
    issueDate: issue.issueDate,
    dateLabel: longDateLabel(new Date(`${issue.issueDate}T06:00:00Z`)),
    token: "__NL_TOKEN__",
    brand: {
      siteUrl: deps.config.siteUrl,
      fromName: deps.config.fromName,
      postalAddress: deps.config.postalAddress,
      logoUrl: deps.logoUrl ?? null,
      replyTo: deps.config.replyTo,
    },
  }

  const rendered = new Map<string, { html: string; text: string }>()
  const groups = new Map<string, RecipientRow[]>()
  for (const recipient of recipients) {
    const key = prefsKey(recipient.prefs)
    const list = groups.get(key)
    if (list) list.push(recipient)
    else groups.set(key, [recipient])
  }

  for (const list of groups.values()) {
    const prefs = normalisePrefs(list[0].prefs)
    const key = prefsKey(prefs)
    if (rendered.has(key)) continue
    const output = await render({
      ...ctxBase,
      content: issue.payload.content,
      layout: issue.layout,
      prefs,
    })
    rendered.set(key, { html: output.html, text: output.text })
  }

  const messages: PreparedRecipientMessage[] = []
  for (const recipient of recipients) {
    const key = prefsKey(recipient.prefs)
    const body = rendered.get(key) ?? rendered.values().next().value
    if (!body) continue

    messages.push({
      recipient,
      prefs: recipient.prefs,
      html: applyToken(body.html, recipient.token),
      text: applyToken(body.text, recipient.token),
    })
  }

  // Weekly subscribers only receive the Sunday issue; report who was left out.
  base.weeklyExcluded = includeWeekly ? 0 : await deps.store.countWeekly()

  if (deps.dry) {
    return {
      ...base,
      sent: 0,
      remaining: messages.length,
      reason: "dry-run",
    }
  }

  // Claim the issue so a concurrent run resumes instead of restarting.
  if (issue.status === "approved") {
    await deps.store.updateIssue(issue.id, { status: "sending" })
  }

  const tags = [deps.config.tag, issue.issueDate]
  let sent = 0
  let failed = 0
  let stopped = false

  const chunkSize = 50
  for (let index = 0; index < messages.length; index += chunkSize) {
    const group = messages.slice(index, index + chunkSize)

    const chunkMessages: BrevoRecipientMessage[] = group.map((entry) => ({
      email: entry.recipient.email,
      html: entry.html,
      text: entry.text,
      // Points at the API route: RFC 8058 needs a URL that accepts a POST.
      headers: unsubscribeHeaders(
        `${deps.config.siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(entry.recipient.token)}`,
      ),
      params: {
        EMAIL: entry.recipient.email,
        UNSUBSCRIBE_URL: `${deps.config.siteUrl}/newsletter/unsubscribe?token=${entry.recipient.token}`,
        PREFERENCES_URL: `${deps.config.siteUrl}/newsletter/preferences?token=${entry.recipient.token}`,
        ISSUE_DATE: issue.issueDate,
      },
    }))

    const result: BrevoChunkResult = await deps.brevo.sendChunk({
      subject: issue.subject ?? issue.payload.copy.subject,
      html: group[0].html,
      text: group[0].text,
      tags,
      messages: chunkMessages,
    })

    if (result.ok) {
      await deps.store.markSent(
        group.map((entry) => entry.recipient.id),
        issue.id,
        deps.now,
      )
      sent += group.length
      continue
    }

    failed += group.length

    if (result.rateLimited) {
      stopped = true
      break
    }
  }

  const status: IssueStatus = stopped ? "sending" : failed > 0 && sent === 0 ? "failed" : "sent"

  await deps.store.updateIssue(issue.id, {
    status,
    recipients: messages.length,
    sent,
    failed,
    error: stopped ? "rate limited by Brevo: run resumes on the next invocation" : null,
    sentAt: status === "sent" ? deps.now.toISOString() : null,
  })

  return {
    ...base,
    status,
    sent,
    failed,
    remaining: messages.length - sent - failed,
    reason: stopped ? "rate-limited" : null,
  }
}

/** A single preview send. Never touches `subscribers` or the issue counters. */
export async function sendTestIssue(input: {
  issue: IssueRow
  to: string
  config: NewsletterConfig
  brevo: BrevoClient
  now: Date
  logoUrl?: string | null
  render?: typeof renderIssue
}): Promise<{ ok: boolean; messageIds: string[]; reason?: string }> {
  if (!input.issue.payload?.content || !input.issue.payload.copy || !input.issue.payload.variant || !input.issue.layout) {
    return { ok: false, messageIds: [], reason: "issue-payload-missing" }
  }

  const render = input.render ?? renderIssue
  const output = await render({
    content: input.issue.payload.content,
    copy: input.issue.payload.copy,
    variant: input.issue.payload.variant,
    prefs: { news: true, episodes: true, upcoming: true, frequency: "daily" },
    issueDate: input.issue.issueDate,
    dateLabel: longDateLabel(input.now),
    layout: input.issue.layout,
    token: "preview-token",
    brand: {
      siteUrl: input.config.siteUrl,
      fromName: input.config.fromName,
      postalAddress: input.config.postalAddress,
      logoUrl: input.logoUrl ?? null,
      replyTo: input.config.replyTo,
    },
  })

  const result = await input.brevo.sendTransactional({
    to: input.to,
    subject: `[TEST] ${input.issue.subject ?? input.issue.payload.copy.subject}`.slice(0, 140),
    html: output.html,
    text: output.text,
    tags: [input.config.tag, "test"],
  })

  if (!result.ok) return { ok: false, messageIds: [], reason: result.reason }
  return { ok: true, messageIds: result.messageIds.filter(Boolean) as string[] }
}


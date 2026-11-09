/**
 * Stage 1 of the pipeline: prepare today's issue.
 *
 * Idempotent by `issue_date`: the 06:30 run and any manual re-run produce one
 * row per day. Everything that can fail softly does: no previous issue, no
 * Groq key, no Brevo key, thin content.
 */

import { dayKeyInZone, selectIssueContent, usedPostIds, weekdayInZone } from "./select"
import { chooseLayout, seedFromDate, type LayoutChoice } from "./layout"
import { applyBlurbs, fallbackCopy, generateCopy, pickSubjectFormat } from "./copy"
import { renderIssue } from "./render"
import type { RenderContext } from "./render/context"
import { DEFAULT_PREFS, type IssueContent, type NewsletterCopy, type SelectSources } from "./types"
import type { NewsletterConfig } from "./config"
import type { IssueRow, IssueStatus } from "./store"
import type { LayoutVariant } from "./layout"

export type PrepareStore = {
  getIssueByDate(issueDate: string): Promise<IssueRow | null>
  lastSentIssue(now: Date): Promise<IssueRow | null>
  recentIssues(limit: number): Promise<IssueRow[]>
  insertIssue(input: {
    issueDate: string
    status: IssueStatus
    layout: string | null
    subject: string | null
    preheader: string | null
    editorsNote: string | null
    payload: unknown
    htmlSize?: number | null
    error?: string | null
  }): Promise<IssueRow>
}

export type PrepareDeps = {
  now: Date
  config: NewsletterConfig
  store: PrepareStore
  readSources: (options: { siteUrl: string; now: Date; airingHours: number }) => Promise<SelectSources>
  generateCopy?: typeof generateCopy
  render?: typeof renderIssue
  dry: boolean
  /** Injected so the unit tests can render without React Email. */
  logoUrl?: string | null
}

export type PrepareResult = {
  issueDate: string
  layout: string | null
  subject: string | null
  preheader: string | null
  items: {
    posts: number
    series: number
    episodes: number
    airing: number
    upcoming: number
    trending: number
    meaningful: number
  }
  skipped: boolean
  reason: string | null
  copySource: string | null
  layoutReason: string | null
  copyReasons: string[]
  htmlKb: number | null
  status: IssueStatus | null
  dry: boolean
  brevoConfigured: boolean
  warning?: string
}

const LONG_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/** "Monday 9 November", in Lagos. */
export function longDateLabel(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "numeric",
  }).formatToParts(now)
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "1")
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1")
  return `${LONG_WEEKDAYS[weekdayInZone(now)]} ${day} ${LONG_MONTHS[month - 1] ?? "January"}`
}

function emptyCounts(): PrepareResult["items"] {
  return { posts: 0, series: 0, episodes: 0, airing: 0, upcoming: 0, trending: 0, meaningful: 0 }
}

function countsOf(content: IssueContent): PrepareResult["items"] {
  return {
    posts: content.counts.posts,
    series: content.counts.series,
    episodes: content.counts.episodes,
    airing: content.counts.airing,
    upcoming: content.counts.upcoming,
    trending: content.counts.trending,
    meaningful: content.meaningfulItems,
  }
}

export function buildRenderContext(input: {
  content: IssueContent
  copy: NewsletterCopy
  variant: LayoutVariant
  issueDate: string
  now: Date
  config: NewsletterConfig
  logoUrl?: string | null
}): RenderContext {
  return {
    content: input.content,
    copy: input.copy,
    variant: input.variant,
    prefs: DEFAULT_PREFS,
    issueDate: input.issueDate,
    dateLabel: longDateLabel(input.now),
    token: "__NL_TOKEN__",
    brand: {
      siteUrl: input.config.siteUrl,
      fromName: input.config.fromName,
      postalAddress: input.config.postalAddress,
      logoUrl: input.logoUrl ?? null,
      replyTo: input.config.replyTo,
    },
  }
}

export async function prepareIssue(deps: PrepareDeps): Promise<PrepareResult> {
  const issueDate = dayKeyInZone(deps.now)
  const weekday = weekdayInZone(deps.now)
  const seed = seedFromDate(issueDate)
  const warning = deps.config.brevoApiKey ? undefined : "BREVO_API_KEY is not configured: nothing can be sent."

  const existing = await deps.store.getIssueByDate(issueDate)
  if (existing) {
    // Idempotent: the day already has an issue (or a recorded skip).
    const content = existing.payload?.content
    return {
      issueDate,
      layout: existing.layout,
      subject: existing.subject,
      preheader: existing.preheader,
      items: content ? countsOf(content) : emptyCounts(),
      skipped: existing.status === "skipped",
      reason: existing.status === "skipped" ? existing.error ?? "skipped" : null,
      copySource: existing.payload?.meta?.copySource ?? null,
      layoutReason: existing.payload?.meta?.layoutReason ?? null,
      copyReasons: existing.payload?.meta?.copyReasons ?? [],
      htmlKb: existing.htmlSize ? Math.round((existing.htmlSize / 1024) * 10) / 10 : null,
      status: existing.status,
      dry: deps.dry,
      brevoConfigured: Boolean(deps.config.brevoApiKey),
      warning: warning ? `${warning} (issue already exists)` : "Issue already exists for today; nothing to do.",
    }
  }

  const [lastSent, recent] = await Promise.all([
    deps.store.lastSentIssue(deps.now),
    deps.store.recentIssues(14),
  ])

  // Posts from the last three issues must not appear again.
  const excludePostIds = recent
    .slice(0, 3)
    .flatMap((issue) => issue.payload?.postIds ?? [])
  const recentSubjects = recent.map((issue) => issue.subject ?? "").filter(Boolean)

  const sources = await deps.readSources({ siteUrl: deps.config.siteUrl, now: deps.now, airingHours: 192 })
  const content = selectIssueContent({
    now: deps.now,
    lastSentAt: lastSent ? new Date(lastSent.sentAt ?? lastSent.issueDate) : null,
    sources,
    excludePostIds,
    siteBaseUrl: deps.config.siteUrl,
  })

  if (content.skipped) {
    if (!deps.dry) {
      await deps.store.insertIssue({
        issueDate,
        status: "skipped",
        layout: null,
        subject: null,
        preheader: null,
        editorsNote: null,
        payload: { content, copy: null, variant: null, meta: { layoutReason: "skipped" } },
        error: content.skipReason ?? "not-enough-content",
      })
    }
    return {
      issueDate,
      layout: null,
      subject: null,
      preheader: null,
      items: countsOf(content),
      skipped: true,
      reason: content.skipReason,
      copySource: null,
      layoutReason: null,
      copyReasons: [],
      htmlKb: null,
      status: deps.dry ? null : "skipped",
      dry: deps.dry,
      brevoConfigured: Boolean(deps.config.brevoApiKey),
      warning,
    }
  }

  const choice: LayoutChoice = chooseLayout(content, weekday, seed)

  const generate = deps.generateCopy ?? generateCopy
  // A dry run never spends Groq quota: the deterministic fallback copy is used
  // instead and labelled as such in `copySource`.
  const copyResult = deps.dry
    ? (() => {
        const format = pickSubjectFormat(choice.layout, seed, recentSubjects)
        return {
          copy: fallbackCopy(content, format),
          reasons: ["dry-run:model-skipped"],
          format,
          usedModel: false,
        }
      })()
    : await generate({
        content,
        layout: choice.layout,
        issueDate,
        seed,
        recentSubjects,
      })

  const withBlurbs = applyBlurbs(content, copyResult.copy.blurbs)

  const render = deps.render ?? renderIssue
  const ctx = buildRenderContext({
    content: withBlurbs,
    copy: copyResult.copy,
    variant: choice.variant,
    issueDate,
    now: deps.now,
    config: deps.config,
    logoUrl: deps.logoUrl,
  })
  const rendered = await render({ ...ctx, layout: choice.layout })

  const payload = {
    content: withBlurbs,
    copy: copyResult.copy,
    variant: choice.variant,
    postIds: usedPostIds(withBlurbs),
    meta: {
      layoutReason: choice.reason,
      copyReasons: copyResult.reasons,
      copySource: copyResult.usedModel ? "groq" : "fallback",
      format: copyResult.format,
    },
  }

  const status: IssueStatus = deps.config.mode === "auto" ? "approved" : "draft"

  if (!deps.dry) {
    await deps.store.insertIssue({
      issueDate,
      status,
      layout: choice.layout,
      subject: copyResult.copy.subject,
      preheader: copyResult.copy.preheader,
      editorsNote: copyResult.copy.editorsNote,
      payload,
      htmlSize: rendered.bytes,
    })
  }

  return {
    issueDate,
    layout: choice.layout,
    subject: copyResult.copy.subject,
    preheader: copyResult.copy.preheader,
    items: countsOf(withBlurbs),
    skipped: false,
    reason: null,
    copySource: copyResult.usedModel ? "groq" : "fallback",
    layoutReason: choice.reason,
    copyReasons: copyResult.reasons,
    htmlKb: rendered.kb,
    status: deps.dry ? null : status,
    dry: deps.dry,
    brevoConfigured: Boolean(deps.config.brevoApiKey),
    ...(warning ? { warning } : {}),
  }
}

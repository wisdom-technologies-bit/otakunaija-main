/**
 * Render context: everything a layout needs, plus the preference filter.
 *
 * The token placeholder is what makes "render once per prefs combination"
 * possible: the unsubscribe and preferences URLs are per-recipient, so the HTML
 * is built once per combination with `__NL_TOKEN__` in it and the token is
 * substituted per recipient just before the Brevo call.
 */

import type { LayoutVariant } from "../layout"
import { normalisePrefs, prefsKey, type IssueContent, type NewsletterCopy, type NewsletterPrefs } from "../types"

export const TOKEN_PLACEHOLDER = "__NL_TOKEN__"

export type RenderBrand = {
  siteUrl: string
  fromName: string
  postalAddress: string
  /** Absolute logo URL; when absent the header uses the text wordmark. */
  logoUrl: string | null
  replyTo: string | null
}

export type RenderContext = {
  content: IssueContent
  copy: NewsletterCopy
  variant: LayoutVariant
  prefs: NewsletterPrefs
  issueDate: string
  /** Human label such as "Monday 9 November". */
  dateLabel: string
  token: string
  brand: RenderBrand
}

export function newsletterLinks(brand: RenderBrand, token: string) {
  const base = brand.siteUrl.replace(/\/+$/, "")
  return {
    home: base,
    blog: `${base}/blog`,
    episodes: `${base}/episodes`,
    upcoming: `${base}/episodes/upcoming`,
    privacy: `${base}/privacy`,
    contact: brand.replyTo ? `mailto:${brand.replyTo}` : `${base}/contact`,
    unsubscribe: `${base}/newsletter/unsubscribe?token=${token}`,
    unsubscribeOneClick: `${base}/newsletter/unsubscribe?token=${token}&oneclick=1`,
    preferences: `${base}/newsletter/preferences?token=${token}`,
    confirm: `${base}/newsletter/confirm?token=${token}`,
  }
}

/** Replaces the placeholder with a real token. Idempotent and cheap. */
export function applyToken(html: string, token: string): string {
  return html.split(TOKEN_PLACEHOLDER).join(token)
}

export function applyTokenText(text: string, token: string): string {
  return text.split(TOKEN_PLACEHOLDER).join(token)
}

/**
 * Drops the modules a subscriber turned off. All three off is treated as all on
 * rather than sending an empty shell; the footer still links to preferences.
 */
export function visibleContent(content: IssueContent, rawPrefs: NewsletterPrefs): IssueContent {
  let prefs = normalisePrefs(rawPrefs)
  if (!prefs.news && !prefs.episodes && !prefs.upcoming) {
    prefs = { ...prefs, news: true }
  }

  const news = prefs.news
  const episodes = prefs.episodes
  const upcoming = prefs.upcoming

  return {
    ...content,
    topStory: news ? content.topStory : null,
    posts: news ? content.posts : [],
    weekInReview: news ? content.weekInReview : [],
    seriesGroups: episodes ? content.seriesGroups : [],
    episodes: episodes ? content.episodes : [],
    trending: episodes ? content.trending : [],
    airing: upcoming ? content.airing : [],
    upcoming: upcoming ? content.upcoming : [],
    schedule: upcoming
      ? content.schedule
      : content.schedule.map((day) => ({ ...day, items: [] })),
  }
}

export { prefsKey }

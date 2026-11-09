/**
 * The renderer entry point.
 *
 * `renderIssue` is the only function that produces email HTML. It is async
 * because React Email renders through react-dom/server, and server-only: no
 * part of this module is imported by a client component.
 */

import { render } from "@react-email/render"
import type { LayoutId } from "../layout"
import type { IssueContent, NewsletterCopy } from "../types"
import { applyToken, visibleContent, type RenderContext } from "./context"
import { EpisodeDropEmail } from "./episode-drop"
import { LeadStoryEmail } from "./lead-story"
import { QuietDayEmail } from "./quiet-day"
import { RoundupEmail } from "./roundup"
import { renderPlainText } from "./text"
import { WeekAheadEmail } from "./week-ahead"
import { WeekendWatchEmail } from "./weekend-watch"

export type RenderInput = Omit<RenderContext, "content"> & {
  content: IssueContent
  /** Which of the six templates renders this issue. */
  layout: LayoutId
}

export type RenderedIssue = {
  html: string
  text: string
  /** Bytes of UTF-8 HTML; Gmail clips at ~102 KB. */
  bytes: number
  /** Human KB, for the admin list and the cron JSON. */
  kb: number
}

export function layoutComponent(layout: LayoutId) {
  switch (layout) {
    case "episode-drop":
      return EpisodeDropEmail
    case "week-ahead":
      return WeekAheadEmail
    case "weekend-watch":
      return WeekendWatchEmail
    case "roundup":
      return RoundupEmail
    case "quiet-day":
      return QuietDayEmail
    case "lead-story":
    default:
      return LeadStoryEmail
  }
}

/**
 * Renders with the subscriber's module preferences applied. Call it once per
 * preferences combination, then substitute the token per recipient.
 */
export async function renderIssue(input: RenderInput): Promise<RenderedIssue> {
  const content = visibleContent(input.content, input.prefs)
  const ctx: RenderContext = { ...input, content }
  const Component = layoutComponent(input.layout)
  const html = await render(<Component {...ctx} />, { pretty: false })
  const text = renderPlainText(ctx)
  const bytes = new TextEncoder().encode(html).length

  return { html, text, bytes, kb: Math.round((bytes / 1024) * 10) / 10 }
}

/** Convenience for the send path and the preview: render then bind a token. */
export async function renderForRecipient(
  input: RenderInput,
  token: string,
): Promise<{ html: string; text: string }> {
  const rendered = await renderIssue(input)
  return { html: applyToken(rendered.html, token), text: applyToken(rendered.text, token) }
}

export type { NewsletterCopy }

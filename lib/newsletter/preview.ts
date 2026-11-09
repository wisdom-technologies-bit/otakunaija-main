import { newsletterConfig } from "./config"
import { siteBrand } from "./runtime"
import { buildRenderContext } from "./prepare"
import { renderIssue } from "./render"
import type { IssueRow } from "./store"
import type { LayoutId } from "./layout"
import { DEFAULT_PREFS } from "./types"

/**
 * Renders a stored issue exactly as the send path would, but with a harmless
 * token, for the admin iframe and the text-version panel.
 */
export async function renderIssuePreview(issue: IssueRow): Promise<{ html: string; text: string; kb: number } | null> {
  if (!issue.payload?.content || !issue.payload.copy || !issue.payload.variant || !issue.layout) return null

  const config = newsletterConfig()
  const ctx = buildRenderContext({
    content: issue.payload.content,
    copy: issue.payload.copy,
    variant: issue.payload.variant,
    issueDate: issue.issueDate,
    now: new Date(`${issue.issueDate}T06:00:00Z`),
    config,
    logoUrl: siteBrand(config).logoUrl,
  })

  const output = await renderIssue({
    ...ctx,
    layout: issue.layout as LayoutId,
    prefs: DEFAULT_PREFS,
    token: "preview-token",
  })

  return { html: output.html, text: output.text, kb: output.kb }
}

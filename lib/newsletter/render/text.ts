/**
 * Plain-text part.
 *
 * Written by hand rather than derived from the HTML: an auto-converted text
 * part inherits button-only links and image alts, which reads badly in a text
 * client. This one lists every link inline, in the order a person would read.
 */

import { newsletterLinks, type RenderContext } from "./context"

const LINE = "----------------------------------------------------------------"

export function renderPlainText(ctx: RenderContext): string {
  const { content, copy, brand } = ctx
  const links = newsletterLinks(brand, ctx.token)
  const lines: string[] = []

  lines.push("OTAKUNAIJA — DAILY BRIEFING")
  lines.push(ctx.dateLabel)
  lines.push("")
  lines.push(copy.editorsNote.trim())
  lines.push("")

  if (content.topStory) {
    lines.push(LINE)
    lines.push(`TOP STORY — ${content.topStory.title}`)
    if (content.topStory.excerpt) {
      lines.push("")
      lines.push(content.topStory.excerpt)
    }
    lines.push("")
    lines.push(content.topStory.url)
    lines.push("")
  }

  if (content.posts.length) {
    lines.push(LINE)
    lines.push("MORE THIS MORNING")
    for (const post of content.posts) {
      lines.push("")
      lines.push(`* ${post.title}`)
      if (post.whyItMatters ?? post.excerpt) lines.push(`  ${post.whyItMatters ?? post.excerpt}`)
      lines.push(`  ${post.url}`)
    }
    lines.push("")
  }

  if (content.seriesGroups.length) {
    lines.push(LINE)
    lines.push("NEW EPISODES")
    for (const group of content.seriesGroups) {
      const eps = group.episodes.map((episode) => episode.number ?? "?").join(", ")
      lines.push(`* ${group.title} — episode ${eps}`)
      lines.push(`  ${group.episodes[0]?.url ?? group.url}`)
    }
    lines.push("")
  }

  if (content.airing.length) {
    lines.push(LINE)
    lines.push("AIRING SOON")
    for (const item of content.airing) {
      lines.push(`* ${item.title} ep ${item.episode} — ${item.dayLabel}, ${item.watTime} (${item.utcTime})`)
    }
    lines.push("")
  }

  if (content.weekInReview.length) {
    lines.push(LINE)
    lines.push("THE WEEK IN REVIEW")
    content.weekInReview.forEach((post, index) => {
      lines.push(`${index + 1}. ${post.title}`)
      lines.push(`   ${post.url}`)
    })
    lines.push("")
  }

  if (content.upcoming.length) {
    lines.push(LINE)
    lines.push("COMING SOON")
    for (const item of content.upcoming) {
      lines.push(`* ${item.title} (${item.format}) — ${item.startLabel}`)
    }
    lines.push("")
  }

  if (content.trending.length) {
    lines.push(LINE)
    lines.push("TRENDING ON THE SITE")
    for (const item of content.trending) {
      lines.push(`* ${item.title} — ${item.url}`)
    }
    lines.push("")
  }

  lines.push(LINE)
  lines.push("You are receiving this because you subscribed on otakunaija.name.ng.")
  lines.push(`Unsubscribe: ${links.unsubscribeOneClick}`)
  lines.push(`Email preferences: ${links.preferences}`)
  lines.push(brand.postalAddress)
  lines.push("")
  lines.push(`Home ${links.home} · Blog ${links.blog} · Episodes ${links.episodes} · Upcoming ${links.upcoming}`)

  return lines.join("\n").replace(/\n{3,}/g, "\n\n")
}

/**
 * Screenshot pass for the six newsletter layouts.
 *
 * The seeded fixtures deliberately carry Cloudinary placeholder URLs (they show
 * the `f_jpg,q_auto,w_600,c_fill` transformation shape but 404 outside a real
 * Cloudinary account). This script re-renders the exact same emails with the
 * fixture *titles* pointing at their real AniList cover art, so the poster wall
 * and hero blocks can actually be seen. Nothing here ships: it writes into
 * .previews/ only.
 *
 *   npx tsx scripts/newsletter-shot-html.tsx
 *   # then: npx playwright screenshot ... (see docs/newsletter-preview.md)
 */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { allLayoutContexts } from "../lib/newsletter/fixtures"
import { renderIssue } from "../lib/newsletter/render"
import type { IssueContent } from "../lib/newsletter/types"

const OUT = path.join(process.cwd(), ".previews", "newsletter", "shots-html")

/** Real AniList covers, matched to the fixture titles by name. */
const COVERS: { match: string; url: string }[] = [
  {
    match: "solo leveling",
    url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx151807-it355ZgzquUd.png",
  },
  {
    match: "jujutsu",
    url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx113415-LHBAeoZDIsnF.jpg",
  },
  {
    match: "one piece",
    url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx21-ELSYx3yMPcKM.jpg",
  },
  {
    match: "dandadan",
    url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx171018-60q1B6GK2Ghb.jpg",
  },
  {
    match: "blue lock",
    url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx137822-U8naszP96vzC.png",
  },
  {
    match: "chainsaw",
    url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx127230-DdP4vAdssLoz.png",
  },
  {
    match: "frieren",
    url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx154587-qQTzQnEJJ3oB.jpg",
  },
  {
    match: "sakamoto",
    url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx177709-e5Qx6RlsBgD5.png",
  },
  {
    match: "kagurabachi",
    url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx211496-zBucCHCPFFgy.png",
  },
  {
    match: "witch hat",
    url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx147105-rwOX8qyUy8gV.jpg",
  },
  {
    match: "apothecary",
    url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx161645-QLbzHXiYRgV2.jpg",
  },
]

function coverFor(...names: (string | null | undefined)[]): string {
  const haystack = names.filter(Boolean).join(" ").toLowerCase()
  const hit = COVERS.find((entry) => haystack.includes(entry.match))
  return hit?.url ?? COVERS[0].url
}

/** Swap every image slot for real art, keeping everything else identical. */
function withRealCovers(content: IssueContent): IssueContent {
  return {
    ...content,
    topStory: content.topStory
      ? { ...content.topStory, imageUrl: coverFor(content.topStory.title), coverImage: coverFor(content.topStory.title) }
      : null,
    posts: content.posts.map((post) => ({
      ...post,
      imageUrl: coverFor(post.title),
      coverImage: coverFor(post.title),
    })),
    seriesGroups: content.seriesGroups.map((group) => ({
      ...group,
      posterUrl: coverFor(group.title),
    })),
    airing: content.airing.map((item) => ({ ...item, coverUrl: coverFor(item.title) })),
    schedule: content.schedule.map((day) => ({
      ...day,
      items: day.items.map((item) => ({ ...item, coverUrl: coverFor(item.title) })),
    })),
    upcoming: content.upcoming.map((item) => ({ ...item, coverUrl: coverFor(item.title) })),
    trending: content.trending.map((item) => ({ ...item, posterUrl: coverFor(item.title) })),
    weekInReview: content.weekInReview.map((post) => ({
      ...post,
      imageUrl: coverFor(post.title),
      coverImage: coverFor(post.title),
    })),
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })

  for (const { layout, ctx } of allLayoutContexts()) {
    const rendered = await renderIssue({
      ...ctx,
      layout,
      content: withRealCovers(ctx.content),
      token: "previewtoken0000000000000000a1b2",
    })
    await writeFile(path.join(OUT, `${layout}.html`), rendered.html, "utf8")
    console.log(`${layout.padEnd(14)} -> ${(rendered.bytes / 1024).toFixed(1)} KB`)
  }

  console.log(`\nWrote shot HTML to ${path.relative(process.cwd(), OUT)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

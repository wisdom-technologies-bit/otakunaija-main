import { getAllSlugs, getPostBySlug } from "@/lib/posts"

const BASE = "https://otakunaija.name.ng"

export async function GET() {
  const slugs = await getAllSlugs()

  // Pull full post details (title, excerpt) for the most recent 30 posts —
  // RSS feeds are conventionally capped rather than listing everything ever published
  const recentSlugs = slugs.slice(0, 30)
  const posts = await Promise.all(recentSlugs.map((s) => getPostBySlug(s.slug)))

  const items = posts
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map(
      (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${BASE}/blog/${post.slug}</link>
      <guid isPermaLink="true">${BASE}/blog/${post.slug}</guid>
      <description><![CDATA[${post.excerpt}]]></description>
      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
      <category>${post.category}</category>
    </item>`
    )
    .join("")

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>OtakuNaija</title>
    <link>${BASE}</link>
    <description>Nigeria's home for anime news, reviews, and guides.</description>
    <language>en</language>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  })
}
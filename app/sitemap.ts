import type { MetadataRoute } from "next"
import { CATEGORIES, getAllSlugs } from "@/lib/posts"
import { getAllSeriesWithEpisodesForSitemap } from "@/lib/db/queries"
import { getPublicPollSlugs } from "@/lib/db/queries/polls"

export const dynamic = "force-dynamic"

const BASE = "https://otakunaija.name.ng"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getAllSlugs()
  const allSeries = await getAllSeriesWithEpisodesForSitemap()
  const publicPolls = await getPublicPollSlugs()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/blog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/polls`, changeFrequency: "daily", priority: 0.8 },
  ]

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${BASE}/blog?category=${encodeURIComponent(c)}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }))

  const postRoutes: MetadataRoute.Sitemap = slugs.map((s) => ({
    url: `${BASE}/blog/${s.slug}`,
    lastModified: new Date(s.published_at),
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  const episodesLandingRoute: MetadataRoute.Sitemap = [
    { url: `${BASE}/episodes`, changeFrequency: "daily", priority: 0.9 },
  ]

  const seriesRoutes: MetadataRoute.Sitemap = allSeries.map((s) => ({
    url: `${BASE}/episodes/${s.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  const pollRoutes: MetadataRoute.Sitemap = publicPolls.map((poll) => ({
    url: `${BASE}/polls/${poll.slug}`,
    lastModified: poll.updatedAt || undefined,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }))

  const episodeRoutes: MetadataRoute.Sitemap = allSeries.flatMap((s) =>
    s.episodes.map((e) => ({
      url: `${BASE}/episodes/${s.slug}/${e.slug}`,
      lastModified: e.publishedAt ? new Date(e.publishedAt) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  )

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...postRoutes,
    ...episodesLandingRoute,
    ...seriesRoutes,
    ...episodeRoutes,
    ...pollRoutes,
  ]
}

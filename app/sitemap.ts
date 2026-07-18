import type { MetadataRoute } from "next"
import { CATEGORIES, getAllSlugs } from "@/lib/posts"
import { getAllSeriesWithEpisodesForSitemap } from "@/lib/db/queries"

const BASE = "https://otakunaija.name.ng"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getAllSlugs()
  const allSeries = await getAllSeriesWithEpisodesForSitemap()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/blog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.3 },
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

  return [...staticRoutes, ...categoryRoutes, ...postRoutes]
}

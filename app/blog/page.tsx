import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SearchBar } from "@/components/search-bar"
import { AdSlot } from "@/components/ad-slot"
import { BlogListing } from "@/components/blog/blog-listing"
import { BlogCategoryPills } from "@/components/blog/blog-category-pills"
import { BlogSidebar } from "@/components/blog/blog-sidebar"
import { BLOG_CATEGORIES, getAllPosts, getNewsPosts, getTrendingPosts } from "@/lib/posts"
import { isNewPost } from "@/lib/post-ui"
import { PollPlacement } from "@/components/poll-placement"

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>
}): Promise<Metadata> {
  const sp = await searchParams
  const category =
    sp.category && BLOG_CATEGORIES.includes(sp.category as (typeof BLOG_CATEGORIES)[number])
      ? sp.category
      : undefined

  return {
    title: category ? `${category}` : "Blog",
    description: category
      ? category === "News"
        ? "Latest anime, manga and game news, published daily on OtakuNaija."
        : `Browse all ${category} anime articles on OtakuNaija.`
      : "Browse all anime articles on OtakuNaija — Shonen, Romance, Action, and guides for Nigerian anime fans.",
    alternates: {
      canonical: category ? `/blog?category=${encodeURIComponent(category)}` : "/blog",
    },
  }
}

type Search = { category?: string; q?: string }

export const dynamic = "force-dynamic"

const PAGE_SIZE = 10

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const sp = await searchParams
  const category = sp.category && BLOG_CATEGORIES.includes(sp.category as (typeof BLOG_CATEGORIES)[number])
    ? sp.category
    : undefined
  const q = sp.q?.trim() || undefined

  const [posts, trending, news] = await Promise.all([
    getAllPosts({ category, search: q, limit: PAGE_SIZE }),
    getTrendingPosts(5),
    getNewsPosts(8),
  ])

  const headline = q
    ? `Search results for "${q}"`
    : category
      ? `${category} anime`
      : "All articles"

  const hasFreshNews = news.some((post) => isNewPost(post.published_at))
  const countLabel = `${posts.length}${posts.length === PAGE_SIZE ? "+" : ""} article${posts.length === 1 ? "" : "s"}`

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://otakunaija.name.ng/"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Blog",
                "item": "https://otakunaija.name.ng/blog"
              }
            ]
          })
        }}
      />
      <SiteHeader />

      <main className="otk-page flex-1">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="py-4">
            <AdSlot slot="header" />
          </div>

          <header className="pb-5 pt-2">
            <nav aria-label="Breadcrumb" className="text-xs text-[var(--otk-text-dim)]">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                  <Link href="/" className="otk-focus hover:text-[var(--otk-accent)]">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/blog" className="otk-focus hover:text-[var(--otk-accent)]">
                    Blog
                  </Link>
                </li>
                {category ? (
                  <>
                    <li aria-hidden="true">/</li>
                    <li>
                      <span aria-current="page" className="font-semibold text-[var(--otk-text)]">
                        {category}
                      </span>
                    </li>
                  </>
                ) : null}
                {q ? (
                  <>
                    <li aria-hidden="true">/</li>
                    <li>
                      <span aria-current="page" className="font-semibold text-[var(--otk-text)]">
                        Search
                      </span>
                    </li>
                  </>
                ) : null}
              </ol>
            </nav>

            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
              <div className="min-w-0">
                <p className="otk-eyebrow">OtakuNaija Blog</p>
                <h1 className="otk-display mt-2 text-3xl md:text-5xl">{headline}</h1>
                <p className="otk-meta mt-2">
                  <span>{countLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>Curated by the OtakuNaija editorial team</span>
                </p>
              </div>
              <div className="w-full md:max-w-sm">
                <SearchBar defaultValue={q} compact />
              </div>
            </div>
          </header>

          <BlogCategoryPills category={category} search={q} hasFreshNews={hasFreshNews} />

          <section className="py-8" aria-label="Articles">
            <div className="otk-layout">
              <div className="min-w-0">
                <BlogListing
                  posts={posts}
                  totalLoaded={posts.length}
                  category={category}
                  search={q}
                  trendingIds={trending.map((post) => post.id)}
                  inlineAd={<AdSlot slot="footer" />}
                />
              </div>

              <div className="min-w-0 space-y-8">
                <BlogSidebar trending={trending} news={news} />
                <PollPlacement source="blog" className="hidden lg:block" />
              </div>
            </div>
          </section>

          <PollPlacement source="blog" className="mx-auto mb-12 max-w-2xl lg:hidden" />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

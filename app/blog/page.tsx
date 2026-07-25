import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { PostCard } from "@/components/post-card"
import { Sidebar } from "@/components/sidebar"
import { SearchBar } from "@/components/search-bar"
import { AdSlot } from "@/components/ad-slot"
import { InfinitePostList } from "@/components/infinite-post-list"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { CATEGORIES, getAllPosts, getRecentPosts, getTrendingPosts } from "@/lib/posts"

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>
}): Promise<Metadata> {
  const sp = await searchParams
  const category =
    sp.category && CATEGORIES.includes(sp.category as (typeof CATEGORIES)[number])
      ? sp.category
      : undefined

  return {
    title: category ? `${category}` : "Blog",
    description: category
      ? `Browse all ${category} anime articles on OtakuNaija.`
      : "Browse all anime articles on OtakuNaija — Shonen, Romance, Action, and guides for Nigerian anime fans.",
    alternates: {
      canonical: category ? `/blog?category=${encodeURIComponent(category)}` : "/blog",
    },
  }
}

type Search = { category?: string; q?: string }

export const revalidate = 300

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const sp = await searchParams
  const category = sp.category && CATEGORIES.includes(sp.category as (typeof CATEGORIES)[number])
    ? sp.category
    : undefined
  const q = sp.q?.trim() || undefined

  const [posts, recent, trending] = await Promise.all([
    getAllPosts({ category, search: q }),
    getRecentPosts(4),
    getTrendingPosts(5),
  ])

  const headline = q
    ? `Search results for "${q}"`
    : category
      ? `${category} anime`
      : "All articles"

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="py-4">
            <AdSlot slot="header" />
          </div>

          <section className="pt-6 pb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">OtakuNaija Blog</p>
            <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight text-balance">
              {headline}
            </h1>
            <p className="mt-3 max-w-2xl text-sm md:text-base text-muted-foreground">
              {posts.length} article{posts.length === 1 ? "" : "s"} · Curated by the OtakuNaija editorial team.
            </p>

            <div className="mt-6 max-w-2xl">
              <SearchBar defaultValue={q} />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link
                href="/blog"
                className={`rounded-full border px-3 py-1 text-xs font-medium ${!category && !q
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground/80 hover:border-primary hover:text-primary"
                  }`}
              >
                All
              </Link>
              {CATEGORIES.map((c) => (
                <Link
                  key={c}
                  href={`/blog?category=${encodeURIComponent(c)}`}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground/80 hover:border-primary hover:text-primary"
                    }`}
                >
                  {c}
                </Link>
              ))}
            </div>
          </section>

          <section className="pb-14">
            <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
              <div>
                {posts.length === 0 ? (
                  <Empty className="rounded-xl border border-border bg-card">
                    <EmptyHeader>
                      <EmptyTitle>No articles found</EmptyTitle>
                      <EmptyDescription>
                        Try a different search term or browse a category from the filters above.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <>
                    <div className="grid gap-6 sm:grid-cols-2">
                      {posts.slice(0, 4).map((p) => (
                        <PostCard key={p.id} post={p} />
                      ))}
                    </div>

                    {posts.length > 4 ? (
                      <div className="my-10">
                        <AdSlot slot="footer" />
                      </div>
                    ) : null}

                    {posts.length > 4 ? (
                      <InfinitePostList
                        initialPosts={posts.slice(4)}
                        initialOffset={posts.length}
                        category={category}
                      />
                    ) : null}
                  </>
                )}
              </div>

              <Sidebar recent={recent} trending={trending} />
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

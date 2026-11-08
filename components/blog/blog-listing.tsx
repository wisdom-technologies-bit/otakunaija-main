"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import { LayoutGrid, List, SearchX } from "lucide-react"
import { InfinitePostList, type ListingView } from "@/components/infinite-post-list"
import { PostCard } from "@/components/post-card"
import type { Post } from "@/lib/posts"

const STORAGE_KEY = "otakunaija:blog-view"

type BlogListingProps = {
  posts: Post[]
  totalLoaded: number
  category?: string
  search?: string
  trendingIds: number[]
  inlineAd?: ReactNode
}

function readStoredView(): ListingView {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "list" ? "list" : "grid"
  } catch {
    return "grid"
  }
}

/**
 * Blog results: lead story, first cards, view toggle (remembered in
 * localStorage) and the infinite list below.
 */
export function BlogListing({ posts, totalLoaded, category, search, trendingIds, inlineAd }: BlogListingProps) {
  const [view, setView] = useState<ListingView>("grid")

  useEffect(() => {
    setView(readStoredView())
  }, [])

  const changeView = (next: ListingView) => {
    setView(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* private mode: keep the in-memory choice */
    }
  }

  if (posts.length === 0) {
    const clearHref = category || search ? "/blog" : "/blog"
    return (
      <div className="otk-empty">
        <SearchX className="size-8 text-[var(--otk-accent)]" aria-hidden="true" />
        <h2 className="text-lg font-bold text-[var(--otk-text)]">No articles found</h2>
        <p className="max-w-sm text-sm text-[var(--otk-text-dim)]">
          Nothing matches this combination of filters. Try a different search term or browse every
          category.
        </p>
        <Link href={clearHref} className="otk-pill otk-focus mt-2">
          Clear filters
        </Link>
      </div>
    )
  }

  const lead = posts[0]
  const firstCards = posts.slice(1, 4)
  const rest = posts.slice(4)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="otk-meta" aria-live="polite">
          Showing {posts.length}
          {rest.length > 0 ? "+" : ""} of {totalLoaded} article{totalLoaded === 1 ? "" : "s"} on this page
        </p>
        <div className="flex items-center gap-1 rounded-full border border-[var(--otk-border)] p-1">
          <button
            type="button"
            className="otk-focus inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold"
            aria-pressed={view === "grid"}
            data-active={view === "grid"}
            onClick={() => changeView("grid")}
            style={
              view === "grid"
                ? { background: "var(--otk-accent)", color: "var(--otk-accent-foreground)" }
                : { color: "var(--otk-text-dim)" }
            }
          >
            <LayoutGrid className="size-3.5" aria-hidden="true" />
            Grid
          </button>
          <button
            type="button"
            className="otk-focus inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold"
            aria-pressed={view === "list"}
            data-active={view === "list"}
            onClick={() => changeView("list")}
            style={
              view === "list"
                ? { background: "var(--otk-accent)", color: "var(--otk-accent-foreground)" }
                : { color: "var(--otk-text-dim)" }
            }
          >
            <List className="size-3.5" aria-hidden="true" />
            List
          </button>
        </div>
      </div>

      {view === "grid" ? (
        <>
          <div className="mt-4">
            <PostCard post={lead} variant="lead" aspect="16/10" priority headingLevel="h2" />
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {firstCards.map((post) => (
              <PostCard key={post.id} post={post} variant="grid" />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {[lead, ...firstCards].map((post) => (
            <PostCard key={post.id} post={post} variant="list" priority={post.id === lead.id} />
          ))}
        </div>
      )}

      {inlineAd ? <div className="my-8">{inlineAd}</div> : null}

      <InfinitePostList
        key={view}
        initialPosts={rest}
        initialOffset={posts.length}
        category={category}
        search={search}
        trendingIds={trendingIds}
        view={view}
      />
    </div>
  )
}

export default BlogListing

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { PostCard } from "@/components/post-card"
import { loadMorePosts } from "@/app/actions/load-more-posts"
import type { Post } from "@/lib/posts"
import { Loader2 } from "lucide-react"

export type ListingView = "grid" | "list"

interface InfinitePostListProps {
  initialPosts: Post[]
  initialOffset: number
  category?: string | null
  search?: string | null
  trendingIds: number[]
  view?: ListingView
  pageSize?: number
}

/**
 * Infinite blog list. Keeps the IntersectionObserver behaviour, adds the
 * "Showing X of Y" counter and an explicit Load more button that also covers
 * browsers without IntersectionObserver and retries after an error.
 */
export function InfinitePostList({
  initialPosts,
  initialOffset,
  category,
  search,
  view = "grid",
  pageSize = 10,
}: InfinitePostListProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [offset, setOffset] = useState(initialOffset)
  const [loadedOnPage, setLoadedOnPage] = useState(initialPosts.length)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [canObserve, setCanObserve] = useState(true)
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError(false)
    try {
      const newPosts = await loadMorePosts(offset, pageSize, category ?? undefined, search ?? undefined)
      if (newPosts.length === 0) {
        hasMoreRef.current = false
        setHasMore(false)
      } else {
        setPosts((prev) => {
          const seen = new Set(prev.map((post) => post.id))
          return [...prev, ...newPosts.filter((post) => !seen.has(post.id))]
        })
        setOffset((prev) => prev + newPosts.length)
        setLoadedOnPage((prev) => prev + newPosts.length)
        if (newPosts.length < pageSize) {
          hasMoreRef.current = false
          setHasMore(false)
        }
      }
    } catch (err) {
      console.error("Failed to load more posts:", err)
      setError(true)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [offset, category, search, pageSize])

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setCanObserve(false)
      return
    }
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: "400px 0px", threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, hasMore])

  const isEmpty = posts.length === 0

  return (
    <div>
      {!isEmpty ? (
        <div
          className={
            view === "grid"
              ? "mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              : "mt-6 flex flex-col gap-3"
          }
        >
          {posts.map((post) => (
            <PostCard key={post.id} post={post} variant={view === "grid" ? "grid" : "list"} />
          ))}
        </div>
      ) : null}

      {loading ? (
        <div
          className={
            view === "grid" ? "mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" : "mt-4 flex flex-col gap-3"
          }
          aria-label="Loading more articles"
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className={view === "grid" ? "otk-skeleton aspect-[16/10]" : "otk-skeleton h-24"}
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-[var(--otk-border)] bg-[var(--otk-surface)] px-4 py-3 text-sm">
          <span className="text-[var(--otk-text-dim)]">Couldn&apos;t load more articles.</span>
          <button
            type="button"
            className="otk-focus font-semibold text-[var(--otk-accent)]"
            onClick={() => void loadMore()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {hasMore ? (
        <div className="mt-8 flex flex-col items-center gap-3">
          {canObserve ? (
            <div ref={sentinelRef} className="flex h-6 items-center justify-center" aria-hidden="true">
              {loading ? <Loader2 className="size-5 animate-spin text-[var(--otk-accent)]" /> : null}
            </div>
          ) : null}
          <button
            type="button"
            className="otk-pill otk-focus"
            onClick={() => void loadMore()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more articles"}
          </button>
          {!canObserve ? (
            <p className="text-xs text-[var(--otk-text-dim)]">
              Your browser can&apos;t auto-load, so use the button above.
            </p>
          ) : null}
        </div>
      ) : (
        !isEmpty && (
          <p className="py-8 text-center text-sm text-[var(--otk-text-dim)]">
            Showing all {loadedOnPage} articles. Check back soon for more.
          </p>
        )
      )}
    </div>
  )
}

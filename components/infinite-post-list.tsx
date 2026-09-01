'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { PostCard } from '@/components/post-card'
import { MobileTrendingRow } from '@/components/mobile-trending-row'
import { loadMorePosts } from '@/app/actions/load-more-posts'
import type { Post } from '@/lib/posts'
import { Loader2 } from 'lucide-react'

interface InfinitePostListProps {
  initialPosts: Post[]
  initialOffset: number
  category?: string | null
  trendingIds: number[]
}

export function InfinitePostList({
  initialPosts,
  initialOffset,
  category,
  trendingIds,
}: InfinitePostListProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [offset, setOffset] = useState(initialOffset)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialPosts.length >= 10)
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const trendingSet = new Set(trendingIds)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    setLoading(true)
    try {
      const newPosts = await loadMorePosts(offset, 10, category ?? undefined)
      if (newPosts.length === 0) {
        setHasMore(false)
      } else {
        setPosts((prev) => [...prev, ...newPosts])
        setOffset((prev) => prev + newPosts.length)
        if (newPosts.length < 10) setHasMore(false)
      }
    } catch (err) {
      console.error('Failed to load more posts:', err)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [offset, loading, hasMore, category])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '0px', threshold: 1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <div>
      {/* Desktop: always the full card grid, regardless of trending status */}
      <div className="hidden gap-6 sm:grid sm:grid-cols-2">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>

      {/* Mobile: trending posts render as cards wherever they fall in the list;
          everything else renders as a compact row */}
      <div className="sm:hidden">
        {posts.map((p) =>
          trendingSet.has(p.id) ? (
            <div key={p.id} className="mb-6">
              <PostCard post={p} />
            </div>
          ) : (
            <MobileTrendingRow key={p.id} post={p} />
          )
        )}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {loading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          You&apos;ve reached the end — check back soon for more.
        </p>
      )}
    </div>
  )
}

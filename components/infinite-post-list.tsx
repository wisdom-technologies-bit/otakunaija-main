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
}

const CARD_STYLE_COUNT = 5 // first 5 posts always use the full PostCard, even on mobile

export function InfinitePostList({ initialPosts, initialOffset, category }: InfinitePostListProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [offset, setOffset] = useState(initialOffset)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialPosts.length > 0)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
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
      { rootMargin: '400px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  const cardPosts = posts.slice(0, CARD_STYLE_COUNT)
  const rowPosts = posts.slice(CARD_STYLE_COUNT)

  return (
    <div>
      {/* First 5 posts: always the full card style, on every breakpoint */}
      <div className="grid gap-6 sm:grid-cols-2">
        {cardPosts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>

      {/* Remaining posts: compact rows on mobile, full cards on desktop */}
      {rowPosts.length > 0 && (
        <>
          <div className="mt-6 sm:hidden">
            {rowPosts.map((p) => (
              <MobileTrendingRow key={p.id} post={p} />
            ))}
          </div>
          <div className="mt-6 hidden gap-6 sm:grid sm:grid-cols-2">
            {rowPosts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </>
      )}

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
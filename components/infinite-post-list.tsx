'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { PostCard } from '@/components/post-card'
import { loadMorePosts } from '@/app/actions/load-more-posts'
import type { Post } from '@/lib/posts'
import { Loader2 } from 'lucide-react'

interface InfinitePostListProps {
  initialPosts: Post[]
  initialOffset: number
  category?: string | null
}

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
      { rootMargin: '400px' } // start loading a bit before the sentinel is actually visible
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
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
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { loadMorePosts } from "@/app/actions/load-more-posts"
import { CATEGORIES, type Post } from "@/lib/posts"
import { HomeSectionHeading } from "@/components/home/home-section-heading"
import { PostCard } from "@/components/post-card"

const PAGE_SIZE = 10

type HomeFeedProps = {
  initialPosts: Post[]
  initialOffset: number
  inlineAd: React.ReactNode
}

function uniquePosts(posts: Post[]) {
  return Array.from(new Map(posts.map((post) => [post.id, post])).values())
}

/**
 * Bottom "More stories" feed: category pills, infinite loading, retry and
 * empty states, now rendering the shared post cards.
 */
export function HomeFeed({ initialPosts, initialOffset, inlineAd }: HomeFeedProps) {
  const [category, setCategory] = useState<string>()
  const [posts, setPosts] = useState(initialPosts)
  const [offset, setOffset] = useState(initialOffset)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [announcement, setAnnouncement] = useState("")
  const requestId = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const categoryRef = useRef<string | undefined>(undefined)
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const postsRef = useRef(initialPosts)
  const offsetRef = useRef(initialOffset)

  const fetchPosts = useCallback(
    async (nextCategory: string | undefined, nextOffset: number, replace = false) => {
      const id = ++requestId.current
      loadingRef.current = true
      setLoading(true)
      setError(false)
      setAnnouncement("Loading more stories")
      try {
        const result = await loadMorePosts(nextOffset, PAGE_SIZE, nextCategory)
        if (id !== requestId.current) return
        const nextPosts = replace ? result : uniquePosts([...postsRef.current, ...result])
        postsRef.current = nextPosts
        setPosts(nextPosts)
        const nextOffsetValue = nextOffset + result.length
        offsetRef.current = nextOffsetValue
        setOffset(nextOffsetValue)
        const more = result.length === PAGE_SIZE
        hasMoreRef.current = more
        setHasMore(more)
        setAnnouncement(`${result.length} stories loaded`)
      } catch {
        if (id !== requestId.current) return
        setError(true)
        setAnnouncement("Couldn't load more stories.")
      } finally {
        if (id === requestId.current) {
          loadingRef.current = false
          setLoading(false)
        }
      }
    },
    [],
  )

  const selectCategory = (nextCategory?: string) => {
    const normalized = nextCategory || undefined
    categoryRef.current = normalized
    requestId.current += 1
    setCategory(normalized)
    setError(false)
    if (normalized) {
      postsRef.current = []
      setPosts([])
      offsetRef.current = 0
      setOffset(0)
      hasMoreRef.current = true
      setHasMore(true)
      void fetchPosts(normalized, 0, true)
    } else {
      postsRef.current = initialPosts
      setPosts(initialPosts)
      offsetRef.current = initialOffset
      setOffset(initialOffset)
      hasMoreRef.current = true
      setHasMore(true)
    }
  }

  const retry = () => void fetchPosts(categoryRef.current, offsetRef.current, false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreRef.current && !loadingRef.current) retry()
      },
      { rootMargin: "600px 0px", threshold: 0 },
    )
    observerRef.current.observe(sentinel)
    return () => observerRef.current?.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  const lead = posts[0]
  const rest = posts.slice(1)

  return (
    <section className="min-w-0 w-full max-w-full" aria-labelledby="latest-articles-heading">
      <HomeSectionHeading
        eyebrow="Fresh from the feed"
        title="More stories"
        href="/blog"
        id="latest-articles-heading"
      />

      <div
        className="otk-chip-scroller mt-5"
        role="group"
        aria-label="Filter articles by genre"
      >
        <button
          type="button"
          className="otk-pill otk-focus"
          aria-pressed={!category}
          data-active={!category}
          aria-current={!category ? "page" : undefined}
          onClick={() => selectCategory()}
        >
          All
        </button>
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            className="otk-pill otk-focus"
            aria-pressed={category === item}
            data-active={category === item}
            aria-current={category === item ? "page" : undefined}
            onClick={() => selectCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-6 min-w-0 max-w-full" aria-busy={loading}>
        {lead ? <PostCard post={lead} variant="lead" aspect="16/9" headingLevel="h3" /> : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rest.map((post, index) => (
            <div key={post.id} className="contents">
              <PostCard post={post} variant="grid" className="otk-card-adaptive" />
              {index === 3 ? <div className="col-span-full my-4">{inlineAd}</div> : null}
            </div>
          ))}
        </div>

        {posts.length > 0 && posts.length < 5 ? <div className="my-8">{inlineAd}</div> : null}

        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading more stories">
            {[1, 2, 3].map((item) => (
              <div key={item} className="otk-skeleton aspect-[16/10]" />
            ))}
          </div>
        ) : null}

        {!loading && !posts.length && category ? (
          <div className="otk-empty mt-6">
            <p className="text-sm font-semibold text-[var(--otk-text)]">No stories in this genre yet.</p>
            <button type="button" className="otk-pill otk-focus" onClick={() => selectCategory()}>
              Show all stories
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-[var(--otk-radius)] border border-[var(--otk-border)] bg-[var(--otk-surface)] px-4 py-3 text-sm">
            <span className="text-[var(--otk-text-dim)]">Couldn&apos;t load more stories.</span>
            <button
              type="button"
              className="otk-focus font-semibold text-[var(--otk-accent)]"
              onClick={retry}
            >
              Try again
            </button>
          </div>
        ) : null}

        {hasMore ? (
          <div ref={sentinelRef} className="h-4" aria-hidden="true" />
        ) : (
          <div className="flex items-center justify-center gap-4 py-8 text-sm text-[var(--otk-text-dim)]">
            <span>You&apos;re all caught up.</span>
            <button
              type="button"
              className="otk-focus text-[var(--otk-accent)]"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              Back to top
            </button>
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  )
}

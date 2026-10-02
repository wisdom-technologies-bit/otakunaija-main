"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { loadMorePosts } from "@/app/actions/load-more-posts"
import { CATEGORIES, type Post } from "@/lib/posts"
import { HomeCard } from "@/components/home/home-card"
import { HomeSectionHeading } from "@/components/home/home-section-heading"

const PAGE_SIZE = 10

type HomeFeedProps = {
  initialPosts: Post[]
  initialOffset: number
  inlineAd: React.ReactNode
}

function uniquePosts(posts: Post[]) {
  return Array.from(new Map(posts.map((post) => [post.id, post])).values())
}

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

  const fetchPosts = useCallback(async (nextCategory: string | undefined, nextOffset: number, replace = false) => {
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
  }, [])

  const postsRef = useRef(initialPosts)
  const offsetRef = useRef(initialOffset)

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
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMoreRef.current && !loadingRef.current) retry()
    }, { rootMargin: "600px 0px", threshold: 0 })
    observerRef.current.observe(sentinel)
    return () => observerRef.current?.disconnect()
  }, [category])

  const lead = posts[0]
  const rest = posts.slice(1)

  return (
    <section className="hp-section pt-10 md:pt-14" aria-labelledby="latest-articles-heading">
      <HomeSectionHeading eyebrow="Fresh from the feed" title="Latest articles" href="/blog" />
      <div className="mt-7 flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter articles by genre">
        <button type="button" className={`hp-focus shrink-0 snap-start rounded-full px-4 py-2 text-sm font-semibold ${!category ? "bg-[var(--hp-accent)] text-primary-foreground" : "bg-[var(--hp-surface)] text-[var(--hp-text-dim)]"}`} aria-pressed={!category} onClick={() => selectCategory()}>All</button>
        {CATEGORIES.map((item) => <button key={item} type="button" className={`hp-focus shrink-0 snap-start rounded-full px-4 py-2 text-sm font-semibold ${category === item ? "bg-[var(--hp-accent)] text-primary-foreground" : "bg-[var(--hp-surface)] text-[var(--hp-text-dim)]"}`} aria-pressed={category === item} onClick={() => selectCategory(item)}>{item}</button>)}
      </div>

      <div className="mt-8" aria-busy={loading}>
        {lead ? <HomeCard post={lead} variant="wide" priority /> : null}
        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rest.map((post, index) => <div key={post.id} className="contents"><span className="sm:hidden"><HomeCard post={post} variant="row" /></span><span className="hidden sm:block"><HomeCard post={post} variant="poster" /></span>{index === 3 ? <span className="col-span-full my-8">{inlineAd}</span> : null}</div>)}
        </div>
        {posts.length > 0 && posts.length < 5 ? <div className="my-8">{inlineAd}</div> : null}
        {loading ? <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading more stories">{[1, 2, 3].map((item) => <div key={item} className="home-feed-skeleton aspect-[3/4] rounded-[var(--hp-radius-lg)]" />)}</div> : null}
        {!loading && !posts.length && category ? <div className="mt-8 rounded-[var(--hp-radius-lg)] bg-[var(--hp-surface)] p-10 text-center"><p className="hp-title">No stories in this genre yet.</p><button type="button" className="hp-focus mt-5 rounded-full bg-[var(--hp-accent)] px-5 py-2.5 text-sm font-semibold text-primary-foreground" onClick={() => selectCategory()}>Show all stories</button></div> : null}
        {error ? <div className="mt-8 flex items-center justify-between rounded-[var(--hp-radius)] bg-[var(--hp-surface)] px-5 py-4 text-sm"><span>Couldn&apos;t load more stories.</span><button type="button" className="hp-focus font-semibold text-[var(--hp-accent)]" onClick={retry}>Try again</button></div> : null}
        {hasMore ? <div ref={sentinelRef} className="h-4" aria-hidden="true" /> : <div className="flex items-center justify-center gap-4 py-10 text-sm text-[var(--hp-text-dim)]"><span>You&apos;re all caught up.</span><button type="button" className="hp-focus text-[var(--hp-accent)]" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Back to top</button></div>}
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </section>
  )
}

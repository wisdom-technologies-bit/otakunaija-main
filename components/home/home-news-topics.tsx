"use client"

import Link from "next/link"
import { useCallback, useRef, useState } from "react"
import { loadMorePosts } from "@/app/actions/load-more-posts"
import { HomeSectionHeading } from "@/components/home/home-section-heading"
import { PostCard } from "@/components/post-card"
import { nextTabIndex } from "@/lib/tabs-keyboard"
import type { Post } from "@/lib/posts"

type HomeNewsTopicsProps = {
  tabs: readonly string[]
  initialPosts: Post[]
  initialTab?: string
  limit?: number
}

/**
 * "News by topic" tabs. The first tab is prefetched on the server; other tabs
 * reuse the existing loadMorePosts server action. Arrow keys, Home and End move
 * between tabs (roving tabindex), with the standard tab roles.
 */
export function HomeNewsTopics({ tabs, initialPosts, initialTab, limit = 6 }: HomeNewsTopicsProps) {
  const firstTab = initialTab ?? tabs[0]
  const [active, setActive] = useState(firstTab)
  const [postsByTab, setPostsByTab] = useState<Record<string, Post[]>>({ [firstTab]: initialPosts })
  const [loadingTab, setLoadingTab] = useState<string | null>(null)
  const [failedTab, setFailedTab] = useState<string | null>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const cacheRef = useRef<Record<string, Post[]>>({ [firstTab]: initialPosts })

  const load = useCallback(
    async (tab: string) => {
      if (cacheRef.current[tab]) return
      setLoadingTab(tab)
      setFailedTab(null)
      try {
        const posts = await loadMorePosts(0, limit, tab)
        cacheRef.current[tab] = posts
        setPostsByTab((prev) => ({ ...prev, [tab]: posts }))
      } catch {
        setFailedTab(tab)
      } finally {
        setLoadingTab((current) => (current === tab ? null : current))
      }
    },
    [limit],
  )

  const select = useCallback(
    (tab: string) => {
      setActive(tab)
      void load(tab)
    },
    [load],
  )

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
    const next = nextTabIndex(index, tabs.length, event.key)
    if (next === null) return
    event.preventDefault()
    select(tabs[next])
    tabRefs.current[next]?.focus()
  }

  const activePosts = postsByTab[active] ?? []
  const isLoading = loadingTab === active
  const hasFailed = failedTab === active

  return (
    <section className="otk-section" aria-labelledby="home-news-topics-heading">
      <HomeSectionHeading
        eyebrow="By topic"
        title="News by topic"
        href="/blog?category=News"
        linkLabel="All news"
        id="home-news-topics-heading"
      />

      <div className="otk-tablist" role="tablist" aria-label="News by topic">
        {tabs.map((tab, index) => {
          const selected = tab === active
          return (
            <button
              key={tab}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`home-news-tab-${tab}`}
              aria-selected={selected}
              aria-controls="home-news-tabpanel"
              tabIndex={selected ? 0 : -1}
              className="otk-tab otk-focus"
              onClick={() => select(tab)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id="home-news-tabpanel"
        aria-labelledby={`home-news-tab-${active}`}
        aria-busy={isLoading}
        className="mt-2"
      >
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading articles">
            {[0, 1, 2].map((item) => (
              <div key={item} className="otk-skeleton aspect-[16/10]" />
            ))}
          </div>
        ) : null}

        {!isLoading && hasFailed ? (
          <div className="otk-empty">
            <p className="text-sm font-semibold text-[var(--otk-text)]">Couldn&apos;t load this topic.</p>
            <button
              type="button"
              className="otk-pill otk-focus otk-tap"
              onClick={() => {
                delete cacheRef.current[active]
                void load(active)
              }}
            >
              Try again
            </button>
          </div>
        ) : null}

        {!isLoading && !hasFailed && activePosts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activePosts.slice(0, limit).map((post) => (
              <PostCard key={post.id} post={post} variant="grid" />
            ))}
          </div>
        ) : null}

        {!isLoading && !hasFailed && activePosts.length === 0 ? (
          <p className="text-sm text-[var(--otk-text-dim)]">Nothing published in this topic yet.</p>
        ) : null}

        <div className="mt-4">
          <Link
            href={`/blog?category=${encodeURIComponent(active)}`}
            className="otk-focus text-sm font-semibold text-[var(--otk-accent)]"
          >
            View all {active}
          </Link>
        </div>
      </div>
    </section>
  )
}

export default HomeNewsTopics

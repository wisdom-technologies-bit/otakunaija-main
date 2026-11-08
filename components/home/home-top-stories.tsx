import { PostCard } from "@/components/post-card"
import { HomeSectionHeading } from "@/components/home/home-section-heading"
import type { Post } from "@/lib/posts"

type HomeTopStoriesProps = {
  lead?: Post
  secondary: Post[]
  grid: Post[]
}

/**
 * "Top stories": one lead card, a stack of compact cards and a standard grid.
 * Tablet puts the lead on top with a two-column stack; phones get a one-column
 * list of row cards. Posts are pre-deduped by the server.
 */
export function HomeTopStories({ lead, secondary, grid }: HomeTopStoriesProps) {
  if (!lead && secondary.length === 0 && grid.length === 0) return null

  return (
    <section className="otk-section" aria-labelledby="home-top-stories-heading">
      <HomeSectionHeading
        eyebrow="Today's front page"
        title="Top stories"
        href="/blog"
        linkLabel="All stories"
        id="home-top-stories-heading"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {lead ? (
          <div className="min-w-0 lg:col-span-2">
            <PostCard post={lead} variant="lead" aspect="16/9" priority headingLevel="h2" />
          </div>
        ) : null}

        {secondary.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            {secondary.map((post) => (
              <PostCard key={post.id} post={post} variant="list" />
            ))}
          </div>
        ) : null}
      </div>

      {grid.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {grid.map((post) => (
            <PostCard key={post.id} post={post} variant="grid" />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default HomeTopStories

import Link from "next/link"
import { RelativeTime } from "@/components/home/relative-time"
import type { Post } from "@/lib/posts"
import { cn } from "@/lib/utils"

type NewsTickerProps = {
  posts: Post[]
  className?: string
  limit?: number
}

function TickerItem({ post }: { post: Post }) {
  return (
    <li className="otk-ticker-item">
      <span aria-hidden="true" className="otk-ticker-sep">
        ◆
      </span>
      <Link href={`/blog/${post.slug}`} className="otk-focus">
        {post.title}
      </Link>
      <span className="otk-ticker-time">
        <RelativeTime date={post.published_at} />
      </span>
    </li>
  )
}

/**
 * Slim "LATEST" bar under the hero. CSS marquee that pauses on hover/focus,
 * becomes a static swipeable strip on phones and under reduced motion.
 */
export function NewsTicker({ posts, className, limit = 6 }: NewsTickerProps) {
  const items = posts.slice(0, limit)
  if (items.length === 0) return null

  return (
    <section className={cn("otk-ticker", className)} aria-label="Latest news">
      <span className="otk-ticker-label">
        <span aria-hidden="true" className="otk-ticker-dot" />
        Latest
      </span>
      <div className="otk-ticker-viewport">
        <div className="otk-ticker-rail">
          <ul className="otk-ticker-list">
            {items.map((post) => (
              <TickerItem key={post.id} post={post} />
            ))}
          </ul>
          <ul className="otk-ticker-list otk-ticker-clone" aria-hidden="true">
            {items.map((post) => (
              <TickerItem key={`clone-${post.id}`} post={post} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export default NewsTicker

import Link from "next/link"
import { BLOG_CATEGORIES } from "@/lib/posts"
import { buildHref } from "@/lib/listing-url"

type BlogCategoryPillsProps = {
  category?: string
  search?: string
  hasFreshNews?: boolean
}

/**
 * Sticky single-row category filter. URL parameters stay the source of truth;
 * the row scrolls horizontally on phones with an edge fade.
 */
export function BlogCategoryPills({ category, search, hasFreshNews = false }: BlogCategoryPillsProps) {
  const current = { category, q: search }
  const isActive = !category && !search

  return (
    <div className="otk-sticky-filters">
      <nav aria-label="Filter articles by category" className="otk-chip-scroller otk-edge-fade">
        <Link
          href={buildHref("/blog", current, { category: undefined, q: undefined })}
          className="otk-pill otk-focus"
          aria-current={isActive ? "page" : undefined}
          data-active={isActive}
        >
          All
        </Link>
        {BLOG_CATEGORIES.map((item) => {
          const active = category === item
          return (
            <Link
              key={item}
              href={buildHref("/blog", current, { category: item, q: undefined })}
              className="otk-pill otk-focus"
              aria-current={active ? "page" : undefined}
              data-active={active}
            >
              {item}
              {item === "News" && hasFreshNews ? (
                <span className="otk-live-dot" aria-label="New story within the last 3 hours" />
              ) : null}
            </Link>
          )
        })}
        {search ? (
          <Link
            href={buildHref("/blog", current, { q: undefined })}
            className="otk-pill otk-focus text-[var(--otk-accent)]"
          >
            Clear search
          </Link>
        ) : null}
      </nav>
    </div>
  )
}

export default BlogCategoryPills

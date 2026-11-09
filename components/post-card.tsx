import Image from "next/image"
import Link from "next/link"
import type { ElementType } from "react"
import { FreshnessBadge } from "@/components/freshness-badge"
import { PostCoverFallback } from "@/components/post-cover-fallback"
import { RelativeTime } from "@/components/home/relative-time"
import { NEW_POST_WINDOW_HOURS, isNewPost, resolveCover, sourceChipLabel } from "@/lib/post-ui"
import type { Post } from "@/lib/posts"
import { cn } from "@/lib/utils"

export type PostCardVariant = "lead" | "featured" | "grid" | "list" | "compact"
export type PostCardAspect = "16/9" | "16/10"

type PostCardProps = {
  post: Post
  variant?: PostCardVariant
  aspect?: PostCardAspect
  className?: string
  priority?: boolean
  showExcerpt?: boolean
  headingLevel?: "h2" | "h3" | "h4"
}

const SIZES: Record<PostCardVariant, string> = {
  lead: "(min-width: 1024px) 60vw, (min-width: 768px) 90vw, 92vw",
  featured: "(min-width: 1024px) 60vw, (min-width: 768px) 90vw, 92vw",
  grid: "(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 92vw",
  list: "(min-width: 640px) 10rem, 7.5rem",
  compact: "5.25rem",
}

const ASPECTS: Record<PostCardAspect, string> = {
  "16/9": "aspect-[16/9]",
  "16/10": "aspect-[16/10]",
}

/**
 * One post card used by the home page and /blog. Metadata is always visible,
 * the whole card is a single link, and a post without a cover renders the
 * shared fallback tile instead of a broken placeholder.
 */
export function PostCard({
  post,
  variant = "grid",
  aspect = "16/10",
  className,
  priority = false,
  showExcerpt,
  headingLevel = "h3",
}: PostCardProps) {
  const cover = resolveCover(post)
  const source = sourceChipLabel(post.source_name)
  const isLead = variant === "lead" || variant === "featured"
  const isRow = variant === "list" || variant === "compact"
  const excerptVisible = showExcerpt ?? (isLead || variant === "grid")
  const Heading = headingLevel as ElementType
  const aspectClass = ASPECTS[aspect]

  return (
    <article
      className={cn(
        "otk-card",
        isLead && "otk-card-lead",
        variant === "list" && "otk-card-row",
        variant === "compact" && "otk-card-row otk-card-compact",
        className,
      )}
    >
      <Link
        href={`/blog/${post.slug}`}
        className="otk-card-link otk-focus"
        aria-label={post.title}
        data-post-id={post.id}
      >
        <div className={cn("otk-card-media", aspectClass, isRow && "self-start")}>
          {cover.kind === "image" ? (
            <Image
              src={cover.src}
              alt=""
              fill
              sizes={SIZES[variant]}
              priority={priority}
              loading={priority ? undefined : "lazy"}
              className="object-cover"
            />
          ) : (
            <PostCoverFallback
              category={cover.category}
              showSiteMark={variant !== "compact"}
              showLabel={variant !== "compact"}
            />
          )}
          {!isRow ? (
            <div className="otk-card-chips">
              <span className="otk-chip">{post.category}</span>
              {source ? <span className="otk-chip otk-chip-source">{source}</span> : null}
            </div>
          ) : null}
          <FreshnessBadge
            publishedAt={post.published_at}
            windowHours={NEW_POST_WINDOW_HOURS}
            initial={isNewPost(post.published_at)}
          />
        </div>

        <div className="otk-card-body">
          {isRow ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="otk-chip">{post.category}</span>
              {source ? <span className="otk-chip otk-chip-source">{source}</span> : null}
            </div>
          ) : null}
          <Heading className="otk-card-title line-clamp-2">{post.title}</Heading>
          {excerptVisible ? (
            <p className="otk-card-excerpt line-clamp-2">{post.excerpt}</p>
          ) : null}
          <p className="otk-card-meta">
            <span>{post.author}</span>
            <span aria-hidden="true">·</span>
            <RelativeTime date={post.published_at} />
            <span aria-hidden="true">·</span>
            <span>{post.read_time} min read</span>
          </p>
        </div>
      </Link>
    </article>
  )
}

export default PostCard

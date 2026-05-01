import Image from "next/image"
import Link from "next/link"
import { Clock, Eye } from "lucide-react"
import { type Post, formatDate, getCoverImage } from "@/lib/posts"
import { cn } from "@/lib/utils"

type PostCardProps = {
  post: Post
  variant?: "default" | "featured" | "compact"
  className?: string
  priority?: boolean
}

export function PostCard({ post, variant = "default", className, priority = false }: PostCardProps) {
  const isFeatured = variant === "featured"
  const isCompact = variant === "compact"

  if (isCompact) {
    return (
      <Link
        href={`/blog/${post.slug}`}
        className={cn(
          "group flex gap-3 rounded-lg p-2 transition-colors hover:bg-card",
          className,
        )}
      >
        <div className="relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          <Image
            src={getCoverImage(post, 200, 160)}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="80px"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{post.category}</p>
          <h4 className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-primary">
            {post.title}
          </h4>
        </div>
      </Link>
    )
  }

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
        isFeatured && "md:flex-row",
        className,
      )}
    >
      <Link
        href={`/blog/${post.slug}`}
        className={cn(
          "relative block aspect-[16/10] w-full overflow-hidden bg-muted",
          isFeatured && "md:aspect-auto md:w-1/2",
        )}
      >
        <Image
          src={getCoverImage(post, isFeatured ? 1200 : 800, isFeatured ? 750 : 500)}
          alt={post.title}
          fill
          loading={priority ? "eager" : "lazy"}
          priority={priority}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes={isFeatured ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/70 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground">
          {post.category}
        </span>
      </Link>

      <div className={cn("flex flex-1 flex-col p-5", isFeatured && "md:p-7")}>
        <Link href={`/blog/${post.slug}`} className="block">
          <h3
            className={cn(
              "font-display font-bold leading-tight text-foreground transition-colors group-hover:text-primary text-balance",
              isFeatured ? "text-2xl md:text-3xl" : "text-lg",
            )}
          >
            {post.title}
          </h3>
        </Link>
        <p className={cn("mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground", isFeatured && "md:text-base")}>
          {post.excerpt}
        </p>

        <div className="mt-auto pt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{post.author}</span>
          <span aria-hidden>•</span>
          <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
          <span aria-hidden>•</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {post.read_time} min
          </span>
          {isFeatured ? (
            <span className="hidden sm:inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> {post.views.toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

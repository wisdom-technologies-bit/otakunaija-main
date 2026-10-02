import Image from "next/image"
import Link from "next/link"
import { getCoverImage, type Post } from "@/lib/posts"
import { RelativeTime } from "@/components/home/relative-time"

export type HomeCardVariant = "poster" | "wide" | "row"

interface HomeCardProps {
  post: Post
  variant?: HomeCardVariant
  priority?: boolean
}

export function HomeCard({ post, variant = "poster", priority = false }: HomeCardProps) {
  const hasCover = Boolean(post.cover_image?.trim())
  const coverImage = hasCover ? getCoverImage(post, variant === "poster" ? 700 : 1000, variant === "poster" ? 940 : 563) : null
  const cardClassName = `hp-card hp-card-${variant}`
  const imageSizes = variant === "poster" ? "(min-width: 1024px) 25vw, (min-width: 640px) 40vw, 90vw" : variant === "wide" ? "(min-width: 1024px) 50vw, 100vw" : "5rem"

  if (variant === "row") {
    return (
      <article className={`${cardClassName} home-premium-row flex gap-3`}>
        <Link href={`/blog/${post.slug}`} className="hp-focus relative block size-20 shrink-0 overflow-hidden rounded-[var(--hp-radius)] bg-[var(--hp-surface-2)]" aria-label={post.title}>
          {coverImage ? (
            <Image src={coverImage} alt="" fill sizes={imageSizes} loading={priority ? undefined : "lazy"} priority={priority} className="hp-image object-cover" />
          ) : (
            <FallbackPanel category={post.category} />
          )}
        </Link>
        <div className="min-w-0 flex-1 py-0.5">
          <span className="hp-chip">{post.category}</span>
          <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-tight">
            <Link href={`/blog/${post.slug}`} className="hp-focus">{post.title}</Link>
          </h3>
          <Meta post={post} />
        </div>
      </article>
    )
  }

  return (
    <article className={`${cardClassName} hp-card group relative overflow-hidden rounded-[var(--hp-radius-lg)] bg-[var(--hp-surface)] ${variant === "poster" ? "aspect-[3/4]" : "aspect-[16/9]"}`}>
      {coverImage ? (
        <Image src={coverImage} alt={post.title} fill sizes={imageSizes} loading={priority ? undefined : "lazy"} priority={priority} className="hp-image object-cover" />
      ) : (
        <FallbackPanel category={post.category} />
      )}
      <div className="hp-scrim absolute inset-0" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 z-10 p-5 md:p-6">
        <span className="hp-chip">{post.category}</span>
        <h3 className="hp-title mt-3 line-clamp-3 text-white"><Link href={`/blog/${post.slug}`} className="hp-focus">{post.title}</Link></h3>
        <Meta post={post} light />
      </div>
    </article>
  )
}

function Meta({ post, light = false }: { post: Post; light?: boolean }) {
  return <p className={`hp-meta mt-3 ${light ? "text-white/70" : ""}`}>{post.author} <span aria-hidden="true">·</span> <RelativeTime date={post.published_at} /> <span aria-hidden="true">·</span> {post.read_time} min read</p>
}

function FallbackPanel({ category }: { category: string }) {
  return <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_70%_20%,var(--hp-glow),transparent_45%),linear-gradient(145deg,var(--hp-surface-2),var(--hp-bg))]" aria-hidden="true"><span className="hp-display px-5 text-center text-white/90">{category}</span></div>
}

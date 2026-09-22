import Link from 'next/link'
import Image from 'next/image'
import { type Post, formatRelativeTime, getCoverImage } from '@/lib/posts'

interface MobileTrendingRowProps {
  post: Post
}

export function MobileTrendingRow({ post }: MobileTrendingRowProps) {
  const hasCover = post.cover_image && post.cover_image.trim().length > 0

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="flex items-start gap-3 py-4 border-b border-border/40"
    >
      {hasCover && (
        <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          <Image
            src={getCoverImage(post, 200, 140)}
            alt={post.title}
            fill
            className="object-cover"
            sizes="96px"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{formatRelativeTime(post.published_at)}</p>
        <h4 className="mt-0.5 line-clamp-2 text-base font-bold leading-snug text-foreground">
          {post.title}
        </h4>
        <div className="mt-1 text-xs text-muted-foreground">
          <span>By {post.author}</span>
        </div>
      </div>
    </Link>
  )
}

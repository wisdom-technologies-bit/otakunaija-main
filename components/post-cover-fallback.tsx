import { BookOpen, Heart, Newspaper, Sparkles, Swords, Zap } from "lucide-react"
import { categoryVisual, type FallbackIcon } from "@/lib/post-ui"
import { cn } from "@/lib/utils"

const ICONS: Record<FallbackIcon, typeof Newspaper> = {
  news: Newspaper,
  guides: BookOpen,
  shonen: Swords,
  romance: Heart,
  action: Zap,
  default: Sparkles,
}

type PostCoverFallbackProps = {
  category?: string | null
  className?: string
  /** Hide the category label in tiny slots. */
  showLabel?: boolean
}

/**
 * The single shared "post has no cover" tile: category tinted gradient plus the
 * category icon and label, centred, filling the same box as a real image so
 * nothing shifts and the generated placeholder is never shown.
 */
export function PostCoverFallback({
  category,
  className,
  showLabel = true,
}: PostCoverFallbackProps) {
  const visual = categoryVisual(category)
  const Icon = ICONS[visual.icon]

  return (
    <div
      aria-hidden="true"
      className={cn("otk-cover-fallback", visual.className, className)}
      data-fallback="post-cover"
      data-category={visual.label}
    >
      <Icon className="otk-cover-fallback-icon" strokeWidth={1.5} />
      {showLabel ? <span className="otk-cover-fallback-label">{visual.label}</span> : null}
    </div>
  )
}

export default PostCoverFallback

import Link from "next/link"
import type { ElementType } from "react"
import { cn } from "@/lib/utils"

interface HomeSectionHeadingProps {
  eyebrow: string
  title: string
  description?: string
  href?: string
  linkLabel?: string
  /** Shown instead of linkLabel below 360px ("Browse" for "Browse series"). */
  shortLinkLabel?: string
  level?: "h2" | "h3" | "h4"
  count?: string
  id?: string
  className?: string
}

/**
 * The one section heading used across the home page and the episode listings:
 * eyebrow, display heading, optional description and result count.
 */
export function HomeSectionHeading({
  eyebrow,
  title,
  description,
  href,
  linkLabel = "View all",
  shortLinkLabel,
  level = "h2",
  count,
  id,
  className,
}: HomeSectionHeadingProps) {
  const Heading = level as ElementType

  return (
    <div className={cn("otk-section-head", className)}>
      <div className="min-w-0">
        <p className="otk-eyebrow">{eyebrow}</p>
        <Heading id={id} className="otk-section-title mt-2 text-balance">
          {title}
        </Heading>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--otk-text-dim)]">{description}</p>
        ) : null}
        {count ? <p className="otk-meta mt-2">{count}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="otk-focus shrink-0 pb-1 text-sm font-semibold text-[var(--otk-accent)] transition-opacity hover:opacity-75"
        >
          {shortLinkLabel ? (
            <>
              <span className="hidden min-[360px]:inline">{linkLabel}</span>
              <span className="min-[360px]:hidden">{shortLinkLabel}</span>
            </>
          ) : (
            linkLabel
          )}
        </Link>
      ) : null}
    </div>
  )
}

export default HomeSectionHeading

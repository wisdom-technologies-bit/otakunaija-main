import Link from "next/link"
import type { ElementType } from "react"

interface HomeSectionHeadingProps {
  eyebrow: string
  title: string
  href?: string
  linkLabel?: string
  level?: "h2" | "h3" | "h4"
}

export function HomeSectionHeading({ eyebrow, title, href, linkLabel = "View all", level = "h2" }: HomeSectionHeadingProps) {
  const Heading = level as ElementType

  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <p className="hp-eyebrow">{eyebrow}</p>
        <Heading className="hp-display mt-3 text-[clamp(2rem,4vw,4rem)]">{title}</Heading>
      </div>
      {href ? <Link href={href} className="hp-focus shrink-0 pb-1 text-sm font-semibold text-[var(--hp-accent)] transition-opacity hover:opacity-75">{linkLabel}</Link> : null}
    </div>
  )
}

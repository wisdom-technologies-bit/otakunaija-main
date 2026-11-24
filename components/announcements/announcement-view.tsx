"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import type { PublicAnnouncement } from "@/lib/announcements/types"
import { AnnouncementMarkdown } from "./announcement-markdown"

/** One announcement rendered: optional image, title, markdown body, optional CTA. Shared by the public dialog and the admin preview. */
export function AnnouncementView({ announcement }: { announcement: Pick<PublicAnnouncement, "title" | "bodyMarkdown" | "imageUrl" | "ctaLabel" | "ctaUrl"> }) {
  const { title, bodyMarkdown, imageUrl, ctaLabel, ctaUrl } = announcement
  const external = !!ctaUrl && /^https?:\/\//i.test(ctaUrl)

  return (
    <article className="space-y-3">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="max-h-64 w-full rounded-xl border border-border object-cover"
          decoding="async"
        />
      ) : null}
      {title ? <h3 className="font-display text-lg font-bold leading-snug">{title}</h3> : null}
      <AnnouncementMarkdown>{bodyMarkdown}</AnnouncementMarkdown>
      {ctaLabel && ctaUrl ? (
        external ? (
          <a
            href={ctaUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {ctaLabel}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        ) : (
          <Link
            href={ctaUrl}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {ctaLabel}
          </Link>
        )
      ) : null}
    </article>
  )
}

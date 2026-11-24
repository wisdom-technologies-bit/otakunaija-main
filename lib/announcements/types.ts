export type SeenScope = "page" | "site"

/** What the public site receives (no admin-only fields). */
export type PublicAnnouncement = {
  slot: number
  title: string | null
  bodyMarkdown: string
  imageUrl: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  targets: string[]
  seenScope: SeenScope
  startsAt: string | null
  endsAt: string | null
  revision: number
}

export type AdminAnnouncement = PublicAnnouncement & {
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const ANNOUNCEMENT_SLOTS = [1, 2] as const
export type AnnouncementSlot = (typeof ANNOUNCEMENT_SLOTS)[number]

export const MAX_BODY_LENGTH = 10000

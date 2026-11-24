import { and, asc, gt, isNull, lte, or, eq } from "drizzle-orm"
import { db } from "@/lib/db/index"
import { siteAnnouncements } from "@/lib/db/schema"
import type { AdminAnnouncement, AnnouncementSlot, PublicAnnouncement, SeenScope } from "./types"

type Row = typeof siteAnnouncements.$inferSelect

function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null
}

function toPublic(r: Row): PublicAnnouncement {
  return {
    slot: r.slot,
    title: r.title,
    bodyMarkdown: r.bodyMarkdown,
    imageUrl: r.imageUrl,
    ctaLabel: r.ctaLabel,
    ctaUrl: r.ctaUrl,
    targets: r.targets ?? [],
    seenScope: (r.seenScope === "site" ? "site" : "page") as SeenScope,
    startsAt: iso(r.startsAt),
    endsAt: iso(r.endsAt),
    revision: r.revision,
  }
}

function toAdmin(r: Row): AdminAnnouncement {
  return {
    ...toPublic(r),
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

/** Postgres "undefined_table" — the SQL in docs/sql/announcements.sql hasn't been run yet. */
export function isMissingTableError(error: unknown): boolean {
  const e = error as { code?: string; message?: string; cause?: { code?: string } } | null
  if (!e) return false
  if (e.code === "42P01" || e.cause?.code === "42P01") return true
  return typeof e.message === "string" && /site_announcements.*does not exist|relation .*site_announcements/i.test(e.message)
}

/**
 * Active, in-window announcements for the public site. Never throws: if the
 * table is missing or the database is unreachable the site simply shows nothing.
 */
export async function getActivePublicAnnouncements(): Promise<PublicAnnouncement[]> {
  try {
    const now = new Date()
    const rows = await db
      .select()
      .from(siteAnnouncements)
      .where(
        and(
          eq(siteAnnouncements.isActive, true),
          or(isNull(siteAnnouncements.startsAt), lte(siteAnnouncements.startsAt, now)),
          or(isNull(siteAnnouncements.endsAt), gt(siteAnnouncements.endsAt, now)),
        ),
      )
      .orderBy(asc(siteAnnouncements.slot))
    return rows.map(toPublic)
  } catch {
    return []
  }
}

export type AdminAnnouncementsResult = {
  slots: Record<AnnouncementSlot, AdminAnnouncement | null>
  tableMissing: boolean
  error: string | null
}

export async function getAdminAnnouncements(): Promise<AdminAnnouncementsResult> {
  const slots: AdminAnnouncementsResult["slots"] = { 1: null, 2: null }
  try {
    const rows = await db.select().from(siteAnnouncements).orderBy(asc(siteAnnouncements.slot))
    for (const r of rows) {
      if (r.slot === 1 || r.slot === 2) slots[r.slot] = toAdmin(r)
    }
    return { slots, tableMissing: false, error: null }
  } catch (error) {
    if (isMissingTableError(error)) return { slots, tableMissing: true, error: null }
    return { slots, tableMissing: false, error: error instanceof Error ? error.message : "Database error" }
  }
}

/**
 * Which slot a brand-new announcement should be written to: a free slot if one
 * exists, otherwise the least recently updated one (which gets overwritten).
 */
export function pickSlotForNew(slots: Record<AnnouncementSlot, AdminAnnouncement | null>): {
  slot: AnnouncementSlot
  overwrites: AdminAnnouncement | null
} {
  if (!slots[1]) return { slot: 1, overwrites: null }
  if (!slots[2]) return { slot: 2, overwrites: null }
  const older = new Date(slots[1].updatedAt).getTime() <= new Date(slots[2].updatedAt).getTime() ? 1 : 2
  return { slot: older, overwrites: slots[older] }
}

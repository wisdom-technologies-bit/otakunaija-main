"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { ADMIN_EMAIL, getCurrentSession } from "@/lib/auth"
import { db } from "@/lib/db/index"
import { siteAnnouncements } from "@/lib/db/schema"
import { isValidTargetKey } from "@/lib/announcements/targeting"
import { isMissingTableError, pickSlotForNew } from "@/lib/announcements/queries"
import { MAX_BODY_LENGTH, type AdminAnnouncement, type AnnouncementSlot } from "@/lib/announcements/types"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function requireAdmin() {
  const session = await getCurrentSession()
  if (!session || session.email.toLowerCase() !== ADMIN_EMAIL) throw new Error("Unauthorized")
}

/** Absolute http(s) URL, or a same-site path ("/episodes"). Rejects javascript:, data:, protocol-relative. */
function isSafeUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true
  try {
    const u = new URL(value)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isSafeUrl(v), "Enter a full https:// link or a path starting with /")

const inputSchema = z
  .object({
    title: optionalText(160),
    bodyMarkdown: z
      .string()
      .trim()
      .min(1, "Write a message")
      .max(MAX_BODY_LENGTH, `Keep the message under ${MAX_BODY_LENGTH.toLocaleString()} characters`),
    imageUrl: optionalUrl,
    ctaLabel: optionalText(60),
    ctaUrl: optionalUrl,
    isActive: z.boolean(),
    targets: z.array(z.string().trim()).max(200, "Too many pages selected"),
    seenScope: z.enum(["page", "site"]),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    resetSeen: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (!!v.ctaLabel !== !!v.ctaUrl) {
      ctx.addIssue({ code: "custom", path: ["ctaLabel"], message: "A call-to-action needs both a button label and a link" })
    }
    if (v.targets.length === 0) {
      ctx.addIssue({ code: "custom", path: ["targets"], message: "Pick at least one page" })
    }
    const bad = v.targets.find((t) => !isValidTargetKey(t))
    if (bad) ctx.addIssue({ code: "custom", path: ["targets"], message: `Invalid page target: ${bad}` })
    if (v.startsAt && v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt)) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after the start time" })
    }
  })

export type SaveAnnouncementInput = z.input<typeof inputSchema>

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Invalid input" }
  if (isMissingTableError(error)) {
    return { ok: false, error: "The announcements table doesn't exist yet. Run docs/sql/announcements.sql in the Neon SQL editor." }
  }
  if (error instanceof Error && error.message === "Unauthorized") return { ok: false, error: "Please sign in again." }
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" }
}

function revalidate() {
  revalidatePath("/admin/announcements")
}

/**
 * Save an announcement into slot 1 or 2. `slot: "new"` writes to a free slot or,
 * when both are taken, overwrites the least recently updated one — the database
 * can only ever hold two announcements.
 */
export async function saveAnnouncement(
  slot: AnnouncementSlot | "new",
  input: SaveAnnouncementInput,
): Promise<Result<{ slot: AnnouncementSlot; overwrote: boolean }>> {
  try {
    await requireAdmin()
    const data = inputSchema.parse(input)
    const targets = data.targets.includes("all") ? ["all"] : Array.from(new Set(data.targets))

    const existingRows = await db.select().from(siteAnnouncements)
    const bySlot: Record<AnnouncementSlot, AdminAnnouncement | null> = { 1: null, 2: null }
    for (const r of existingRows) {
      if (r.slot === 1 || r.slot === 2) {
        bySlot[r.slot] = {
          slot: r.slot,
          title: r.title,
          bodyMarkdown: r.bodyMarkdown,
          imageUrl: r.imageUrl,
          ctaLabel: r.ctaLabel,
          ctaUrl: r.ctaUrl,
          targets: r.targets ?? [],
          seenScope: r.seenScope === "site" ? "site" : "page",
          startsAt: r.startsAt?.toISOString() ?? null,
          endsAt: r.endsAt?.toISOString() ?? null,
          revision: r.revision,
          isActive: r.isActive,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }
      }
    }

    const target: AnnouncementSlot = slot === "new" ? pickSlotForNew(bySlot).slot : slot
    const existing = bySlot[target]

    const contentChanged =
      !existing ||
      existing.title !== data.title ||
      existing.bodyMarkdown !== data.bodyMarkdown ||
      existing.imageUrl !== data.imageUrl ||
      existing.ctaLabel !== data.ctaLabel ||
      existing.ctaUrl !== data.ctaUrl
    const revision = existing ? existing.revision + (contentChanged || data.resetSeen ? 1 : 0) : 1

    const values = {
      title: data.title,
      bodyMarkdown: data.bodyMarkdown,
      imageUrl: data.imageUrl,
      ctaLabel: data.ctaLabel,
      ctaUrl: data.ctaUrl,
      isActive: data.isActive,
      targets,
      seenScope: data.seenScope,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      revision,
      updatedAt: new Date(),
    }

    await db
      .insert(siteAnnouncements)
      .values({ slot: target, ...values })
      .onConflictDoUpdate({ target: siteAnnouncements.slot, set: values })

    revalidate()
    return { ok: true, slot: target, overwrote: !!existing && slot === "new" }
  } catch (error) {
    return fail(error)
  }
}

export async function setAnnouncementActive(slot: AnnouncementSlot, isActive: boolean): Promise<Result> {
  try {
    await requireAdmin()
    if (slot !== 1 && slot !== 2) return { ok: false, error: "Invalid slot" }
    await db.update(siteAnnouncements).set({ isActive, updatedAt: new Date() }).where(eq(siteAnnouncements.slot, slot))
    revalidate()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function clearAnnouncement(slot: AnnouncementSlot): Promise<Result> {
  try {
    await requireAdmin()
    if (slot !== 1 && slot !== 2) return { ok: false, error: "Invalid slot" }
    await db.delete(siteAnnouncements).where(eq(siteAnnouncements.slot, slot))
    revalidate()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

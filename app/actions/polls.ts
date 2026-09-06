'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ADMIN_EMAIL, getCurrentSession } from '@/lib/auth'
import { db } from '@/lib/db/index'
import { pollOptions, polls } from '@/lib/db/schema'
import { and, eq, ne } from 'drizzle-orm'
import { deletePollById, getPollById, updatePollStatus } from '@/lib/db/queries/polls'

const optionSchema = z.object({
  label: z.string().trim().min(1, 'Each option needs a label').max(160),
  description: z.string().trim().max(500).optional().nullable(),
  imageUrl: z.string().url('Image URL is invalid').optional().or(z.literal('')).nullable(),
  imagePublicId: z.string().trim().max(300).optional().or(z.literal('')).nullable(),
  displayOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().default(true),
})

const pollSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().min(3).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens'),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ENDED']),
  featured: z.boolean().default(false),
  allowMultipleVotes: z.boolean().default(false),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  options: z.array(optionSchema).min(2, 'Add at least two options').max(20),
})

async function requireAdmin() {
  const session = await getCurrentSession()
  if (!session || session.email.toLowerCase() !== ADMIN_EMAIL) throw new Error('Unauthorized')
  return session
}

function validatePoll(data: z.infer<typeof pollSchema>) {
  if (data.endsAt && data.startsAt && data.endsAt <= data.startsAt) throw new Error('End time must be after start time')
  const labels = data.options.filter((option) => option.isActive).map((option) => option.label.toLowerCase())
  if (new Set(labels).size !== labels.length) throw new Error('Option labels must be unique')
  if (data.status === 'ACTIVE' && labels.length < 2) throw new Error('An active poll needs at least two active options')
  for (const option of data.options) {
    if (option.imageUrl && !option.imagePublicId) throw new Error(`The image for “${option.label}” is missing its Cloudinary ID`)
  }
}

async function ensureSlugAvailable(slug: string, id?: number) {
  const where = id ? and(eq(polls.slug, slug), ne(polls.id, id)) : eq(polls.slug, slug)
  const [existing] = await db.select({ id: polls.id }).from(polls).where(where).limit(1)
  if (existing) throw new Error('That slug is already in use')
}

export async function createPoll(input: unknown) {
  await requireAdmin()
  const data = pollSchema.parse(input)
  validatePoll(data)
  await ensureSlugAvailable(data.slug)
  const result = await db.transaction(async (tx) => {
    const [created] = await tx.insert(polls).values({ title: data.title, slug: data.slug, description: data.description || null, status: data.status, featured: data.featured, allowMultipleVotes: data.allowMultipleVotes, startsAt: data.startsAt || null, endsAt: data.endsAt || null }).returning()
    await tx.insert(pollOptions).values(data.options.map((option, index) => ({ pollId: created.id, label: option.label, description: option.description || null, imageUrl: option.imageUrl || null, imagePublicId: option.imagePublicId || null, displayOrder: index, isActive: option.isActive })))
    return created
  })
  revalidatePath('/polls')
  revalidatePath('/sitemap.xml')
  revalidatePath('/')
  revalidatePath('/admin/polls')
  return { id: result.id, slug: result.slug }
}

export async function updatePoll(id: number, input: unknown) {
  await requireAdmin()
  const data = pollSchema.parse(input)
  validatePoll(data)
  const existing = await getPollById(id)
  if (!existing) throw new Error('Poll not found')
  await ensureSlugAvailable(data.slug, id)
  await db.transaction(async (tx) => {
    await tx.update(polls).set({ title: data.title, slug: data.slug, description: data.description || null, status: data.status, featured: data.featured, allowMultipleVotes: data.allowMultipleVotes, startsAt: data.startsAt || null, endsAt: data.endsAt || null, updatedAt: new Date() }).where(eq(polls.id, id))
    await tx.delete(pollOptions).where(eq(pollOptions.pollId, id))
    await tx.insert(pollOptions).values(data.options.map((option, index) => ({ pollId: id, label: option.label, description: option.description || null, imageUrl: option.imageUrl || null, imagePublicId: option.imagePublicId || null, displayOrder: index, isActive: option.isActive })))
  })
  revalidatePath('/polls')
  revalidatePath(`/polls/${existing.slug}`)
  revalidatePath(`/polls/${data.slug}`)
  revalidatePath('/sitemap.xml')
  revalidatePath('/')
  revalidatePath('/admin/polls')
  return { ok: true }
}

export async function endPoll(id: number) { await requireAdmin(); await updatePollStatus(id, 'ENDED'); revalidatePath('/polls'); revalidatePath('/'); revalidatePath('/admin/polls') }
export async function deletePoll(id: number) { await requireAdmin(); await deletePollById(id); revalidatePath('/polls'); revalidatePath('/'); revalidatePath('/admin/polls'); revalidatePath('/sitemap.xml') }

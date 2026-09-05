'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentSession } from '@/lib/auth'
import { db } from '@/lib/db/index'
import { pollOptions, polls } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { deletePollById, deletePollOptions, getPollById, insertPoll, insertPollOptions, updatePollById, updatePollStatus } from '@/lib/db/queries/polls'

const optionSchema = z.object({ label: z.string().trim().min(1).max(160), description: z.string().trim().max(500).optional(), imageUrl: z.string().url().optional().or(z.literal('')), imagePublicId: z.string().max(300).optional(), displayOrder: z.number().int().nonnegative() })
const pollSchema = z.object({ title: z.string().trim().min(3).max(200), slug: z.string().trim().min(3).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().trim().max(1000).optional(), status: z.enum(['DRAFT', 'ACTIVE', 'ENDED']), featured: z.boolean().default(false), allowMultipleVotes: z.boolean().default(false), startsAt: z.coerce.date().nullable().optional(), endsAt: z.coerce.date().nullable().optional(), options: z.array(optionSchema).min(2).max(20) })

async function requireAdmin() {
  const session = await getCurrentSession()
  if (!session) throw new Error('Unauthorized')
  return session
}

export async function createPoll(input: unknown) {
  await requireAdmin()
  const data = pollSchema.parse(input)
  if (data.endsAt && data.startsAt && data.endsAt <= data.startsAt) throw new Error('End time must be after start time')
  const created = await insertPoll({ title: data.title, slug: data.slug, description: data.description || null, status: data.status, featured: data.featured, allowMultipleVotes: data.allowMultipleVotes, startsAt: data.startsAt || null, endsAt: data.endsAt || null })
  await insertPollOptions(data.options.map((option, index) => ({ pollId: created.id, label: option.label, description: option.description || null, imageUrl: option.imageUrl || null, imagePublicId: option.imagePublicId || null, displayOrder: index })))
  revalidatePath('/polls')
  revalidatePath('/')
  return { id: created.id, slug: created.slug }
}

export async function updatePoll(id: number, input: unknown) {
  await requireAdmin()
  const data = pollSchema.parse(input)
  const existing = await getPollById(id)
  if (!existing) throw new Error('Poll not found')
  const counts = await db.select({ optionId: pollOptions.id }).from(pollOptions).where(eq(pollOptions.pollId, id))
  if (existing.status === 'ACTIVE' && counts.length !== data.options.length) throw new Error('Cannot change option count while an active poll is running')
  await updatePollById(id, { title: data.title, slug: data.slug, description: data.description || null, status: data.status, featured: data.featured, allowMultipleVotes: data.allowMultipleVotes, startsAt: data.startsAt || null, endsAt: data.endsAt || null })
  await deletePollOptions(id)
  await insertPollOptions(data.options.map((option, index) => ({ pollId: id, label: option.label, description: option.description || null, imageUrl: option.imageUrl || null, imagePublicId: option.imagePublicId || null, displayOrder: index })))
  revalidatePath('/polls')
  revalidatePath(`/polls/${data.slug}`)
  revalidatePath('/')
  return { ok: true }
}

export async function endPoll(id: number) {
  await requireAdmin()
  await updatePollStatus(id, 'ENDED')
  revalidatePath('/polls')
  revalidatePath('/')
  revalidatePath('/admin/polls')
  return
}

export async function deletePoll(id: number) {
  await requireAdmin()
  await deletePollById(id)
  revalidatePath('/polls')
  revalidatePath('/')
  revalidatePath('/admin/polls')
  return
}

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { creators } from '@/lib/db/schema'
import { uniqueSlug } from '@/lib/play-slugs'

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

export async function resolvePlayCreator(studioName: string | null) {
  const name = studioName?.trim()
  if (!name) {
    const existing = await db.select({ id: creators.id }).from(creators).where(eq(creators.slug, 'unknown-studio')).limit(1)
    if (existing[0]) return existing[0].id
    try {
      const inserted = await db.insert(creators).values({ name: 'Unknown Studio', slug: 'unknown-studio' }).returning({ id: creators.id })
      return inserted[0].id
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const raced = await db.select({ id: creators.id }).from(creators).where(eq(creators.slug, 'unknown-studio')).limit(1)
      if (!raced[0]) throw error
      return raced[0].id
    }
  }

  const existing = await db.select({ id: creators.id }).from(creators).where(eq(creators.name, name)).limit(1)
  if (existing[0]) return existing[0].id

  const slug = await uniqueSlug(name, creators, creators.slug)
  try {
    const inserted = await db.insert(creators).values({ name, slug }).returning({ id: creators.id })
    return inserted[0].id
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const raced = await db.select({ id: creators.id }).from(creators).where(eq(creators.name, name)).limit(1)
    if (!raced[0]) throw error
    return raced[0].id
  }
}

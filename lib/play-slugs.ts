import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/index'

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function uniqueSlug(
  candidate: string,
  table: any,
  column: any,
): Promise<string> {
  const base = toSlug(candidate) || 'untitled'
  let slug = base
  let suffix = 2

  while (true) {
    const existing = await db.select({ id: table.id }).from(table).where(eq(column, slug)).limit(1)
    if (existing.length === 0) return slug
    slug = `${base}-${suffix}`
    suffix += 1
  }
}

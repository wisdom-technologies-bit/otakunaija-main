/**
 * Slug helpers for auto-published news posts.
 *
 * Kept pure so the uniqueness rule is unit tested without a database. The
 * store reads the slugs that already exist for the base and hands them here.
 */

const MAX_SLUG_LENGTH = 80

export function slugifyTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    // Drop diacritics ("Kō" → "Ko") before the ASCII filter removes the rest.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['"’“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "")

  return slug || `news-${Date.now()}`
}

/**
 * `known` is every slug that already exists in `posts` for this base
 * (base and base-2, base-3 …). Returns the first free candidate.
 */
export function pickUniqueSlug(base: string, known: Iterable<string>): string {
  const taken = new Set(known)
  if (!taken.has(base)) return base

  let counter = 2
  while (taken.has(`${base}-${counter}`)) {
    counter += 1
  }
  return `${base}-${counter}`
}

/** Slugs matching `base` or `base-N`, used to build the `known` list in SQL. */
export function slugFamily(base: string): { exact: string; prefix: string } {
  return { exact: base, prefix: `${base}-` }
}

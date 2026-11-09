/**
 * Tiny in-process rate limiter for the sign-up form.
 *
 * Deliberately simple: a sliding window per key, held in module memory. On
 * Vercel each instance keeps its own window, so the real limit is
 * `5 × instances per hour`. That is still enough to stop a single client from
 * hammering the confirmation sender, and it needs no table. If the form ever
 * gets real abuse, move the counter into Postgres behind `subscribers`.
 */

export type RateLimiter = {
  /** Records an attempt and says whether it is allowed. */
  attempt(key: string, now: Date): boolean
  /** How many attempts remain in the current window. */
  remaining(key: string, now: Date): number
  reset(): void
}

export function createRateLimiter(options: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>()

  const prune = (key: string, now: Date) => {
    const cutoff = now.getTime() - options.windowMs
    const entries = (hits.get(key) ?? []).filter((at) => at > cutoff)
    if (entries.length) hits.set(key, entries)
    else hits.delete(key)
    return entries
  }

  return {
    attempt(key, now) {
      const entries = prune(key, now)
      if (entries.length >= options.limit) return false
      entries.push(now.getTime())
      hits.set(key, entries)
      return true
    },
    remaining(key, now) {
      return Math.max(0, options.limit - prune(key, now).length)
    },
    reset() {
      hits.clear()
    },
  }
}

/** Five sign-up attempts per IP per hour. */
export const signupLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 })

export const SIGNUP_LIMIT = 5

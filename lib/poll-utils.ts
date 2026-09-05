import crypto from 'crypto'
import type { polls } from './db/schema'

type Poll = typeof polls.$inferSelect

const POLL_SECRET: string = process.env.SESSION_SECRET ?? (() => { throw new Error('SESSION_SECRET is not set') })()
const ANONYMOUS_COOKIE = 'otakunaija_poll_visitor'
export const POLL_VISITOR_COOKIE = ANONYMOUS_COOKIE


/**
 * Hash voter fingerprint with HMAC to prevent duplicate votes
 * without persisting raw IPs
 */
export function hashVoter(ip: string, pollId: number, userAgent: string): string {
  const combined = `${ip}:${pollId}:${userAgent}`
  return crypto.createHmac('sha256', POLL_SECRET).update(combined).digest('hex')
}

/**
 * Detect device type from user agent
 */
export function detectDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  if (/mobile|android|iphone|ipod/i.test(userAgent)) return 'mobile'
  if (/ipad|tablet|android|playbook/i.test(userAgent)) return 'tablet'
  return 'desktop'
}

/**
 * Hash user agent to avoid storing raw data
 */
export function hashUserAgent(userAgent: string): string {
  return crypto.createHash('sha256').update(userAgent).digest('hex')
}

/**
 * Check if poll is currently open for voting
 */
export function isPollOpen(poll: Poll): boolean {
  if (poll.status !== 'ACTIVE') return false
  const now = new Date()
  if (poll.startsAt && now < poll.startsAt) return false
  if (poll.endsAt && now >= poll.endsAt) return false
  return true
}

/**
 * Get visitor IP from request headers (supports proxies)
 */
export function getClientIp(
  xForwardedFor?: string | null,
  remoteAddr?: string | null,
): string {
  if (xForwardedFor) {
    // X-Forwarded-For can be comma-separated (client, proxy1, proxy2...)
    return xForwardedFor.split(',')[0].trim()
  }
  return remoteAddr || 'unknown'
}

/**
 * Geolocation service using IP GeoLocation API
 * Returns approximate location data without claiming accuracy
 */
export async function getGeolocation(ip: string): Promise<{
  country_code?: string
  country_name?: string
  region?: string
  city?: string
  timezone?: string
  continent?: string
} | null> {
  if (ip === 'unknown' || ip === '127.0.0.1' || ip === 'localhost') {
    return null
  }

  try {
    // Using ip-api.com free tier (45 req/min)
    const response = await fetch(`https://ip-api.com/json/${ip}?fields=country,countryCode,region,city,timezone,continent`, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) return null

    const data = await response.json() as {
      status?: string
      country?: string
      countryCode?: string
      region?: string
      city?: string
      timezone?: string
      continent?: string
    }

    if (data.status === 'success') {
      return {
        country_code: data.countryCode || undefined,
        country_name: data.country || undefined,
        region: data.region || undefined,
        city: data.city || undefined,
        timezone: data.timezone || undefined,
        continent: data.continent || undefined,
      }
    }

    return null
  } catch {
    // Geolocation failure should not prevent voting
    return null
  }
}

/**
 * Calculate stats from poll votes
 */
export function calculatePollStats(
  votes: Array<{ optionId: number; countryCode?: string | null }>,
  options: Array<{ id: number; label: string }>,
) {
  const optionVotes = new Map<number, number>()
  const optionByCountry = new Map<string, Map<number, number>>()

  for (const vote of votes) {
    optionVotes.set(vote.optionId, (optionVotes.get(vote.optionId) || 0) + 1)

    if (vote.countryCode) {
      const country = vote.countryCode
      if (!optionByCountry.has(country)) {
        optionByCountry.set(country, new Map())
      }
      const countryMap = optionByCountry.get(country)!
      countryMap.set(vote.optionId, (countryMap.get(vote.optionId) || 0) + 1)
    }
  }

  // Rank options by votes
  const ranked = Array.from(optionVotes.entries())
    .map(([optionId, count]) => {
      const option = options.find((o) => o.id === optionId)
      return { optionId, count, label: option?.label || 'Unknown', percentage: 0 }
    })
    .sort((a, b) => b.count - a.count)

  const total = ranked.reduce((sum, r) => sum + r.count, 0)
  ranked.forEach((r) => {
    r.percentage = total > 0 ? (r.count / total) * 100 : 0
  })

  return {
    totalVotes: total,
    optionVotes,
    ranked,
    optionByCountry,
    winner: ranked[0] || null,
    runnerUp: ranked[1] || null,
    margin: ranked.length >= 2 ? ranked[0].count - ranked[1].count : ranked[0]?.count || 0,
  }
}

/**
 * Generate insights from poll statistics
 */
export function generatePollInsights(stats: ReturnType<typeof calculatePollStats>, pollTitle: string) {
  const insights: string[] = []

  if (stats.winner) {
    insights.push(`${stats.winner.label} is currently leading with ${stats.winner.percentage.toFixed(1)}% of votes.`)
  }

  if (stats.margin > 0 && stats.runnerUp) {
    if (stats.margin === 1) {
      insights.push(`It's an extremely close race between ${stats.winner?.label} and ${stats.runnerUp.label}.`)
    } else if (stats.margin <= 3) {
      insights.push(`${stats.winner?.label} leads ${stats.runnerUp.label} by just ${stats.margin} votes.`)
    } else {
      insights.push(`${stats.winner?.label} is pulling ahead of ${stats.runnerUp.label} by ${stats.margin} votes.`)
    }
  }

  if (stats.totalVotes >= 100) {
    insights.push(`Over ${stats.totalVotes} votes have been cast so far.`)
  } else if (stats.totalVotes >= 10) {
    insights.push(`${stats.totalVotes} votes recorded. Be part of the growing conversation.`)
  }

  return insights
}

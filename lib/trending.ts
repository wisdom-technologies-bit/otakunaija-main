import { unstable_cache } from 'next/cache'
import { sql } from './db'
import type { Post } from './posts'

export const TRENDING_CONFIG = {
  candidateDays: 7,
  refreshSeconds: 300,
  weights: {
    recentActivity: 0.3,
    momentum: 0.25,
    engagement: 0.15,
    recency: 0.15,
    velocity: 0.1,
    diversity: 0.05,
  },
} as const

export type TrendingSignals = {
  recentActivity: number
  velocity: number
  growthRate: number
  momentum: number
  engagement: number
  recency: number
  finalScore: number
}

export type TrendingPost = Post & { trendSignals?: TrendingSignals }

type Candidate = Post & {
  recent30m: number
  recent1h: number
  recent3h: number
  recent6h: number
  recent24h: number
  previous1h: number
  previous24h: number
  commentCount: number
}

const safeLog = (value: number) => Math.log1p(Math.max(0, value))
const ratio = (current: number, previous: number) => (current + 1) / (previous + 1)
const normalize = (value: number, max: number) => (max > 0 ? Math.min(1, value / max) : 0)

export function scoreTrendingCandidates(candidates: Candidate[], now = new Date()) {
  if (candidates.length === 0) return []
  const maxRecent = Math.max(...candidates.map((c) => safeLog(c.recent24h)))
  const maxVelocity = Math.max(...candidates.map((c) => safeLog(c.recent1h)))
  const maxEngagement = Math.max(...candidates.map((c) => safeLog(c.commentCount)))

  return candidates
    .map((candidate) => {
      const recentActivity = normalize(
        safeLog(candidate.recent30m) * 0.35 + safeLog(candidate.recent1h) * 0.3 + safeLog(candidate.recent3h) * 0.2 + safeLog(candidate.recent24h) * 0.15,
        maxRecent || 1,
      )
      const velocity = normalize(safeLog(candidate.recent1h), maxVelocity || 1)
      const growthRate = Math.min(1, Math.max(0, (ratio(candidate.recent1h, candidate.previous1h) - 1) / 4))
      const momentum = Math.min(1, growthRate * 0.65 + normalize(safeLog(candidate.recent24h), maxRecent || 1) * 0.35)
      const engagement = normalize(safeLog(candidate.commentCount), maxEngagement || 1)
      const ageHours = Math.max(0, (now.getTime() - new Date(candidate.published_at).getTime()) / 3600000)
      const recency = Math.exp(-ageHours / 72)
      const diversity = 1
      const finalScore =
        recentActivity * TRENDING_CONFIG.weights.recentActivity +
        momentum * TRENDING_CONFIG.weights.momentum +
        engagement * TRENDING_CONFIG.weights.engagement +
        recency * TRENDING_CONFIG.weights.recency +
        velocity * TRENDING_CONFIG.weights.velocity +
        diversity * TRENDING_CONFIG.weights.diversity

      return { post: candidate, signals: { recentActivity, velocity, growthRate, momentum, engagement, recency, finalScore } }
    })
    .sort(
      (a, b) =>
        b.signals.finalScore - a.signals.finalScore ||
        new Date(b.post.published_at).getTime() - new Date(a.post.published_at).getTime(),
    )
}

const _getTrendingPosts = unstable_cache(
  async (limit: number): Promise<TrendingPost[]> => {
    try {
      const rows = await sql`
        SELECT p.*,
          COALESCE(v.recent_30m, 0)::int AS recent_30m,
          COALESCE(v.recent_1h, 0)::int AS recent_1h,
          COALESCE(v.recent_3h, 0)::int AS recent_3h,
          COALESCE(v.recent_6h, 0)::int AS recent_6h,
          COALESCE(v.recent_24h, 0)::int AS recent_24h,
          COALESCE(v.previous_1h, 0)::int AS previous_1h,
          COALESCE(v.previous_24h, 0)::int AS previous_24h,
          COALESCE(c.comment_count, 0)::int AS comment_count
        FROM posts p
        LEFT JOIN (
          SELECT post_id,
            COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '30 minutes') AS recent_30m,
            COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '1 hour') AS recent_1h,
            COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '3 hours') AS recent_3h,
            COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '6 hours') AS recent_6h,
            COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '24 hours') AS recent_24h,
            COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '2 hours' AND viewed_at < NOW() - INTERVAL '1 hour') AS previous_1h,
            COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '48 hours' AND viewed_at < NOW() - INTERVAL '24 hours') AS previous_24h
          FROM post_views
          WHERE viewed_at >= NOW() - INTERVAL '48 hours'
          GROUP BY post_id
        ) v ON v.post_id = p.id
        LEFT JOIN (
          SELECT post_slug, COUNT(*) AS comment_count FROM comments GROUP BY post_slug
        ) c ON c.post_slug = p.slug
        WHERE p.published_at IS NOT NULL
          AND p.published_at <= NOW()
          AND (
            p.published_at >= NOW() - INTERVAL '7 days'
            OR COALESCE(v.recent_24h, 0) >= 10
            OR COALESCE(v.previous_24h, 0) >= 20
          )
        ORDER BY (COALESCE(v.recent_24h, 0) + COALESCE(v.previous_24h, 0)) DESC, p.published_at DESC
      `
      const scored = scoreTrendingCandidates(rows as Candidate[])
      const active = scored.filter(({ post }) =>
        post.recent24h > 0 || post.previous24h > 0 || post.commentCount > 0,
      )
      const ranked = active.length > 0 ? active : scored
      return ranked.slice(0, limit).map(({ post, signals }) => ({ ...post, trendSignals: signals }))
    } catch {
      return []
    }
  },
  ['trending-posts-v2'],
  { revalidate: TRENDING_CONFIG.refreshSeconds, tags: ['blog-trending'] },
)

export async function getTrendingPosts(limit = 5): Promise<TrendingPost[]> {
  return _getTrendingPosts(limit)
}

export async function getTrendingAnalytics(limit = 20) {
  return _getTrendingPosts(limit)
}

export const trendingEligibility = {
  publishedOnly: true,
  candidateWindowDays: TRENDING_CONFIG.candidateDays,
  excludesManualTrendingFlag: true,
}

export type { Candidate as TrendingCandidate }

export function trendingScoreForTest(candidate: Candidate, now?: Date) {
  return scoreTrendingCandidates([candidate], now)[0]?.signals.finalScore ?? 0
}

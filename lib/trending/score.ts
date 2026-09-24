export const TRENDING_WEIGHTS = {
  recentActivity: 0.3,
  momentum: 0.25,
  engagement: 0.15,
  recency: 0.15,
  velocity: 0.1,
  discovery: 0.05,
} as const

export type TrendingSignals = {
  recentActivity: number
  previousActivity: number
  engagement: number
  publishedAt: Date | string
  lifetimeViews?: number
  category?: string | null
}

export type TrendingBreakdown = {
  recentActivity: number
  velocity: number
  growthRate: number
  momentum: number
  engagement: number
  recency: number
  discovery: number
  finalScore: number
}

const safe = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0)
const logScale = (value: number) => Math.log1p(safe(value))
const normalize = (value: number, max: number) => (max > 0 ? Math.min(1, safe(value) / max) : 0)

export function calculateTrendingScore(
  signals: TrendingSignals,
  population: { maxRecent: number; maxMomentum: number; maxEngagement: number; maxVelocity: number; now?: Date },
): TrendingBreakdown {
  const recent = safe(signals.recentActivity)
  const previous = safe(signals.previousActivity)
  const growthRate = previous === 0 ? (recent > 0 ? Math.min(4, recent) : 0) : recent / previous
  const acceleration = Math.max(0, growthRate - 1)
  const momentum = logScale(recent) * (1 + Math.min(3, acceleration))
  const velocity = recent / 6
  const ageHours = Math.max(0, ((population.now ?? new Date()).getTime() - new Date(signals.publishedAt).getTime()) / 3_600_000)
  const recency = Math.exp(-ageHours / 72)
  const discovery = 1 / (1 + Math.log1p(safe(signals.lifetimeViews ?? 0)))
  const recentScore = normalize(logScale(recent), population.maxRecent)
  const momentumScore = normalize(momentum, population.maxMomentum)
  const engagementScore = normalize(logScale(signals.engagement), population.maxEngagement)
  const velocityScore = normalize(logScale(velocity), population.maxVelocity)
  const finalScore =
    TRENDING_WEIGHTS.recentActivity * recentScore +
    TRENDING_WEIGHTS.momentum * momentumScore +
    TRENDING_WEIGHTS.engagement * engagementScore +
    TRENDING_WEIGHTS.recency * recency +
    TRENDING_WEIGHTS.velocity * velocityScore +
    TRENDING_WEIGHTS.discovery * discovery

  return { recentActivity: recentScore, velocity: velocityScore, growthRate, momentum: momentumScore, engagement: engagementScore, recency, discovery, finalScore }
}

export function diversifyTrending<T extends { category?: string | null }>(items: T[], limit: number): T[] {
  const result: T[] = []
  const remaining = [...items]
  while (remaining.length && result.length < limit) {
    const nextIndex = remaining.findIndex((item) => !result.slice(-2).some((previous) => previous.category && previous.category === item.category))
    const [next] = remaining.splice(nextIndex < 0 ? 0 : nextIndex, 1)
    if (next) result.push(next)
  }
  return result
}

export const TRENDING_CONFIG = { candidateDays: 7, refreshSeconds: 300, minimumRecentActivity: 1 }

export function isTrendingEligible(recentActivity: number, publishedAt: Date | string, now = new Date()) {
  const ageDays = (now.getTime() - new Date(publishedAt).getTime()) / 86_400_000
  return safe(recentActivity) >= TRENDING_CONFIG.minimumRecentActivity || ageDays <= 1
}

export function rankTrending<T extends TrendingSignals>(items: T[], limit: number, now = new Date()) {
  const raw = items.map((item) => ({ item, breakdown: calculateTrendingScore(item, {
    maxRecent: Math.max(...items.map((i) => logScale(i.recentActivity)), 1),
    maxMomentum: Math.max(...items.map((i) => logScale(i.recentActivity) * (1 + Math.min(3, Math.max(0, (i.recentActivity / Math.max(i.previousActivity, 1)) - 1)))), 1),
    maxEngagement: Math.max(...items.map((i) => logScale(i.engagement)), 1),
    maxVelocity: Math.max(...items.map((i) => logScale(i.recentActivity / 6)), 1), now,
  }) })).sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore)
  return diversifyTrending(raw.map(({ item }) => item), limit)
}

export const __testing = { logScale, normalize }

export default calculateTrendingScore

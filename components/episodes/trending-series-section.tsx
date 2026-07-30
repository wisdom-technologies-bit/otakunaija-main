import Link from 'next/link'
import { SeriesCard } from '@/components/episodes/series-card'
import { getLatestEpisodeNumber } from '@/lib/db/queries'
import { type Series } from '@/lib/db/schema'

interface TrendingSeriesSectionProps {
  trendingSeries: Array<{ series: Series; creator?: any }>
}

export async function TrendingSeriesSection({ trendingSeries }: TrendingSeriesSectionProps) {
  // Compute episode counts for each series
  const seriesWithCounts = await Promise.all(
    trendingSeries.map(async (item) => {
      const episodeCount = await getLatestEpisodeNumber(item.series.id)
      return {
        ...item,
        episodeCount,
      }
    })
  )

  if (trendingSeries.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground">Trending Series</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {seriesWithCounts.map((item) => (
          <SeriesCard
            key={item.series.id}
            series={{
              ...item.series,
              episodeCount: item.episodeCount,
            }}
            creatorName={item.creator?.name}
            variant="poster"
          />
        ))}
      </div>

      <div className="text-center mt-6">
        <Link 
          href="/episodes"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View All Series
          <span>›</span>
        </Link>
      </div>
    </div>
  )
}

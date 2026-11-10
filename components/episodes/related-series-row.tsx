import { SeriesCard } from '@/components/episodes/series-card'
import { type Series } from '@/lib/db/schema'
import { selectRelatedSeries } from '@/lib/episode-ui'

type RelatedSeriesRowProps = {
  current: { slug: string; genre: string | null }
  candidates: Series[]
  limit?: number
}

/**
 * "More like this": series sharing at least one genre with the current one,
 * ranked by how many they share, excluding the series being viewed. Renders
 * nothing at all when there is no honest match, rather than filling a rail with
 * unrelated posters.
 */
export function RelatedSeriesRow({ current, candidates, limit = 6 }: RelatedSeriesRowProps) {
  const related = selectRelatedSeries(current, candidates, limit)
  if (related.length === 0) return null

  return (
    <section className="otk-section" aria-labelledby="related-series-heading" data-testid="related-series">
      <div className="otk-section-head">
        <div>
          <p className="otk-eyebrow">Because you are watching</p>
          <h2 id="related-series-heading" className="otk-section-title mt-1">
            More like this
          </h2>
        </div>
        <a href="/episodes/browse" className="otk-pill otk-focus">
          Browse all
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {related.map((series) => (
          <SeriesCard key={series.slug} series={series} variant="poster" />
        ))}
      </div>
    </section>
  )
}

export default RelatedSeriesRow

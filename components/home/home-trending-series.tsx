import Image from "next/image"
import Link from "next/link"
import { HomeSectionHeading } from "@/components/home/home-section-heading"
import { ScrollRow } from "@/components/shared/scroll-row"

export type TrendingSeriesItem = {
  slug: string
  title: string
  posterImageUrl: string | null
  genre?: string | null
  status?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  upcoming: "Upcoming",
}

/** Ranked 2:3 posters (1-5) with a status chip, Netflix style. */
export function HomeTrendingSeries({ items }: { items: TrendingSeriesItem[] }) {
  const ranked = items.slice(0, 5)
  if (ranked.length === 0) return null

  return (
    <section className="otk-section" aria-labelledby="home-trending-series-heading">
      <HomeSectionHeading
        eyebrow="What everyone is watching"
        title="Trending series"
        href="/episodes"
        linkLabel="Browse series"
        shortLinkLabel="Browse"
        id="home-trending-series-heading"
      />

      <ScrollRow ariaLabel="Trending series" fade railClassName="otk-rail-trending">
        {ranked.map((item, index) => {
          const status = item.status ? STATUS_LABEL[item.status] ?? item.status : null
          return (
            <Link
              key={item.slug}
              href={`/episodes/${item.slug}`}
              className="otk-trending-card otk-focus group no-underline"
            >
              <div className="otk-card otk-rank-card">
                {item.posterImageUrl ? (
                  <Image
                    src={item.posterImageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 10rem, 9rem"
                    loading="lazy"
                    className="object-cover"
                  />
                ) : (
                  <div className="otk-cover-fallback otk-fallback-default" aria-hidden="true">
                    <span className="otk-cover-fallback-label">{item.title.slice(0, 12)}</span>
                  </div>
                )}
                <span className="otk-poster-scrim" aria-hidden="true" />
                <span className="otk-rank" aria-hidden="true">
                  {index + 1}
                </span>
                {status ? (
                  <span className="otk-chip otk-chip-corner">
                    {status}
                  </span>
                ) : null}
                <span className="sr-only">Rank {index + 1}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-semibold text-[var(--otk-text)] group-hover:text-[var(--otk-accent)]">
                {item.title}
              </p>
            </Link>
          )
        })}
      </ScrollRow>
    </section>
  )
}

export default HomeTrendingSeries

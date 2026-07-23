import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getSeriesBySlugWithEpisodes } from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { EpisodeRow } from '@/components/episodes/episode-row'
import { CreatorCredit } from '@/components/episodes/creator-credit'
import { ExpandableMarkdownSynopsis } from '@/components/episodes/expandable-markdown-synopsis'
import { Facebook } from 'lucide-react'

interface Props {
  params: Promise<{ 'series-slug': string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { 'series-slug': slug } = await params
  const data = await getSeriesBySlugWithEpisodes(slug)

  if (!data) {
    return {
      title: 'Series Not Found',
      description: 'The series you are looking for could not be found.',
    }
  }

  return {
    title: `${data.series.title}`,
    description: data.series.synopsis || `Watch ${data.series.title} on OtakuNaija.`,
    alternates: { canonical: `/episodes/${data.series.slug}` },
    openGraph: {
      title: data.series.title,
      description: data.series.synopsis || `Watch ${data.series.title} on OtakuNaija.`,
      images: data.series.coverImageUrl ? [{ url: data.series.coverImageUrl }] : [],
    },
  }
}

export default async function SeriesPage({ params }: Props) {
  const { 'series-slug': slug } = await params
  const data = await getSeriesBySlugWithEpisodes(slug)

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Series Not Found</h1>
            <p className="text-foreground/70 mb-6">The series you are looking for does not exist.</p>
            <Link href="/episodes" className="text-primary hover:underline">
              ← Back to Episodes
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    )
  }

  const { series, creator, episodes } = data
  const episodeCount = episodes.length

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* Breadcrumb */}
      <div className="border-b border-border/40 px-4 md:px-6 py-3">
        <div className="mx-auto max-w-7xl text-sm text-foreground/70">
          <Link href="/episodes" className="hover:text-primary transition-colors">
            Episodes
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{series.title}</span>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative h-96 w-full overflow-hidden bg-muted">
        {series.coverImageUrl && (
          <Image
            src={series.coverImageUrl}
            alt={series.title}
            fill
            className="object-cover"
            priority
          />
        )}
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-6">
          <div className="mx-auto w-full max-w-7xl space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{series.title}</h1>
              {series.genre && (
                <span className="rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground">
                  {series.genre}
                </span>
              )}
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium text-white ${series.status === 'ongoing' ? 'bg-emerald-900/70' : 'bg-slate-900/70'
                  }`}
              >
                {series.status === 'ongoing' ? 'Ongoing' : 'Completed'}
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* Creator Credit */}
      {creator && <CreatorCredit creator={creator} />}

      {/* Synopsis */}
      {series.synopsis && (
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 pt-8">
          <div className="max-w-2xl">
            <ExpandableMarkdownSynopsis synopsis={series.synopsis} />
          </div>
        </div>
      )}

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
        {/* Episodes Header */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground">
            Episodes <span className="text-foreground/50 font-normal">({episodeCount})</span>
          </h2>
        </div>

        {/* Episodes List */}
        {episodes.length > 0 ? (
          <div className="mb-12 space-y-3">
            {episodes.map((episode) => (
              <EpisodeRow key={episode.id} episode={episode} seriesSlug={series.slug} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border/40 bg-card/40 p-8 text-center mb-12">
            <p className="text-foreground/70">No episodes have been published yet.</p>
          </div>
        )}

        {/* Newsletter Section */}
        <div className="rounded-lg border border-border/60 bg-card/40 p-8 md:p-12 mb-12">
          <div className="max-w-2xl">
            <h3 className="mb-2 text-2xl font-bold text-foreground">
              Get weekly anime drops, straight to your inbox.
            </h3>
            <p className="mb-6 text-foreground/70">
              Subscribe to stay updated on new episodes from {creator?.name || 'your favorite creators'}.
            </p>
            <NewsletterSignup />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

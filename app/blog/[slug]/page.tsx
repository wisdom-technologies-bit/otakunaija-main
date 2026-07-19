import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock, Eye } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Sidebar } from "@/components/sidebar"
import { PostCard } from "@/components/post-card"
import { AdSlot } from "@/components/ad-slot"
import { NewsletterForm } from "@/components/newsletter-form"
import { BlogViewTracker } from "@/components/blog-view-tracker"
import {
  formatDate,
  getAllSlugs,
  getCoverImage,
  getPostBySlug,
  getRecentPosts,
  getRelatedPosts,
  getTrendingPosts,
} from "@/lib/posts"

export const revalidate = 300

export async function generateStaticParams() {
  const slugs = await getAllSlugs()
  return slugs.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return { title: "Post not found" }

  const cover = getCoverImage(post, 1200, 630)
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.published_at,
      authors: [post.author],
      tags: post.tags ?? [],
      images: [{ url: cover, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [cover],
    },
  }
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) notFound()

  const [related, recent, trending] = await Promise.all([
    getRelatedPosts(post.slug, post.category, 3),
    getRecentPosts(4),
    getTrendingPosts(5),
  ])

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    author: { "@type": "Person", name: post.author },
    datePublished: post.published_at,
    image: [getCoverImage(post, 1200, 630)],
    publisher: {
      "@type": "Organization",
      name: "OtakuNaija",
    },
  }

  const blocks = renderContent(post.content)
  const midpoint = Math.floor(blocks.length / 2)
  const firstHalf = blocks.slice(0, midpoint)
  const secondHalf = blocks.slice(midpoint)

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <BlogViewTracker postId={post.id} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="py-4">
            <AdSlot slot="header" />
          </div>

          <div className="grid gap-10 py-8 lg:grid-cols-[1fr_320px]">
            <article>
              <Link
                href="/blog"
                className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="h-3 w-3" /> Back to blog
              </Link>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/blog?category=${encodeURIComponent(post.category)}`}
                  className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground"
                >
                  {post.category}
                </Link>
              </div>

              <h1 className="mt-3 font-display text-3xl md:text-5xl font-bold leading-tight tracking-tight text-balance">
                {post.title}
              </h1>

              <p className="mt-4 text-lg text-muted-foreground text-pretty">{post.excerpt}</p>

              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{post.author}</span>
                <span aria-hidden>•</span>
                <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
                <span aria-hidden>•</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" /> {post.read_time} min read
                </span>
                <span aria-hidden>•</span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-4 w-4" /> {post.views.toLocaleString()} views
                </span>
              </div>

              <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-xl border border-border bg-muted">
                <Image
                  src={getCoverImage(post, 1400, 800)}
                  alt={post.title}
                  fill
                  priority
                  className="object-cover"
                  sizes="(min-width: 1024px) 800px, 100vw"
                />
              </div>

              <div className="mt-8 prose-anime">
                {firstHalf}

                <div className="my-10 not-prose">
                  <AdSlot slot="in-article" />
                </div>

                {secondHalf}
              </div>

              {post.tags && post.tags.length > 0 ? (
                <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-border pt-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags:</span>
                  {post.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground/80"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-10">
                <NewsletterForm />
              </div>

              {related.length > 0 ? (
                <section className="mt-14">
                  <h2 className="font-display text-2xl md:text-3xl font-bold">Related articles</h2>
                  <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {related.map((p) => (
                      <PostCard key={p.id} post={p} />
                    ))}
                  </div>
                </section>
              ) : null}
            </article>

            <Sidebar recent={recent} trending={trending} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

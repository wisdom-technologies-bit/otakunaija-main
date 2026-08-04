import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock, Eye, User, Calendar, TrendingUp } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Sidebar } from "@/components/sidebar"
import { PostCard } from "@/components/post-card"
import { AdSlot } from "@/components/ad-slot"
import { NewsletterForm } from "@/components/newsletter-form"
import { BlogViewTracker } from "@/components/blog-view-tracker"
import { ExpandableExcerpt } from "@/components/expandable-excerpt"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import {
  formatDate,
  getAllSlugs,
  getCoverImage,
  getPostBySlug,
  getRecentPosts,
  getRelatedPosts,
  getTrendingPosts,
} from "@/lib/posts"

export const dynamic = "force-dynamic"

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

  const midpoint = Math.floor(post.content.length / 2)
  // Split at the nearest paragraph break so we don't cut a sentence in half
  const splitIndex = post.content.indexOf("\n\n", midpoint)
  const actualSplit = splitIndex === -1 ? post.content.length : splitIndex
  const firstHalf = post.content.slice(0, actualSplit)
  const secondHalf = post.content.slice(actualSplit)

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <BlogViewTracker postId={post.id} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BreadcrumbList",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://otakunaija.name.ng/"
                  },
                  {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Blog",
                    "item": "https://otakunaija.name.ng/blog"
                  },
                  {
                    "@type": "ListItem",
                    "position": 3,
                    "name": post.title,
                    "item": `https://otakunaija.name.ng/blog/${post.slug}`
                  }
                ]
              },
              {
                "@type": "BlogPosting",
                "headline": post.title,
                "description": post.excerpt,
                "image": getCoverImage(post, 1200, 630),
                "datePublished": post.published_at,
                "dateModified": post.published_at, // use post.updated_at if available
                "author": {
                  "@type": "Person",
                  "name": post.author,
                  "url": "https://otakunaija.name.ng"
                },
                "publisher": {
                  "@type": "Organization",
                  "name": "OtakuNaija",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://otakunaija.name.ng/android-chrome-512x512.png"
                  }
                }
              }
            ]
          })
        }}
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

              <h1 className="mt-3 font-display text-2xl md:text-3xl font-bold leading-tight tracking-tight text-balance">
                {post.title}
              </h1>

              <ExpandableExcerpt excerpt={post.excerpt} />

              <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card/70 backdrop-blur-sm">

                {/* Top Row */}
                <div className="grid grid-cols-3 divide-x divide-border">

                  {/* Author */}
                  <div className="flex flex-col items-center justify-center px-2 py-2 text-center">
                    <Image
                      src="/logo.png"
                      alt="OtakuNaija"
                      width={38}
                      height={38}
                      className="mb-3 rounded-full border-2 border-primary object-cover"
                    />

                    <span className="text-[10px] text-muted-foreground">
                      Written by
                    </span>

                    <span className="mt-1 text-sm font-bold">
                      {post.author}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="flex flex-col items-center justify-center px-2 py-2 text-center">
                    <div className="mb-1.5 rounded-lg bg-primary/10 p-2">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>

                    <span className="text-[10px] text-muted-foreground">
                      Published
                    </span>

                    <span className="mt-1 text-sm font-bold">
                      {formatDate(post.published_at)}
                    </span>
                  </div>

                  {/* Reading Time */}
                  <div className="flex flex-col items-center justify-center px-2 py-2 text-center">
                    <div className="mb-3 rounded-xl bg-primary/10 px-3">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>

                    <span className="text-[10px] text-muted-foreground">
                      Reading Time
                    </span>

                    <span className="mt-1 text-sm font-bold">
                      {post.read_time} min read
                    </span>
                  </div>

                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Bottom Row */}
                <div className="grid grid-cols-2 divide-x divide-border">

                  {/* Views */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <Eye className="h-4 w-4 text-primary" />
                    </div>

                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Total Views
                      </p>

                      <p className="text-[15px] font-bold leading-tight">
                        {post.views.toLocaleString()} views
                      </p>
                    </div>
                  </div>

                  {/* Support Message */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        Thanks for reading!
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Your support means a lot.
                      </p>
                    </div>
                  </div>

                </div>

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

              <div className="mt-8 prose-anime prose prose-invert max-w-none prose-sm md:prose-base">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{firstHalf}</ReactMarkdown>

                <div className="my-10 not-prose">
                  <AdSlot slot="footer" />
                </div>

                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{secondHalf}</ReactMarkdown>
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

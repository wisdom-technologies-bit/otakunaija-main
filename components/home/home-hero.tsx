"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { formatRelativeTime, getCoverImage, type Post } from "@/lib/posts"

type HomeHeroProps = { posts: Post[] }

export function HomeHero({ posts }: HomeHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const pointerStart = useRef<number | null>(null)
  const total = posts.length
  const hasControls = total > 1

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    if (!hasControls || paused || reducedMotion) return
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % total), 7000)
    return () => window.clearInterval(timer)
  }, [hasControls, paused, reducedMotion, total])

  useEffect(() => {
    const handleVisibility = () => setPaused(document.hidden)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [])

  const goTo = useCallback((index: number) => setActiveIndex((index + total) % total), [total])
  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo])
  const previous = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      previous()
    }
    if (event.key === "ArrowRight") {
      event.preventDefault()
      next()
    }
  }

  if (total === 0) {
    return     <section className="home-premium-hero relative flex items-end overflow-hidden" role="region" aria-roledescription="carousel" aria-label="Featured stories"><div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,var(--hp-glow),transparent_40%),linear-gradient(145deg,var(--hp-surface-2),var(--hp-bg))]" /><div className="hp-container relative z-10 w-full pb-16 md:pb-20"><p className="hp-eyebrow">OtakuNaija</p><p className="hp-display mt-4 max-w-4xl text-white">Stories for the next generation of otakus.</p></div></section>
  }

  return (
    <section
      className="home-premium-hero relative overflow-hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured stories"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}
      onPointerDown={(event) => { pointerStart.current = event.clientX }}
      onPointerUp={(event) => { if (pointerStart.current === null) return; const distance = event.clientX - pointerStart.current; if (Math.abs(distance) > 48) (distance < 0 ? next : previous)(); pointerStart.current = null }}
    >
      {posts.map((post, index) => {
        const active = index === activeIndex
        return (
          <article key={post.id} className={`home-premium-hero-slide absolute inset-0 ${active ? "is-active" : ""}`} aria-hidden={!active} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${total}`}>
            <Image src={getCoverImage(post, 1600, 900)} alt={post.title} fill sizes="100vw" priority={index === 0} loading={index === 0 ? undefined : "lazy"} className="home-premium-hero-image object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.04_0.01_280_/_0.72),transparent_70%)]" aria-hidden="true" />
            <div className="hp-scrim absolute inset-0" aria-hidden="true" />
            <div className="hp-container relative z-10 flex h-full w-full items-end pb-28 md:pb-32">
              <div className="max-w-3xl">
                <p className="hp-eyebrow">Featured · {post.category}</p>
                <h2 className="hp-display mt-4 max-w-3xl text-white"><Link href={`/blog/${post.slug}`} className="hp-focus" tabIndex={active ? 0 : -1}>{post.title}</Link></h2>
                <p className="mt-5 hidden max-w-2xl line-clamp-2 text-sm leading-relaxed text-white/75 md:block">{post.excerpt}</p>
                <p className="hp-meta mt-5 text-white/70">{post.author} <span aria-hidden="true">·</span> {formatRelativeTime(post.published_at)} <span aria-hidden="true">·</span> {post.read_time} min read</p>
                <Link href={`/blog/${post.slug}`} className="hp-focus mt-6 inline-flex items-center rounded-full bg-[var(--hp-accent)] px-5 py-3 text-sm font-bold text-primary-foreground" tabIndex={active ? 0 : -1}>Read story <ArrowRight className="ml-2 size-4" aria-hidden="true" /></Link>
              </div>
            </div>
          </article>
        )
      })}
      {hasControls ? <div className="absolute inset-x-0 bottom-7 z-20"><div className="hp-container flex items-end justify-between"><div className="flex items-center gap-3"><div className="hidden gap-2 md:flex">{posts.map((post, index) => <button key={post.id} type="button" className="home-premium-hero-progress hp-focus" aria-label={`Go to slide ${index + 1}`} aria-current={index === activeIndex ? "true" : undefined} onClick={() => goTo(index)}><span className={index === activeIndex ? "is-filled" : ""} /></button>)}</div><span className="home-premium-hero-counter hp-display text-white">{String(activeIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span></div><div className="hidden gap-2 md:flex"><button type="button" className="hp-focus home-premium-hero-arrow" aria-label="Previous slide" onClick={previous}><ArrowLeft aria-hidden="true" /></button><button type="button" className="hp-focus home-premium-hero-arrow" aria-label="Next slide" onClick={next}><ArrowRight aria-hidden="true" /></button></div></div></div> : null}
      <p className="sr-only" aria-live={paused || reducedMotion ? "polite" : "off"}>{posts[activeIndex]?.title}</p>
    </section>
  )
}

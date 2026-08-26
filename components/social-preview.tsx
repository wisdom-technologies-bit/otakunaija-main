"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"

type PreviewData = {
  title: string | null
  description: string | null
  image: string | null
  url: string
  siteName: string | null
}

export function SocialPreview({ url }: { url: string }) {
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadPreview() {
      try {
        const response = await fetch(
          `/api/link-preview?url=${encodeURIComponent(url)}`
        )

        if (!response.ok) {
          throw new Error("Failed to load preview")
        }

        const result = await response.json()

        if (!cancelled) {
          setData(result)
        }
      } catch (error) {
        console.error("Social preview error:", error)

        if (!cancelled) {
          setData(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadPreview()

    return () => {
      cancelled = true
    }
  }, [url])

  if (loading) {
    return (
      <div className="my-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="aspect-[1.91/1] animate-pulse bg-muted" />

        <div className="space-y-3 p-4">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (!data || !data.title) {
    return (
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="my-6 block rounded-xl border border-border bg-card p-4 text-primary hover:underline"
      >
        {url}
      </Link>
    )
  }

  return (
    <Link
      href={data.url || url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-6 block overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg"
    >
      {data.image && (
        <div className="relative aspect-[1.91/1] w-full overflow-hidden bg-muted">
          <Image
            src={data.image}
            alt={data.title}
            fill
            className="object-cover transition-transform duration-300 hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, 800px"
            unoptimized
          />
        </div>
      )}

      <div className="p-4">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {data.siteName}
        </p>

        <h3 className="font-display text-lg font-bold leading-tight">
          {data.title}
        </h3>

        {data.description && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {data.description}
          </p>
        )}

        <p className="mt-3 truncate text-xs text-primary">
          {data.url}
        </p>
      </div>
    </Link>
  )
}
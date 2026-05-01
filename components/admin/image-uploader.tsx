"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"

type Props = {
  name: string
  defaultValue?: string
  label?: string
}

export function ImageUploader({ name, defaultValue, label = "Cover Image" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string>(defaultValue || "")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = () => inputRef.current?.click()

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Upload failed")
      }
      setUrl(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
      <input type="hidden" name={name} value={url} />

      {url ? (
        <div className="relative overflow-hidden rounded-lg border border-border">
          <div className="relative aspect-[16/9] w-full bg-muted">
            <Image
              src={url || "/placeholder.svg"}
              alt="Cover preview"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 50vw, 100vw"
              unoptimized
            />
          </div>
          <button
            type="button"
            onClick={() => setUrl("")}
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onPick}
            disabled={uploading}
            className="absolute bottom-2 right-2 rounded-md bg-background/85 px-2.5 py-1 text-xs font-medium backdrop-blur hover:bg-background disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Replace"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={uploading}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Uploading to Cloudinary...</span>
            </>
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <span>Click to upload cover image</span>
              <span className="text-xs">JPG, PNG, or WebP up to 10MB</span>
            </>
          )}
        </button>
      )}

      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Or paste an image URL..."
        className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

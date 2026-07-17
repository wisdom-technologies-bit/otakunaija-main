"use client"

import { useRef, useState, useCallback } from "react"
import Image from "next/image"
import { Upload, X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

type Props = {
  name: string
  thumbnailName: string
  durationName: string
  videoPublicIdName: string
  onUploadComplete?: (data: {
    video_url: string
    thumbnail_url: string
    duration: number
    public_id: string
  }) => void
  defaultVideoUrl?: string
  defaultThumbnailUrl?: string
}

export function VideoUploader({
  name,
  thumbnailName,
  durationName,
  videoPublicIdName,
  onUploadComplete,
  defaultVideoUrl,
  defaultThumbnailUrl,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [videoUrl, setVideoUrl] = useState<string>(defaultVideoUrl || "")
  const [thumbnailUrl, setThumbnailUrl] = useState<string>(defaultThumbnailUrl || "")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [publicId, setPublicId] = useState<string>("")

  const onPick = () => inputRef.current?.click()

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"]
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Please upload MP4, MOV, MKV, or WebM.")
      return
    }

    // Validate file size (max 500MB for video)
    if (file.size > 500 * 1024 * 1024) {
      setError("File too large. Maximum size is 500MB.")
      return
    }

    setError(null)
    setProgress(0)
    setUploading(true)

    try {
      // Get upload signature from server
      // This is a server-side-only operation: server generates and returns a signature
      // without receiving the actual video file, protecting our Cloudinary secret
      const signRes = await fetch("/api/cloudinary/sign", { 
        method: "POST",
        credentials: "include"  // CRITICAL: Include cookies for session authentication
      })
      if (!signRes.ok) {
        const errorData = await signRes.json().catch(() => ({}))
        const errorMsg = errorData.error || "Failed to get upload signature"
        console.error("[v0] Sign endpoint error:", signRes.status, errorMsg)
        
        if (signRes.status === 401) {
          throw new Error("You are not authenticated. Please log in again.")
        } else if (signRes.status === 500) {
          throw new Error("Cloudinary configuration error. Please contact support.")
        }
        throw new Error(errorMsg)
      }
      const { signature, timestamp, api_key, cloud_name } = (await signRes.json()) as {
        signature: string
        timestamp: number
        api_key: string
        cloud_name: string
      }

      // Build FormData for Cloudinary direct upload
      const formData = new FormData()
      formData.append("file", file)
      formData.append("api_key", api_key)
      formData.append("signature", signature)
      formData.append("timestamp", timestamp.toString())
      formData.append("folder", "otakunaija/episodes")

      // Upload directly to Cloudinary from browser
      // This avoids routing large video files through Vercel, which has request/execution limits
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100)
          setProgress(percentComplete)
        }
      })

      xhr.addEventListener("load", () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText) as {
              public_id: string
              secure_url: string
              duration: number
            }

            // Build video URL with Cloudinary transforms for auto format and quality
            const videoUrlWithTransform = `https://res.cloudinary.com/${cloud_name}/video/upload/f_auto,q_auto/${response.public_id}.mp4`

            // Build thumbnail URL from Cloudinary (auto-generated poster frame)
            const thumbnailUrlGenerated = `https://res.cloudinary.com/${cloud_name}/video/upload/f_auto,q_auto,w_400,h_225,c_fill/${response.public_id}.jpg`

            setVideoUrl(videoUrlWithTransform)
            setThumbnailUrl(thumbnailUrlGenerated)
            setDuration(Math.round(response.duration))
            setPublicId(response.public_id)
            setProgress(100)
            setUploading(false)

            if (onUploadComplete) {
              onUploadComplete({
                video_url: videoUrlWithTransform,
                thumbnail_url: thumbnailUrlGenerated,
                duration: Math.round(response.duration),
                public_id: response.public_id,
              })
            }
          } catch (e) {
            setError("Failed to parse Cloudinary response")
            setUploading(false)
          }
        } else {
          setError(`Upload failed with status ${xhr.status}`)
          setUploading(false)
        }
      })

      xhr.addEventListener("error", () => {
        setError("Upload failed. Check your connection and try again.")
        setUploading(false)
      })

      xhr.addEventListener("abort", () => {
        setError("Upload cancelled.")
        setUploading(false)
      })

      xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`)
      xhr.send(formData)
    } catch (err) {
      // This catch only handles errors from the signature fetch and synchronous code before xhr.send()
      setError(err instanceof Error ? err.message : "Upload failed")
      setUploading(false)
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const handleRemoveVideo = () => {
    setVideoUrl("")
    setThumbnailUrl("")
    setDuration(null)
    setPublicId("")
    setProgress(0)
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Video Upload</label>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
        className="hidden"
        onChange={onChange}
      />

      {/* Hidden fields for form submission */}
      <input type="hidden" name={name} value={videoUrl} />
      <input type="hidden" name={thumbnailName} value={thumbnailUrl} />
      <input type="hidden" name={durationName} value={duration || ""} />
      <input type="hidden" name={videoPublicIdName} value={publicId} />

      {videoUrl && thumbnailUrl ? (
        <div className="space-y-3">
          {/* Video uploaded - show preview */}
          <div className="relative overflow-hidden rounded-lg border border-border">
            <div className="relative aspect-video w-full bg-muted">
              <Image
                src={thumbnailUrl}
                alt="Video thumbnail"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 50vw, 100vw"
                unoptimized
              />
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                  <div className="ml-0.5 h-0 w-0 border-l-4 border-t-2 border-b-2 border-l-black border-t-transparent border-b-transparent" />
                </div>
              </div>
            </div>

            {/* Video info */}
            <div className="bg-card p-3 text-xs">
              {duration && (
                <p className="text-muted-foreground">
                  Duration: <span className="font-medium">{formatDuration(duration)}</span>
                </p>
              )}
              {publicId && (
                <p className="mt-1 truncate text-muted-foreground">
                  ID: <span className="font-medium">{publicId}</span>
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 border-t border-border p-3">
              <button
                type="button"
                onClick={onPick}
                disabled={uploading}
                className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Replace"}
              </button>
              <button
                type="button"
                onClick={handleRemoveVideo}
                disabled={uploading}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-card disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {uploading && (
            <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-950">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {progress}% uploaded
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900">
                <div
                  className="h-full bg-blue-600 transition-all dark:bg-blue-400"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* No video - show upload area */}
          <button
            type="button"
            onClick={onPick}
            disabled={uploading}
            className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin" />
                <span>Uploading video... {progress}%</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8" />
                <div className="text-center">
                  <span className="block">Click to upload or drag and drop</span>
                  <span className="text-xs">MP4, MOV, MKV or WebM up to 500MB</span>
                </div>
              </>
            )}
          </button>

          {error && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Upload failed</p>
              <p className="mt-1 text-xs">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setUploading(false)
                }}
                className="mt-2 text-xs font-medium underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

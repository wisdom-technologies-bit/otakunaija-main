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
  defaultPublicId?: string
}

export function VideoUploader({
  name,
  thumbnailName,
  durationName,
  videoPublicIdName,
  onUploadComplete,
  defaultVideoUrl,
  defaultThumbnailUrl,
  defaultPublicId,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [videoUrl, setVideoUrl] = useState<string>(defaultVideoUrl || "")
  const [thumbnailUrl, setThumbnailUrl] = useState<string>(defaultThumbnailUrl || "")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [publicId, setPublicId] = useState<string>(defaultPublicId || "")

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
      // Get presigned URL from server
      // Server generates a presigned PUT URL for R2, valid for 10 minutes
      const presignRes = await fetch("/api/r2/presign", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      })

      if (!presignRes.ok) {
        const errorData = await presignRes.json().catch(() => ({}))
        const errorMsg = errorData.error || "Failed to get presigned URL"

        if (presignRes.status === 401) {
          throw new Error("You are not authenticated. Your session may have expired. Please refresh the page and log in again.")
        } else if (presignRes.status === 500) {
          throw new Error("R2 configuration error: " + errorMsg + ". Please contact support.")
        }
        throw new Error(errorMsg)
      }

      const { presignedUrl, objectKey, publicUrl } = (await presignRes.json()) as {
        presignedUrl: string
        objectKey: string
        publicUrl: string
      }

      // Upload directly to R2 from browser using presigned URL
      // This avoids routing large video files through Vercel, which has request/execution limits
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100)
          setProgress(percentComplete)
        }
      })

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          try {
            // For R2 presigned PUT, a 200 status means success with EMPTY response body
            // R2 does not return JSON like Cloudinary did
            
            // Extract duration from the video file client-side
            const tempVideo = document.createElement('video')
            const objectUrl = URL.createObjectURL(file)
            tempVideo.src = objectUrl
            
            tempVideo.addEventListener('loadedmetadata', () => {
              const videoDuration = Math.round(tempVideo.duration)
              
              // Generate thumbnail from video at ~1 second
              const canvas = document.createElement('canvas')
              canvas.width = 320
              canvas.height = 180
              const ctx = canvas.getContext('2d')
              if (ctx) {
                tempVideo.currentTime = Math.min(1, tempVideo.duration * 0.1) // 1 second or 10% in
                tempVideo.addEventListener('seeked', () => {
                  ctx.drawImage(tempVideo, 0, 0, 320, 180)
                  canvas.toBlob(async (blob) => {
                    if (blob) {
                      try {
                        // Upload thumbnail to Cloudinary using the existing image upload endpoint
                        const fd = new FormData()
                        fd.append('file', blob, 'thumbnail.jpg')
                        const thumbRes = await fetch('/api/admin/upload', { 
                          method: 'POST', 
                          body: fd,
                          credentials: 'include'
                        })
                        const thumbData = (await thumbRes.json()) as { url?: string; error?: string }
                        
                        if (!thumbRes.ok || !thumbData.url) {
                          throw new Error(thumbData.error || "Thumbnail upload failed")
                        }
                        
                        // All successful - set state
                        setVideoUrl(publicUrl)
                        setThumbnailUrl(thumbData.url)
                        setDuration(videoDuration)
                        setPublicId(objectKey)
                        setProgress(100)
                        setUploading(false)
                        setError(null)

                        if (onUploadComplete) {
                          onUploadComplete({
                            video_url: publicUrl,
                            thumbnail_url: thumbData.url,
                            duration: videoDuration,
                            public_id: objectKey,
                          })
                        }
                      } catch (thumbErr) {
                        setError(thumbErr instanceof Error ? thumbErr.message : "Thumbnail generation failed")
                        setUploading(false)
                      }
                    }
                    URL.revokeObjectURL(objectUrl)
                  }, 'image/jpeg', 0.8)
                }, { once: true })
              }
            }, { once: true })
            
            tempVideo.addEventListener('error', (e) => {
              URL.revokeObjectURL(objectUrl)
              setError("Failed to read video metadata")
              setUploading(false)
            }, { once: true })
          } catch (e) {
            setError("Failed to process upload response")
            setUploading(false)
          }
        } else {
          setError(`Upload failed with status ${xhr.status}. Please check your session and try again.`)
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

      // Use PUT request with the presigned URL
      // The file is sent as the request body with the appropriate Content-Type header
      xhr.open("PUT", presignedUrl)
      xhr.setRequestHeader("Content-Type", file.type)
      xhr.send(file)
    } catch (err) {
      // This catch only handles errors from the presign fetch and synchronous code before xhr.send()
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

"use client"

import { useRef, useState } from "react"
import { Upload, X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

type Props = {
  name: string
  onUploadComplete?: (url: string) => void
  defaultSubtitlesUrl?: string | null
}

export function SubtitleUploader({
  name,
  onUploadComplete,
  defaultSubtitlesUrl,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subtitlesUrl, setSubtitlesUrl] = useState<string>(defaultSubtitlesUrl || "")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")

  const onPick = () => inputRef.current?.click()

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type - accept .srt and .vtt
    const validExtensions = [".srt", ".vtt"]
    const ext = file.name.toLowerCase().slice(-4)
    
    if (!validExtensions.includes(ext)) {
      setError("Invalid file type. Please upload .srt or .vtt subtitle files.")
      return
    }

    // Validate file size (max 50MB for subtitles)
    if (file.size > 50 * 1024 * 1024) {
      setError("File too large. Maximum size is 50MB.")
      return
    }

    setError(null)
    setProgress(0)
    setUploading(true)
    setFileName(file.name)

    try {
      // Get presigned URL from server
      const presignRes = await fetch("/api/r2/subtitle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: ext === ".srt" ? "application/x-subrip" : "text/vtt",
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

      const { presignedUrl, publicUrl } = (await presignRes.json()) as {
        presignedUrl: string
        publicUrl: string
      }

      // Upload directly to R2 from browser using presigned URL
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100)
          setProgress(percentComplete)
        }
      })

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          // Success - R2 presigned PUT returns 200 with empty body
          setSubtitlesUrl(publicUrl)
          setProgress(100)
          setUploading(false)
          setError(null)

          if (onUploadComplete) {
            onUploadComplete(publicUrl)
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
      xhr.open("PUT", presignedUrl)
      xhr.setRequestHeader("Content-Type", ext === ".srt" ? "application/x-subrip" : "text/vtt")
      xhr.send(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
      setUploading(false)
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const handleRemoveSubtitles = () => {
    setSubtitlesUrl("")
    setFileName("")
    setProgress(0)
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Subtitles (Optional)</label>
      <input
        ref={inputRef}
        type="file"
        accept=".srt,.vtt,text/plain,text/vtt"
        className="hidden"
        onChange={onChange}
      />

      {/* Hidden field for form submission */}
      <input type="hidden" name={name} value={subtitlesUrl} />

      {subtitlesUrl ? (
        <div className="space-y-3">
          {/* Subtitles uploaded - show preview */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">Subtitles uploaded successfully</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveSubtitles}
                disabled={uploading}
                className="rounded-md p-2 hover:bg-card disabled:opacity-50"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* No subtitles - show upload area */}
          <button
            type="button"
            onClick={onPick}
            disabled={uploading}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card/50 py-8 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Uploading subtitles... {progress}%</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6" />
                <div className="text-center">
                  <span className="block">Click to upload or drag and drop</span>
                  <span className="text-xs">SRT or VTT files up to 50MB</span>
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
  )
}

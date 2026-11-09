"use client"

import { useRef, useState, useTransition } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Mail01FreeIcons } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { subscribeToNewsletter } from "@/app/actions/newsletter"
import { cn } from "@/lib/utils"

type NewsletterFormProps = {
  variant?: "card" | "inline" | "hero"
  className?: string
  /** Recorded on the subscriber row so we know which form they used. */
  source?: string
}

const HONEYPOT_NAME = "otk_website"

export function NewsletterForm({ variant = "card", className, source = "site-form" }: NewsletterFormProps) {
  const [email, setEmail] = useState("")
  const [pending, startTransition] = useTransition()
  const honeypotRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    const honeypot = honeypotRef.current?.value ?? ""

    startTransition(async () => {
      const res = await subscribeToNewsletter(value, { honeypot, source })
      if (res.ok) {
        toast.success(res.message ?? "Almost there. Check your inbox to confirm.")
        setEmail("")
      } else {
        toast.error(res.message ?? "Something went wrong.")
      }
    })
  }

  const honeypot = (
    <input
      ref={honeypotRef}
      type="text"
      name={HONEYPOT_NAME}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      defaultValue=""
      className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
    />
  )

  if (variant === "inline") {
    return (
      <form onSubmit={handleSubmit} className={cn("relative flex w-full max-w-md gap-2", className)}>
        {honeypot}
        <Input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 bg-card border-border"
          aria-label="Email address"
        />
        <Button type="submit" disabled={pending} className="h-11 bg-primary text-primary-foreground hover:bg-primary/90">
          {pending ? <Spinner className="size-4" /> : "Subscribe"}
        </Button>
      </form>
    )
  }

  if (variant === "hero") {
    return (
      <form
        onSubmit={handleSubmit}
        className={cn("relative flex w-full max-w-lg flex-col gap-2 sm:flex-row", className)}
      >
        {honeypot}
        <Input
          type="email"
          required
          placeholder="Your email for the daily briefing"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 bg-card border-border text-base"
          aria-label="Email address"
        />
        <Button
          type="submit"
          disabled={pending}
          className="h-12 shrink-0 bg-primary px-6 text-primary-foreground hover:bg-primary/90"
        >
          {pending ? <Spinner className="size-4" /> : "Get the briefing"}
        </Button>
        <p className="text-xs text-muted-foreground sm:hidden">
          One email each morning.{" "}
          <a href="/newsletter/preferences" className="underline hover:text-foreground">
            Already subscribed? Set your preferences
          </a>
          .
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={cn("relative flex flex-col gap-3", className)}>
      {honeypot}
      <div className="flex items-center gap-2 text-sm font-semibold">
        <HugeiconsIcon icon={Mail01FreeIcons} className="size-4 text-primary" />
        Daily anime briefing
      </div>
      <p className="text-sm text-muted-foreground">
        One email each morning: the news that matters, new episodes, and what airs next.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 bg-background border-border"
          aria-label="Email address"
        />
        <Button type="submit" disabled={pending} className="h-11 bg-primary text-primary-foreground hover:bg-primary/90">
          {pending ? <Spinner className="size-4" /> : "Subscribe"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        We send a confirmation first, so nothing arrives until you tap it.{" "}
        <a href="/newsletter/preferences" className="underline hover:text-foreground">
          Already subscribed? Set your preferences
        </a>
        . Unsubscribe any time.
      </p>
    </form>
  )
}

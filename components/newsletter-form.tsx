"use client"

import { useState, useTransition } from "react"
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
}

export function NewsletterForm({ variant = "card", className }: NewsletterFormProps) {
  const [email, setEmail] = useState("")
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    startTransition(async () => {
      const res = await subscribeToNewsletter(value)
      if (res.ok) {
        toast.success(res.message ?? "Subscribed! Check your inbox.")
        setEmail("")
      } else {
        toast.error(res.message ?? "Something went wrong.")
      }
    })
  }

  if (variant === "inline") {
    return (
      <form onSubmit={handleSubmit} className={cn("flex w-full max-w-md gap-2", className)}>
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
        className={cn("flex w-full max-w-lg flex-col gap-2 sm:flex-row", className)}
      >
        <Input
          type="email"
          required
          placeholder="Drop your email for weekly anime drops"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 bg-card border-border text-base"
          aria-label="Email address"
        />
        <Button
          type="submit"
          disabled={pending}
          className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {pending ? <Spinner className="size-4" /> : "Join the crew"}
        </Button>
      </form>
    )
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-gradient-to-br from-card to-card/40 p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-primary">
        <HugeiconsIcon
          icon={Mail01FreeIcons}
          size={16}
          strokeWidth={2}
        />
        <span className="text-xs font-semibold uppercase tracking-wider">Newsletter</span>
      </div>
      <h3 className="mt-2 font-display text-lg font-semibold text-foreground text-balance">
        Get weekly anime drops, straight to your inbox.
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        New episodes, reviews, and recommendations every Sunday. No spam.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
        <Input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 bg-background border-border"
          aria-label="Email address"
        />
        <Button
          type="submit"
          disabled={pending}
          className="h-11 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {pending ? <Spinner className="size-4" /> : "Subscribe"}
        </Button>
      </form>
    </section>
  )
}

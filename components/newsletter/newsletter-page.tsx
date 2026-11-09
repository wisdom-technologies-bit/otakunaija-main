import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

/** Shared frame for the three token pages. Same header/footer as the site. */
export function NewsletterPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string
  title: string
  intro?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-xl px-4 py-12 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          {intro ? <p className="mt-3 text-sm text-muted-foreground">{intro}</p> : null}
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 md:p-8">{children}</div>
          <p className="mt-6 text-xs text-muted-foreground">
            Questions? Reply to any email from us, or use the{" "}
            <a href="/contact" className="underline hover:text-foreground">
              contact page
            </a>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export function NewsletterNotice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "error"
  title: string
  children?: ReactNode
}) {
  const styles =
    tone === "success"
      ? "border-primary/30 bg-primary/5"
      : tone === "error"
        ? "border-destructive/40 bg-destructive/5"
        : "border-border bg-background"

  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-sm font-semibold">{title}</p>
      {children ? <div className="mt-2 text-sm text-muted-foreground">{children}</div> : null}
    </div>
  )
}

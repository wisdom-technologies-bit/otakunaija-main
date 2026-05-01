import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="font-display text-7xl md:text-9xl font-bold text-primary">404</p>
          <h1 className="mt-4 font-display text-2xl md:text-3xl font-bold">This page wandered off</h1>
          <p className="mt-3 text-muted-foreground">
            The article you&apos;re looking for might have been moved or no longer exists. Try the homepage or search
            for what you need.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/">Go home</Link>
            </Button>
            <Button asChild variant="outline" className="border-border bg-transparent">
              <Link href="/blog">Read articles</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

import { redirect } from "next/navigation"
import { getCurrentSession } from "@/lib/auth"
import { LoginForm } from "@/components/admin/login-form"

export const metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{ from?: string }>

export default async function AdminLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { from } = await searchParams
  const session = await getCurrentSession()
  if (session) {
    redirect(from || "/admin")
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-display text-base font-bold">
            ON
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
            Otaku<span className="text-primary">Naija</span> Admin
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your content</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <LoginForm from={from} />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          OtakuNaija &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

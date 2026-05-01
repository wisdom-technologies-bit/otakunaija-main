import type { ReactNode } from "react"
import { AdminShell } from "@/components/admin/admin-shell"
import { getCurrentSession } from "@/lib/auth"

export const metadata = {
  title: { default: "Admin", template: "%s | OtakuNaija Admin" },
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession()

  // The proxy/middleware redirects unauthenticated requests on /admin/* to /admin/login,
  // so the only way to reach this layout without a session is the login page itself.
  if (!session) {
    return <>{children}</>
  }

  return <AdminShell email={session.email}>{children}</AdminShell>
}

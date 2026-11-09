import { ADMIN_EMAIL, getCurrentSession } from "@/lib/auth"

/**
 * Admin gate for the newsletter API routes.
 *
 * Same rule as every other admin route in this repo: a signed session whose
 * address is the configured ADMIN_EMAIL. The page under /admin/newsletter is
 * additionally protected by the /admin middleware redirect.
 */
export async function requireAdmin(): Promise<{ email: string } | null> {
  const session = await getCurrentSession()
  if (!session) return null
  if (session.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return null
  return { email: session.email }
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}

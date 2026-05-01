import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow login page itself
  if (pathname === "/admin/login") {
    return NextResponse.next()
  }

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    const session = await verifySessionToken(token)
    if (!session) {
      const url = request.nextUrl.clone()
      url.pathname = "/admin/login"
      url.searchParams.set("from", pathname)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}

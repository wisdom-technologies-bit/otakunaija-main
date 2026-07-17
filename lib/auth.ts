import { cookies } from "next/headers"

export const SESSION_COOKIE = "otakunaija_session"
const SESSION_TTL_DAYS = 7

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "support@otakunaija.com.ng").toLowerCase()

function getSecret(): string {
  return process.env.SESSION_SECRET || "otakunaija-dev-secret-change-me"
}

function b64UrlEncode(bytes: Uint8Array): string {
  let str = ""
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64UrlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/")
  while (s.length % 4) s += "="
  const str = atob(s)
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes
}

async function hmacKey(secret: string) {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  return b64UrlEncode(new Uint8Array(sig))
}

export type SessionPayload = { email: string; exp: number }

export async function createSessionToken(email: string, ttlDays = SESSION_TTL_DAYS): Promise<string> {
  const exp = Date.now() + ttlDays * 24 * 60 * 60 * 1000
  const json = JSON.stringify({ email: email.toLowerCase(), exp })
  const payload = b64UrlEncode(new TextEncoder().encode(json))
  const sig = await sign(payload, getSecret())
  return `${payload}.${sig}`
}

export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  const expected = await sign(payload, getSecret())
  if (sig !== expected) return null
  try {
    const json = new TextDecoder().decode(b64UrlDecode(payload))
    const data = JSON.parse(json) as SessionPayload
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null
    if (typeof data.email !== "string") return null
    return data
  } catch {
    return null
  }
}

export async function getCurrentSession(): Promise<SessionPayload | null> {
  const c = await cookies()
  const token = c.get(SESSION_COOKIE)?.value
  return verifySessionToken(token)
}

export async function setSessionCookie(email: string): Promise<void> {
  const c = await cookies()
  const token = await createSessionToken(email)
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Use 'true' if explicitly set to secure, otherwise respect NODE_ENV
    // This ensures cookies work in development (http) but are secure in production (https)
    secure: process.env.SECURE_COOKIES === "true" ? true : process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies()
  c.delete(SESSION_COOKIE)
}

export function checkCredentials(email: string, password: string): { ok: boolean; error?: string } {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return { ok: false, error: "Admin password is not configured. Set ADMIN_PASSWORD env variable." }
  }
  if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
    return { ok: false, error: "Invalid email or password" }
  }
  if (password !== adminPassword) {
    return { ok: false, error: "Invalid email or password" }
  }
  return { ok: true }
}

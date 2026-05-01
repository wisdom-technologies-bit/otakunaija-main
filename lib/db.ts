import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

let _sql: NeonQueryFunction<false, false> | null = null

function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is not set. Add it in Project Settings → Environment Variables.",
    )
  }
  _sql = neon(url)
  return _sql
}

// Proxy that defers initialization until the tagged template is actually called.
// Allows top-level `import { sql } from "@/lib/db"` without crashing at module load.
export const sql = new Proxy(function () {} as unknown as NeonQueryFunction<false, false>, {
  apply(_target, _thisArg, args: [TemplateStringsArray, ...unknown[]]) {
    const fn = getSql() as unknown as (...a: unknown[]) => unknown
    return fn(...args)
  },
}) as NeonQueryFunction<false, false>

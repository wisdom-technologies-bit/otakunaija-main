import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()

/** Recursively collect .tsx/.ts files under a directory. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full)
  }
  return out
}

describe("global listing stylesheet", () => {
  it("is imported exactly once, from app/layout.tsx", () => {
    const layout = readFileSync(join(root, "app/layout.tsx"), "utf8")
    expect(layout).toMatch(/import\s+["']\.\/listings\.css["']/)
  })

  it("is not imported by individual pages any more", () => {
    const offenders = walk(join(root, "app"))
      .filter((file) => !file.endsWith("app/layout.tsx"))
      .filter((file) => /listings\.css/.test(readFileSync(file, "utf8")))
    expect(offenders).toEqual([])
  })

  it("scopes tokens to :root instead of a page wrapper", () => {
    const css = readFileSync(join(root, "app/listings.css"), "utf8")
    expect(css).toMatch(/:root\s*\{[^}]*--otk-bg/)
    // no rule may still require an .otk-page ancestor
    expect(css).not.toMatch(/\.otk-page\s+\.otk-/)
    // the home page keeps its own palette
    expect(css).toMatch(/\.home-premium[\s\S]{0,400}--otk-accent:\s*var\(--hp-accent\)/)
  })
})

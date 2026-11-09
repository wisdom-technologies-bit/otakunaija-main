/**
 * Renders the six newsletter layouts with the seeded fixture data to static
 * files, so the emails can be inspected (and screenshotted) without a database
 * or a Brevo account.
 *
 *   npx tsx scripts/newsletter-previews.tsx
 *
 * Writes .previews/newsletter/<layout>.html and .txt, and prints sizes.
 */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { allLayoutContexts } from "../lib/newsletter/fixtures"
import { renderIssue } from "../lib/newsletter/render"
import type { LayoutId } from "../lib/newsletter/layout"

const OUT = path.join(process.cwd(), ".previews", "newsletter")

async function main() {
  await mkdir(OUT, { recursive: true })

  const rows: { layout: LayoutId; file: string; htmlKb: number; textKb: number; bytes: number; images: number }[] = []

  for (const { layout, ctx } of allLayoutContexts()) {
    const rendered = await renderIssue({ ...ctx, layout, token: "previewtoken0000000000000000a1b2" })
    const file = path.join(OUT, `${layout}.html`)
    await writeFile(file, rendered.html, "utf8")
    await writeFile(path.join(OUT, `${layout}.txt`), rendered.text, "utf8")

    const images = (rendered.html.match(/<img\b/gi) ?? []).length
    rows.push({
      layout,
      file,
      htmlKb: Math.round((rendered.bytes / 1024) * 10) / 10,
      textKb: Math.round((Buffer.byteLength(rendered.text, "utf8") / 1024) * 10) / 10,
      bytes: rendered.bytes,
      images,
    })
  }

  const width = Math.max(...rows.map((row) => row.layout.length))
  for (const row of rows) {
    console.log(
      `${row.layout.padEnd(width)}  html ${String(row.htmlKb).padStart(6)} KB (${row.bytes} bytes)  text ${String(
        row.textKb,
      ).padStart(5)} KB  ${row.images} images`,
    )
  }
  console.log(`\nWrote ${rows.length * 2} files to ${path.relative(process.cwd(), OUT)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

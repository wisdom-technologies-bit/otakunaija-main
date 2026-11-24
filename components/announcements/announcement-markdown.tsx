"use client"

import ReactMarkdown, { defaultUrlTransform } from "react-markdown"
import remarkGfm from "remark-gfm"

/**
 * Markdown for announcements. Deliberately NO rehype-raw: raw HTML is not
 * rendered, so a pasted <script> or <iframe> shows as inert text. Links and
 * images go through react-markdown's URL sanitising (blocks javascript: etc.).
 *
 * Supported: headings, bold/italic/strike, lists, task lists, tables, quotes,
 * code, horizontal rules, links, images.
 */
export function AnnouncementMarkdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none break-words prose-headings:font-display prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-a:text-primary prose-img:rounded-lg prose-img:my-3 prose-hr:my-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={defaultUrlTransform}
        components={{
          a: ({ href, children: c }) => {
            const external = !!href && /^https?:\/\//i.test(href)
            return (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
              >
                {c}
              </a>
            )
          },
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={typeof src === "string" ? src : undefined}
              alt={alt ?? ""}
              loading="lazy"
              decoding="async"
              className="h-auto max-w-full"
            />
          ),
          table: ({ children: c }) => (
            <div className="my-3 overflow-x-auto">
              <table>{c}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

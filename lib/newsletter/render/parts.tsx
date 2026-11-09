/**
 * Shared email furniture: shell, header band, footer, buttons, dividers and the
 * post/episode blocks every layout reuses.
 *
 * Rules kept here so no layout can break them:
 *   - 600px fixed width container (Outlook ignores max-width on tables).
 *   - Every image has explicit width/height, `display:block` and an alt.
 *   - Every button carries a VML roundrect for Outlook.
 *   - Every link is absolute.
 */

import type { ReactNode } from "react"
import { Body, Container, Head, Html, Img, Link, Preview, Section, Text } from "@react-email/components"
import type { EpisodeItem, PostItem, SeriesGroup, TrendingItem, UpcomingItem } from "../types"
import { newsletterLinks, type RenderBrand, type RenderContext } from "./context"
import { BRAND, COLORS, DARK_MODE_CSS, FONTS, IMG, SIZE, TEXT } from "./theme"

// ---------------------------------------------------------------------------
// Raw HTML escape hatch (conditional comments cannot go through JSX)
// ---------------------------------------------------------------------------

export function RawHtml({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export type ButtonTone = "solid" | "outline" | "arrow"

export type ButtonProps = {
  href: string
  label: string
  tone?: ButtonTone
  align?: "left" | "center"
  /** Fixed width for Outlook's VML; roughly label length * 9 + 44. */
  width?: number
}

/**
 * Bulletproof button: an anchor padded cell for everyone, and a VML roundrect
 * inside an MSO conditional comment so Outlook shows a real filled button
 * instead of a bare text link.
 */
export function bulletproofButton({
  href,
  label,
  tone = "solid",
  align = "left",
  width,
}: ButtonProps): string {
  const safeHref = escapeHtml(href)
  const safeLabel = escapeHtml(label)
  const boxWidth = width ?? Math.max(150, Math.round(label.length * 8.6) + 48)
  const height = 44

  const solid = tone === "solid"
  const background = solid ? COLORS.accent : tone === "arrow" ? COLORS.ink : COLORS.surface
  const color = solid ? COLORS.onAccent : tone === "arrow" ? COLORS.onAccent : COLORS.ink
  const border = solid ? COLORS.accent : tone === "arrow" ? COLORS.ink : COLORS.ink
  const arrow = tone === "arrow" ? " &rarr;" : ""

  return `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;" align="${align}">
  <tr>
    <td align="center" bgcolor="${background}" style="border-radius:6px;background-color:${background};border:1px solid ${border};">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:${height}px;v-text-anchor:middle;width:${boxWidth}px;" arcsize="14%" strokecolor="${border}" fillcolor="${background}">
        <w:anchorlock/>
        <center style="color:${color};font-family:${FONTS.body};font-size:15px;font-weight:700;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <a href="${safeHref}" style="display:inline-block;padding:0 22px;line-height:${height - 2}px;color:${color};font-family:${FONTS.body};font-size:15px;font-weight:700;text-decoration:none;border-radius:6px;mso-hide:all;">${safeLabel}${arrow}</a>
    </td>
  </tr>
</table>`.trim()
}

export function Button(props: ButtonProps) {
  return <RawHtml html={bulletproofButton(props)} />
}

// ---------------------------------------------------------------------------
// Divider variants
// ---------------------------------------------------------------------------

export type DividerKind = "hairline" | "dots" | "accent-rule"

export function Divider({ kind = "hairline", inset = 0 }: { kind?: DividerKind; inset?: number }) {
  if (kind === "dots") {
    return (
      <Section style={{ padding: `20px ${inset}px 18px`, textAlign: "center" }}>
        <Text
          className="nl-muted"
          style={{
            margin: 0,
            fontFamily: FONTS.body,
            fontSize: 14,
            letterSpacing: 6,
            color: COLORS.rule,
            lineHeight: "10px",
          }}
        >
          • • •
        </Text>
      </Section>
    )
  }

  if (kind === "accent-rule") {
    return (
      <Section style={{ padding: `18px ${inset}px` }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
          <tbody>
            <tr>
              <td width="56" height="3" style={{ height: 3, backgroundColor: COLORS.accent, fontSize: 0, lineHeight: "3px" }} />
              <td height="3" style={{ height: 3, backgroundColor: COLORS.rule, fontSize: 0, lineHeight: "3px" }} className="nl-rule" />
            </tr>
          </tbody>
        </table>
      </Section>
    )
  }

  return (
    <Section style={{ padding: `18px ${inset}px` }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td height="1" style={{ height: 1, backgroundColor: COLORS.rule, fontSize: 0, lineHeight: "1px" }} className="nl-rule" />
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

export function Kicker({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "muted" }) {
  return (
    <Text
      style={{
        margin: 0,
        fontFamily: FONTS.body,
        fontSize: TEXT.micro,
        lineHeight: "14px",
        fontWeight: 700,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: tone === "accent" ? COLORS.accentInk : COLORS.muted,
      }}
    >
      {children}
    </Text>
  )
}

export function Headline({
  children,
  size = TEXT.h2,
  href,
  accent = "left",
}: {
  children: ReactNode
  size?: number
  href?: string
  accent?: "left" | "top" | "underline"
}) {
  const base = {
    margin: 0,
    fontFamily: FONTS.heading,
    fontSize: size,
    lineHeight: `${Math.round(size * 1.22)}px`,
    fontWeight: 700,
    color: COLORS.ink,
  } as const

  const style =
    accent === "underline"
      ? { ...base, borderBottom: `2px solid ${COLORS.accentSoft}`, paddingBottom: 4 }
      : accent === "top"
        ? { ...base, borderTop: `3px solid ${COLORS.accent}`, paddingTop: 8 }
        : base

  if (href) {
    return (
      <Link href={href} className="nl-ink" style={{ ...style, textDecoration: "none", display: "block" }}>
        {children}
      </Link>
    )
  }
  return (
    <Text className="nl-ink" style={style}>
      {children}
    </Text>
  )
}

export function Paragraph({
  children,
  size = TEXT.body,
  tone = "body",
  margin = 0,
}: {
  children: ReactNode
  size?: number
  tone?: "body" | "muted" | "ink"
  margin?: number
}) {
  const color = tone === "muted" ? COLORS.muted : tone === "ink" ? COLORS.ink : COLORS.body
  return (
    <Text
      className={tone === "muted" ? "nl-muted" : "nl-body"}
      style={{
        margin: margin ? `${margin}px 0 0` : 0,
        fontFamily: FONTS.body,
        fontSize: size,
        lineHeight: `${Math.round(size * 1.55)}px`,
        color,
      }}
    >
      {children}
    </Text>
  )
}

export function FineLink({ href, children, strong }: { href: string; children: ReactNode; strong?: boolean }) {
  return (
    <Link
      href={href}
      className="nl-muted"
      style={{
        color: strong ? COLORS.ink : COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT.small,
        fontWeight: strong ? 600 : 400,
        textDecoration: "underline",
      }}
    >
      {children}
    </Link>
  )
}

export function TextLink({ href, children, color }: { href: string; children: ReactNode; color?: string }) {
  return (
    <Link
      href={href}
      className="nl-ink"
      style={{
        color: color ?? COLORS.ink,
        fontFamily: FONTS.body,
        fontSize: TEXT.small,
        fontWeight: 700,
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export function CoverImage({
  src,
  alt,
  width,
  height,
  radius = 4,
}: {
  src: string
  alt: string
  width: number
  height: number
  radius?: number
}) {
  return (
    <Img
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={{
        display: "block",
        width: `${width}px`,
        height: `${height}px`,
        maxWidth: "100%",
        borderRadius: radius,
        border: 0,
        outline: "none",
        textDecoration: "none",
        objectFit: "cover",
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export function PostCard({
  post,
  imageWidth,
  imageHeight,
  showDek,
  accent,
  readLabel = "Read",
}: {
  post: PostItem
  imageWidth: number
  imageHeight: number
  showDek?: boolean
  accent?: "left" | "top" | "underline"
  readLabel?: string
}) {
  return (
    <Section style={{ padding: 0 }}>
      {post.imageUrl ? (
        <Link href={post.url} style={{ textDecoration: "none" }}>
          <CoverImage src={post.imageUrl} alt={post.title} width={imageWidth} height={imageHeight} />
        </Link>
      ) : null}
      <div style={{ height: 12 }} />
      <Kicker tone="accent">{post.category}</Kicker>
      <div style={{ height: 6 }} />
      <Headline size={TEXT.h3 + 2} href={post.url} accent={accent}>
        {post.title}
      </Headline>
      {showDek && post.excerpt ? (
        <>
          <div style={{ height: 6 }} />
          <Paragraph size={14} tone="muted">
            {post.excerpt}
          </Paragraph>
        </>
      ) : null}
      {post.whyItMatters ? (
        <>
          <div style={{ height: 6 }} />
          <Paragraph size={13} tone="body">
            {post.whyItMatters}
          </Paragraph>
        </>
      ) : null}
      <div style={{ height: 8 }} />
      <TextLink href={post.url} color={COLORS.accentInk}>
        {readLabel} →
      </TextLink>
    </Section>
  )
}

export function PostRow({
  post,
  thumbWidth = IMG.thumb,
  thumbHeight = IMG.thumbHeight,
  showDek,
  rank,
}: {
  post: PostItem
  thumbWidth?: number
  thumbHeight?: number
  showDek?: boolean
  rank?: number
}) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          {post.imageUrl ? (
            <td width={thumbWidth} valign="top" style={{ width: thumbWidth, paddingRight: 14 }}>
              <Link href={post.url} style={{ textDecoration: "none" }}>
                <CoverImage src={post.imageUrl} alt={post.title} width={thumbWidth} height={thumbHeight} />
              </Link>
            </td>
          ) : null}
          <td valign="top">
            {rank ? (
              <Text
                style={{
                  margin: "0 0 4px",
                  fontFamily: FONTS.heading,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  color: COLORS.accentInk,
                }}
              >
                {String(rank).padStart(2, "0")}
              </Text>
            ) : null}
            <Headline size={TEXT.h3} href={post.url}>
              {post.title}
            </Headline>
            {showDek && (post.whyItMatters || post.excerpt) ? (
              <>
                <div style={{ height: 4 }} />
                <Paragraph size={13} tone="muted">
                  {post.whyItMatters ?? post.excerpt}
                </Paragraph>
              </>
            ) : null}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function EpisodeChips({ episodes }: { episodes: EpisodeItem[] }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "separate" }}>
      <tbody>
        <tr>
          {episodes.slice(0, 4).map((episode) => (
            <td key={episode.id} style={{ paddingRight: 6 }}>
              <Link
                href={episode.url}
                style={{
                  display: "block",
                  padding: "3px 9px",
                  borderRadius: 999,
                  backgroundColor: COLORS.accentSoft,
                  color: COLORS.accentInk,
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
                className="nl-accent-soft"
              >
                EP {episode.number ?? "?"}
              </Link>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}

export function PosterCard({
  group,
  width = IMG.poster,
  buttonStyle = "solid",
  showWatch = true,
}: {
  group: SeriesGroup
  width?: number
  buttonStyle?: ButtonTone
  showWatch?: boolean
}) {
  return (
    <Section style={{ padding: 0 }}>
      {group.posterUrl ? (
        <Link href={group.url} style={{ textDecoration: "none" }}>
          <CoverImage src={group.posterUrl} alt={group.title} width={width} height={IMG.posterHeight} radius={6} />
        </Link>
      ) : null}
      <div style={{ height: 10 }} />
      <Headline size={15} href={group.url}>
        {group.title}
      </Headline>
      <div style={{ height: 8 }} />
      <EpisodeChips episodes={group.episodes} />
      {showWatch ? (
        <>
          <div style={{ height: 10 }} />
          <Button
            href={group.episodes[0]?.url ?? group.url}
            label="Watch"
            tone={buttonStyle}
            width={96}
          />
        </>
      ) : null}
    </Section>
  )
}

export function TrendingList({ items }: { items: TrendingItem[] }) {
  if (!items.length) return null
  return (
    <Section style={{ padding: 0 }}>
      <Kicker tone="muted">Trending on the site</Kicker>
      <div style={{ height: 10 }} />
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          {items.map((item) => (
            <tr key={item.slug}>
              <td width="14" valign="top" style={{ paddingTop: 3 }}>
                <Text style={{ margin: 0, color: COLORS.accent, fontSize: 14, lineHeight: "14px" }}>●</Text>
              </td>
              <td valign="top" style={{ paddingBottom: 8 }}>
                <TextLink href={item.url}>{item.title}</TextLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

export function UpcomingGrid({ items }: { items: UpcomingItem[] }) {
  if (!items.length) return null
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          {items.map((item) => (
            <td key={item.anilistId} valign="top" width="33%" className="nl-stack" style={{ width: "33%", paddingRight: 12 }}>
              {item.coverUrl ? (
                <Link href={item.url} style={{ textDecoration: "none" }}>
                  <CoverImage src={item.coverUrl} alt={item.title} width={158} height={202} radius={6} />
                </Link>
              ) : null}
              <div style={{ height: 8 }} />
              <Headline size={14} href={item.url}>
                {item.title}
              </Headline>
              <Paragraph size={12} tone="muted" margin={4}>
                {item.format} · {item.startLabel}
              </Paragraph>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function HeaderBand({ brand }: { brand: RenderBrand }) {
  return (
    <Section
      className="nl-band"
      style={{ backgroundColor: COLORS.band, padding: "22px 0" }}
    >
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            {brand.logoUrl ? (
              <td width={IMG.logo + 12} valign="middle" style={{ width: IMG.logo + 12, paddingRight: 12 }}>
                <CoverImage src={brand.logoUrl} alt={`${brand.fromName} logo`} width={IMG.logo} height={IMG.logo} radius={8} />
              </td>
            ) : null}
            <td valign="middle">
              <Text
                style={{
                  margin: 0,
                  fontFamily: FONTS.heading,
                  fontSize: 20,
                  lineHeight: "24px",
                  fontWeight: 700,
                  letterSpacing: -0.2,
                  color: "#FFFFFF",
                }}
              >
                Otaku
                <span style={{ color: COLORS.accent }}>Naija</span>
              </Text>
              <Text
                style={{
                  margin: "4px 0 0",
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  lineHeight: "14px",
                  letterSpacing: 1.6,
                  textTransform: "uppercase",
                  color: "#8E8B9A",
                }}
              >
                Daily briefing
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

export function Footer({ ctx }: { ctx: RenderContext }) {
  const links = newsletterLinks(ctx.brand, ctx.token)
  return (
    <Section className="nl-card" style={{ backgroundColor: COLORS.surface, padding: `${SIZE.pad}px 0 30px` }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td height="1" style={{ height: 1, backgroundColor: COLORS.rule, fontSize: 0, lineHeight: "1px" }} className="nl-rule" />
          </tr>
        </tbody>
      </table>
      <div style={{ height: 18 }} />
      <Paragraph size={12} tone="muted">
        You are receiving this because you subscribed on otakunaija.name.ng.
      </Paragraph>
      <div style={{ height: 10 }} />
      <Paragraph size={12} tone="muted">
        <FineLink href={links.unsubscribeOneClick}>Unsubscribe</FineLink>
        {"  ·  "}
        <FineLink href={links.preferences}>Email preferences</FineLink>
        {"  ·  "}
        <FineLink href={links.privacy}>Privacy</FineLink>
      </Paragraph>
      <div style={{ height: 14 }} />
      <Paragraph size={11} tone="muted">
        {ctx.brand.postalAddress}
      </Paragraph>
      <div style={{ height: 14 }} />
      <Paragraph size={11} tone="muted">
        <FineLink href={links.home}>Home</FineLink>
        {"  ·  "}
        <FineLink href={links.blog}>Blog</FineLink>
        {"  ·  "}
        <FineLink href={links.episodes}>Episodes</FineLink>
        {"  ·  "}
        <FineLink href={links.upcoming}>Upcoming</FineLink>
      </Paragraph>
    </Section>
  )
}

export function EmailShell({
  ctx,
  preview,
  children,
  footerTone = "surface",
}: {
  ctx: RenderContext
  preview: string
  children: ReactNode
  footerTone?: "surface" | "paper"
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <meta name="x-apple-disable-message-reformatting" />
        <style dangerouslySetInnerHTML={{ __html: DARK_MODE_CSS }} />
      </Head>
      <Preview>{preview}</Preview>
      <Body className="nl-page" style={{ margin: 0, padding: 0, backgroundColor: COLORS.paper }}>
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          style={{ backgroundColor: COLORS.paper, width: "100%" }}
          className="nl-page"
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "0 0 24px" }}>
                <Container
                  className="nl-container nl-surface"
                  style={{
                    width: `${SIZE.width}px`,
                    maxWidth: `${SIZE.width}px`,
                    margin: "0 auto",
                    backgroundColor: COLORS.surface,
                  }}
                >
                  {children}
                  <div style={{ padding: `0 ${SIZE.pad}px` }}>
                    <Footer ctx={ctx} />
                  </div>
                </Container>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  )
}

/** Section wrapper with the container padding every layout uses. */
export function Block({
  children,
  padding = `0 ${SIZE.pad}px`,
  tone = "surface",
}: {
  children: ReactNode
  padding?: string
  tone?: "surface" | "card" | "paper"
}) {
  const background = tone === "card" ? COLORS.surface : tone === "paper" ? COLORS.paper : undefined
  return (
    <Section
      className={tone === "card" ? "nl-card" : "nl-surface"}
      style={{ padding, backgroundColor: background }}
    >
      {children}
    </Section>
  )
}

/** Small standfirst under the header band: date plus issue label. */
export function DateLine({ ctx }: { ctx: RenderContext }) {
  return (
    <Block padding={`18px ${SIZE.pad}px 0`}>
      <Text
        style={{
          margin: 0,
          fontFamily: FONTS.body,
          fontSize: TEXT.micro,
          lineHeight: "14px",
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: COLORS.muted,
        }}
        className="nl-muted"
      >
        {ctx.dateLabel}
      </Text>
    </Block>
  )
}


/** The editor's note. Accent placement follows the issue variation. */
export function EditorsNote({
  text,
  dateLabel,
  accent = "left",
}: {
  text: string
  dateLabel?: string
  accent?: "left" | "top" | "underline"
}) {
  const base = {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: "23px",
    color: COLORS.body,
    margin: 0,
  } as const

  const style =
    accent === "top"
      ? { ...base, borderTop: `3px solid ${COLORS.accent}`, paddingTop: 12 }
      : accent === "underline"
        ? { ...base, borderBottom: `1px solid ${COLORS.rule}`, paddingBottom: 12 }
        : { ...base, borderLeft: `3px solid ${COLORS.accent}`, paddingLeft: 14 }

  return (
    <Section style={{ padding: 0 }}>
      {dateLabel ? <Kicker tone="muted">{dateLabel}</Kicker> : null}
      {dateLabel ? <div style={{ height: 8 }} /> : null}
      <Text className="nl-body" style={style}>
        {text}
      </Text>
    </Section>
  )
}

/** A labelled module heading: small kicker, then a rule. */
export function ModuleTitle({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <Section style={{ padding: 0 }}>
      {kicker ? <Kicker>{kicker}</Kicker> : null}
      {kicker ? <div style={{ height: 8 }} /> : null}
      <Text
        className="nl-ink"
        style={{
          margin: 0,
          fontFamily: FONTS.heading,
          fontSize: TEXT.h2,
          lineHeight: `${Math.round(TEXT.h2 * 1.2)}px`,
          fontWeight: 700,
          color: COLORS.ink,
        }}
      >
        {children}
      </Text>
    </Section>
  )
}

export { BRAND }

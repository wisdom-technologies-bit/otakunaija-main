/**
 * Layout 6 — quiet-day.
 *
 * Text-led and short: three or four items on a narrow measure, one small
 * thumbnail each, no hero, one button. A slow news day should look deliberate
 * rather than thin, so this layout leans on typography and whitespace.
 */

import { Section, Text } from "@react-email/components"
import type { PostItem } from "../types"
import type { RenderContext } from "./context"
import {
  Block,
  Button,
  CoverImage,
  DateLine,
  Divider,
  EditorsNote,
  EmailShell,
  FineLink,
  Headline,
  Kicker,
  Paragraph,
} from "./parts"
import { COLORS, FONTS, SIZE } from "./theme"

type QuietItem = {
  key: string
  title: string
  url: string
  note: string | null
  imageUrl: string | null
  label: string
}

function toItems(ctx: RenderContext): QuietItem[] {
  const items: QuietItem[] = []
  const { content } = ctx

  if (content.topStory) {
    items.push({
      key: `post-${content.topStory.id}`,
      title: content.topStory.title,
      url: content.topStory.url,
      note: content.topStory.whyItMatters ?? content.topStory.excerpt ?? null,
      imageUrl: content.topStory.imageUrl,
      label: content.topStory.category,
    })
  }

  for (const post of content.posts) {
    if (items.length >= 4) break
    items.push({
      key: `post-${post.id}`,
      title: post.title,
      url: post.url,
      note: post.whyItMatters ?? post.excerpt ?? null,
      imageUrl: post.imageUrl,
      label: post.category,
    })
  }

  for (const group of content.seriesGroups) {
    if (items.length >= 4) break
    items.push({
      key: `series-${group.seriesId}`,
      title: `${group.title} — episode ${group.episodes.map((episode) => episode.number ?? "?").join(", ")}`,
      url: group.episodes[0]?.url ?? group.url,
      note: "New episode is up on the site.",
      imageUrl: group.posterUrl,
      label: "Episode",
    })
  }

  return items.slice(0, 4)
}

function QuietRow({ item, accent }: { item: QuietItem; accent: "left" | "top" | "underline" }) {
  const border =
    accent === "top"
      ? { borderTop: `2px solid ${COLORS.accent}`, paddingTop: 12 }
      : accent === "underline"
        ? { borderBottom: `1px solid ${COLORS.rule}`, paddingBottom: 14 }
        : { borderLeft: `2px solid ${COLORS.accent}`, paddingLeft: 14 }

  return (
    <Section style={{ padding: 0 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td valign="top" style={border}>
              <Kicker tone="muted">{item.label}</Kicker>
              <div style={{ height: 5 }} />
              <Headline size={18} href={item.url}>
                {item.title}
              </Headline>
              {item.note ? (
                <>
                  <div style={{ height: 5 }} />
                  <Paragraph size={14} tone="muted">
                    {item.note}
                  </Paragraph>
                </>
              ) : null}
            </td>
            {item.imageUrl ? (
              <td width="86" valign="top" style={{ width: 86, paddingLeft: 16 }}>
                <a href={item.url} style={{ textDecoration: "none" }}>
                  <CoverImage src={item.imageUrl} alt={item.title} width={86} height={86} radius={4} />
                </a>
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

export function QuietDayEmail(ctx: RenderContext) {
  const { copy, variant, brand } = ctx
  const items = toItems(ctx)

  return (
    <EmailShell ctx={ctx} preview={copy.preheader}>
      <DateLine ctx={ctx} />

      <Section style={{ padding: `20px ${SIZE.pad}px 0` }}>
        <Text
          className="nl-ink"
          style={{
            margin: 0,
            fontFamily: FONTS.heading,
            fontSize: 25,
            lineHeight: "31px",
            fontWeight: 700,
            color: COLORS.ink,
          }}
        >
          A short one today
        </Text>
      </Section>

      <Block padding={`12px ${SIZE.pad}px 0`}>
        <EditorsNote text={copy.editorsNote} accent={variant.accent} />
      </Block>

      <Divider kind={variant.divider} inset={SIZE.pad} />

      <Block padding={`0 ${SIZE.pad}px`}>
        {items.map((item, index) => (
          <div key={item.key} style={{ paddingBottom: index === items.length - 1 ? 0 : 20 }}>
            <QuietRow item={item} accent={variant.accent} />
          </div>
        ))}
        {items.length === 0 ? (
          <Paragraph size={15} tone="muted">
            Nothing new landed since the last email. The full archive is always open.
          </Paragraph>
        ) : null}
      </Block>

      <Block padding={`26px ${SIZE.pad}px 8px`}>
        <Button href={`${brand.siteUrl}/blog`} label="Open the site" tone={variant.button} />
      </Block>

      <Block padding={`0 ${SIZE.pad}px 30px`}>
        <Paragraph size={12} tone="muted">
          More tomorrow morning.{" "}
          <FineLink href={`${brand.siteUrl}/newsletter/preferences?token=${ctx.token}`}>Change what you get</FineLink>
        </Paragraph>
      </Block>
    </EmailShell>
  )
}

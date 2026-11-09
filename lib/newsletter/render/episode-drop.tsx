/**
 * Layout 2 — episode-drop.
 *
 * A poster wall: three titles per row, grouped by series, each with its episode
 * chips and a Watch button. News follows underneath, deliberately quieter, so
 * the wall reads as the point of the email.
 */

import { Section, Text } from "@react-email/components"
import type { SeriesGroup } from "../types"
import type { RenderContext } from "./context"
import {
  Block,
  Button,
  CoverImage,
  DateLine,
  Divider,
  EditorsNote,
  EmailShell,
  EpisodeChips,
  Headline,
  Kicker,
  ModuleTitle,
  Paragraph,
  PostRow,
  TrendingList,
} from "./parts"
import { COLORS, FONTS, IMG, SIZE, TEXT } from "./theme"

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size))
  }
  return rows
}

function PosterTile({ group }: { group: SeriesGroup }) {
  return (
    <Section style={{ padding: 0 }}>
      {group.posterUrl ? (
        <a href={group.url} style={{ textDecoration: "none" }}>
          <CoverImage src={group.posterUrl} alt={group.title} width={IMG.poster} height={IMG.posterHeight} radius={8} />
        </a>
      ) : null}
      <div style={{ height: 10 }} />
      <Headline size={14} href={group.url}>
        {group.title}
      </Headline>
      <div style={{ height: 8 }} />
      <EpisodeChips episodes={group.episodes} />
    </Section>
  )
}

export function EpisodeDropEmail(ctx: RenderContext) {
  const { content, copy, variant, brand } = ctx
  const wall = chunk(content.seriesGroups.slice(0, 9), 3)
  const episodesTotal = content.counts.episodes
  const seriesTotal = content.counts.series

  return (
    <EmailShell ctx={ctx} preview={copy.preheader}>
      <DateLine ctx={ctx} />

      <Block padding={`16px ${SIZE.pad}px 0`}>
        <EditorsNote text={copy.editorsNote} accent={variant.accent} />
      </Block>

      <Block padding={`26px ${SIZE.pad}px 0`}>
        <Kicker>{`${episodesTotal} new episode${episodesTotal === 1 ? "" : "s"} · ${seriesTotal} series`}</Kicker>
        <div style={{ height: 8 }} />
        <Text
          className="nl-ink"
          style={{
            margin: 0,
            fontFamily: FONTS.heading,
            fontSize: 28,
            lineHeight: "34px",
            fontWeight: 700,
            color: COLORS.ink,
          }}
        >
          Out now
        </Text>
        <div style={{ height: 18 }} />
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
          <tbody>
            {wall.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((group) => (
                  <td
                    key={group.seriesId}
                    width="33%"
                    valign="top"
                    className="nl-stack"
                    style={{ width: "33%", paddingRight: 16, paddingBottom: rowIndex === wall.length - 1 ? 0 : 24 }}
                  >
                    <PosterTile group={group} />
                    <div style={{ height: 8 }} />
                    <Button
                      href={group.episodes[0]?.url ?? group.url}
                      label="Watch"
                      tone={variant.button}
                      width={104}
                    />
                  </td>
                ))}
                {row.length < 3 ? <td width="33%" style={{ width: "33%" }} /> : null}
                {row.length < 2 ? <td width="33%" style={{ width: "33%" }} /> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      <Divider kind={variant.divider} inset={SIZE.pad} />

      {content.topStory ? (
        <Block padding={`0 ${SIZE.pad}px`}>
          <ModuleTitle kicker="Meanwhile">The news</ModuleTitle>
          <div style={{ height: 14 }} />
          <Headline size={TEXT.h2} href={content.topStory.url} accent={variant.accent}>
            {content.topStory.title}
          </Headline>
          {content.topStory.excerpt ? (
            <>
              <div style={{ height: 8 }} />
              <Paragraph size={15} tone="muted">
                {content.topStory.excerpt}
              </Paragraph>
            </>
          ) : null}
          <div style={{ height: 14 }} />
          <Button href={content.topStory.url} label="Read it" tone="arrow" />
        </Block>
      ) : null}

      {content.posts.length ? (
        <Block padding={`22px ${SIZE.pad}px 0`}>
          {content.posts.slice(0, 3).map((post, index) => (
            <div key={post.id} style={{ paddingBottom: index === Math.min(content.posts.length, 3) - 1 ? 0 : 16 }}>
              <PostRow post={post} thumbWidth={88} thumbHeight={58} />
            </div>
          ))}
        </Block>
      ) : null}

      {content.trending.length ? (
        <Block padding={`24px ${SIZE.pad}px 0`}>
          <TrendingList items={content.trending} />
        </Block>
      ) : null}

      {content.airing.length ? (
        <Block padding={`24px ${SIZE.pad}px 0`}>
          <ModuleTitle kicker="Later">Airing next</ModuleTitle>
          <div style={{ height: 12 }} />
          {content.airing.slice(0, 3).map((item) => (
            <Text
              key={`${item.anilistId}-${item.episode}`}
              style={{ margin: "0 0 6px", fontFamily: FONTS.body, fontSize: 14, lineHeight: "20px", color: COLORS.body }}
            >
              <span style={{ color: COLORS.ink, fontWeight: 600 }}>{item.title}</span> ep {item.episode} ·{" "}
              {item.dayLabel} {item.watTime}
            </Text>
          ))}
        </Block>
      ) : null}

      <Block padding={`26px ${SIZE.pad}px 30px`}>
        <Button href={`${brand.siteUrl}/episodes`} label="All new episodes" tone="outline" />
      </Block>
    </EmailShell>
  )
}

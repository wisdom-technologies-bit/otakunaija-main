/**
 * Layout 5 — roundup (Sundays).
 *
 * A ranked list of the week's five most-read stories, numbered, with thumbnails
 * and hairline separators; then next week's premieres. Sunday is for catching
 * up, so this layout reads like a magazine contents page, not a feed.
 */

import { Section, Text } from "@react-email/components"
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
  ModuleTitle,
  Paragraph,
  PostRow,
  UpcomingGrid,
} from "./parts"
import { COLORS, FONTS, SIZE } from "./theme"

export function RoundupEmail(ctx: RenderContext) {
  const { content, copy, variant, brand } = ctx
  const review = content.weekInReview.length ? content.weekInReview : content.posts.slice(0, 5)
  const lead = review[0] ?? content.topStory
  const rest = review.slice(1)

  return (
    <EmailShell ctx={ctx} preview={copy.preheader}>
      <DateLine ctx={ctx} />

      <Block padding={`16px ${SIZE.pad}px 0`}>
        <EditorsNote text={copy.editorsNote} accent={variant.accent} />
      </Block>

      <Block padding={`26px ${SIZE.pad}px 0`}>
        <Kicker>Week in review</Kicker>
        <div style={{ height: 8 }} />
        <Text
          className="nl-ink"
          style={{
            margin: 0,
            fontFamily: FONTS.heading,
            fontSize: 29,
            lineHeight: "34px",
            fontWeight: 700,
            color: COLORS.ink,
          }}
        >
          What everyone read this week
        </Text>
        <div style={{ height: 6 }} />
        <Paragraph size={14} tone="muted">
          Ranked by reads on otakunaija.name.ng over the last seven days.
        </Paragraph>
      </Block>

      {lead ? (
        <Section style={{ padding: "18px 0 0" }}>
          {lead.imageUrl ? (
            <a href={lead.url} style={{ textDecoration: "none" }}>
              <CoverImage
                src={lead.imageUrl}
                alt={lead.title}
                width={600}
                height={variant.crop === "square" ? 600 : variant.crop === "tall" ? 360 : 300}
                radius={0}
              />
            </a>
          ) : null}
          <div style={{ padding: `16px ${SIZE.pad}px 0` }}>
            <Text
              style={{
                margin: "0 0 8px",
                fontFamily: FONTS.heading,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1.6,
                color: COLORS.accentInk,
              }}
            >
              No. 1
            </Text>
            <Headline size={26} href={lead.url} accent={variant.accent}>
              {lead.title}
            </Headline>
            {lead.excerpt ? (
              <>
                <div style={{ height: 10 }} />
                <Paragraph size={15} tone="muted">
                  {lead.excerpt}
                </Paragraph>
              </>
            ) : null}
            <div style={{ height: 16 }} />
            <Button href={lead.url} label="Read the top story" tone={variant.button} />
          </div>
        </Section>
      ) : null}

      {rest.length ? (
        <Block padding={`26px ${SIZE.pad}px 0`}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
            <tbody>
              {rest.map((post, index) => (
                <tr key={post.id}>
                  <td
                    valign="top"
                    style={{
                      padding: "16px 0",
                      borderTop: `1px solid ${COLORS.rule}`,
                    }}
                    className="nl-rule"
                  >
                    <PostRow post={post} rank={index + 2} thumbWidth={104} thumbHeight={68} showDek />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      ) : null}

      <Divider kind={variant.divider} inset={SIZE.pad} />

      {content.upcoming.length ? (
        <Block padding={`0 ${SIZE.pad}px`}>
          <ModuleTitle kicker="Next week">Premieres to mark</ModuleTitle>
          <div style={{ height: 14 }} />
          <UpcomingGrid items={content.upcoming} />
        </Block>
      ) : null}

      {content.seriesGroups.length ? (
        <Block padding={`24px ${SIZE.pad}px 0`}>
          <ModuleTitle kicker="Catch up">Episodes you may have missed</ModuleTitle>
          <div style={{ height: 12 }} />
          {content.seriesGroups.slice(0, 4).map((group) => (
            <Text
              key={group.seriesId}
              style={{ margin: "0 0 7px", fontFamily: FONTS.body, fontSize: 14, lineHeight: "20px", color: COLORS.body }}
            >
              <FineLink href={group.url} strong>
                {group.title}
              </FineLink>
              <span style={{ color: COLORS.muted }}>
                {" "}
                · ep {group.episodes.map((episode) => episode.number ?? "?").join(", ")}
              </span>
            </Text>
          ))}
        </Block>
      ) : null}

      <Block padding={`26px ${SIZE.pad}px 30px`}>
        <Button href={`${brand.siteUrl}/blog`} label="Read everything from the week" tone="outline" />
      </Block>
    </EmailShell>
  )
}

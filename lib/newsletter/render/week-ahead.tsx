/**
 * Layout 3 — week-ahead (Mondays).
 *
 * A day-by-day airing table, Monday to Sunday, with the local (WAT) and UTC
 * clock time on every row. This is the only layout that leads with a schedule:
 * Monday morning is when people plan what they will watch this week.
 */

import { Section, Text } from "@react-email/components"
import type { AiringItem } from "../types"
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

function ScheduleRow({ item }: { item: AiringItem }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          <td width="46" valign="top" style={{ width: 46, paddingRight: 10, paddingTop: 2 }}>
            {item.coverUrl ? (
              <CoverImage src={item.coverUrl} alt={item.title} width={46} height={62} radius={4} />
            ) : null}
          </td>
          <td valign="top">
            <Headline size={14} href={item.url}>
              {item.title}
            </Headline>
            <Text
              style={{
                margin: "3px 0 0",
                fontFamily: FONTS.body,
                fontSize: 12,
                lineHeight: "17px",
                color: COLORS.muted,
              }}
              className="nl-muted"
            >
              Ep {item.episode} · {item.watTime} · {item.utcTime}
            </Text>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function WeekAheadEmail(ctx: RenderContext) {
  const { content, copy, variant, brand } = ctx
  const days = content.schedule ?? []
  const totalAirings = days.reduce((sum, day) => sum + day.items.length, 0)

  return (
    <EmailShell ctx={ctx} preview={copy.preheader}>
      <DateLine ctx={ctx} />

      <Block padding={`16px ${SIZE.pad}px 0`}>
        <EditorsNote text={copy.editorsNote} accent={variant.accent} />
      </Block>

      <Block padding={`26px ${SIZE.pad}px 0`}>
        <Kicker>{totalAirings > 0 ? `${totalAirings} episodes this week` : "Schedule"}</Kicker>
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
          The week ahead
        </Text>
        <div style={{ height: 16 }} />
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
          <tbody>
            {days.map((day) => (
              <tr key={day.dayKey}>
                <td
                  width="72"
                  valign="top"
                  style={{
                    width: 72,
                    padding: "12px 10px 12px 0",
                    borderTop: `1px solid ${COLORS.rule}`,
                    verticalAlign: "top",
                  }}
                  className="nl-rule"
                >
                  <Text
                    style={{
                      margin: 0,
                      fontFamily: FONTS.body,
                      fontSize: 11,
                      lineHeight: "14px",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: day.isToday ? COLORS.accentInk : COLORS.muted,
                    }}
                  >
                    {day.dayLabel}
                  </Text>
                  {day.isToday ? (
                    <Text
                      style={{
                        margin: "4px 0 0",
                        fontFamily: FONTS.body,
                        fontSize: 10,
                        lineHeight: "13px",
                        color: COLORS.accentInk,
                      }}
                    >
                      Today
                    </Text>
                  ) : null}
                </td>
                <td
                  valign="top"
                  style={{ padding: "12px 0", borderTop: `1px solid ${COLORS.rule}` }}
                  className="nl-rule"
                >
                  {day.items.length ? (
                    day.items.map((item, index) => (
                      <div key={`${item.anilistId}-${item.episode}`} style={{ paddingBottom: index === day.items.length - 1 ? 0 : 10 }}>
                        <ScheduleRow item={item} />
                      </div>
                    ))
                  ) : (
                    <Text
                      style={{
                        margin: 0,
                        fontFamily: FONTS.body,
                        fontSize: 13,
                        lineHeight: "18px",
                        color: COLORS.muted,
                        fontStyle: "italic",
                      }}
                      className="nl-muted"
                    >
                      Nothing scheduled.
                    </Text>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ height: 12 }} />
        <Paragraph size={12} tone="muted">
          Times are West Africa Time (UTC+1) with UTC alongside. <FineLink href={`${brand.siteUrl}/episodes/upcoming`}>Full schedule</FineLink>
        </Paragraph>
      </Block>

      <Divider kind={variant.divider} inset={SIZE.pad} />

      {content.topStory ? (
        <Section style={{ padding: 0 }}>
          {content.topStory.imageUrl ? (
            <a href={content.topStory.url} style={{ textDecoration: "none" }}>
              <CoverImage
                src={content.topStory.imageUrl}
                alt={content.topStory.title}
                width={600}
                height={variant.crop === "tall" ? 340 : 280}
                radius={0}
              />
            </a>
          ) : null}
          <div style={{ padding: `16px ${SIZE.pad}px 0` }}>
            <Kicker>{`Top story · ${content.topStory.category}`}</Kicker>
            <div style={{ height: 8 }} />
            <Headline size={23} href={content.topStory.url} accent={variant.accent}>
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
            <div style={{ height: 16 }} />
            <Button href={content.topStory.url} label="Read the story" tone={variant.button} />
          </div>
        </Section>
      ) : null}

      {content.posts.length ? (
        <Block padding={`22px ${SIZE.pad}px 0`}>
          <ModuleTitle kicker="Also worth your time">More news</ModuleTitle>
          <div style={{ height: 14 }} />
          {content.posts.slice(0, 3).map((post, index) => (
            <div key={post.id} style={{ paddingBottom: index === Math.min(content.posts.length, 3) - 1 ? 0 : 16 }}>
              <PostRow post={post} thumbWidth={92} thumbHeight={60} showDek />
            </div>
          ))}
        </Block>
      ) : null}

      {content.upcoming.length ? (
        <Block padding={`24px ${SIZE.pad}px 0`}>
          <ModuleTitle kicker="Season watch">Coming this season</ModuleTitle>
          <div style={{ height: 14 }} />
          <UpcomingGrid items={content.upcoming} />
        </Block>
      ) : null}

      <Block padding={`26px ${SIZE.pad}px 30px`}>
        <Button href={`${brand.siteUrl}/episodes/upcoming`} label="See what is coming" tone="outline" />
      </Block>
    </EmailShell>
  )
}

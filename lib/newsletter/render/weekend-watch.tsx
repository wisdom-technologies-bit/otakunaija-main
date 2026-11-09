/**
 * Layout 4 — weekend-watch (Fridays).
 *
 * Two tall picks side by side, then a compact "also new" list. Friday is a
 * planning day: the email answers "what am I watching tonight" without asking
 * the reader to scan a schedule.
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
  EpisodeChips,
  FineLink,
  Headline,
  Kicker,
  ModuleTitle,
  Paragraph,
  PostCard,
  TrendingList,
} from "./parts"
import { COLORS, FONTS, SIZE } from "./theme"

export function WeekendWatchEmail(ctx: RenderContext) {
  const { content, copy, variant, brand } = ctx
  const picks = content.seriesGroups.slice(0, 2)
  const alsoNew = content.seriesGroups.slice(2, 6)
  const news = content.posts.slice(0, 2)
  const featuredPost = content.topStory

  return (
    <EmailShell ctx={ctx} preview={copy.preheader}>
      <DateLine ctx={ctx} />

      <Block padding={`16px ${SIZE.pad}px 0`}>
        <EditorsNote text={copy.editorsNote} accent={variant.accent} />
      </Block>

      <Block padding={`26px ${SIZE.pad}px 0`}>
        <Kicker>Weekend watch</Kicker>
        <div style={{ height: 8 }} />
        <Text
          className="nl-ink"
          style={{
            margin: 0,
            fontFamily: FONTS.heading,
            fontSize: 28,
            lineHeight: "33px",
            fontWeight: 700,
            color: COLORS.ink,
          }}
        >
          Start with these
        </Text>
        <div style={{ height: 6 }} />
        <Paragraph size={14} tone="muted">
          Two picks for the weekend, chosen from what landed this week.
        </Paragraph>
      </Block>

      {picks.length ? (
        <Block padding={`18px ${SIZE.pad}px 0`}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
            <tbody>
              <tr>
                {picks.map((group, index) => (
                  <td
                    key={group.seriesId}
                    width="50%"
                    valign="top"
                    className="nl-stack"
                    style={{ width: "50%", paddingRight: index === 0 && picks.length > 1 ? 20 : 0 }}
                  >
                    {group.posterUrl ? (
                      <a href={group.url} style={{ textDecoration: "none" }}>
                        <CoverImage src={group.posterUrl} alt={group.title} width={252} height={336} radius={8} />
                      </a>
                    ) : null}
                    <div style={{ height: 12 }} />
                    <Headline size={19} href={group.url} accent={variant.accent}>
                      {group.title}
                    </Headline>
                    <div style={{ height: 6 }} />
                    <Paragraph size={13} tone="muted">
                      Episode {group.episodes.map((episode) => episode.number ?? "?").join(", ")} · ready now
                    </Paragraph>
                    <div style={{ height: 12 }} />
                    <Button
                      href={group.episodes[0]?.url ?? group.url}
                      label="Watch now"
                      tone={variant.button}
                      width={136}
                    />
                  </td>
                ))}
                {picks.length < 2 ? <td width="50%" style={{ width: "50%" }} /> : null}
              </tr>
            </tbody>
          </table>
        </Block>
      ) : null}

      <Divider kind={variant.divider} inset={SIZE.pad} />

      {alsoNew.length ? (
        <Block padding={`0 ${SIZE.pad}px`}>
          <ModuleTitle kicker="Also new">On the site</ModuleTitle>
          <div style={{ height: 14 }} />
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
            <tbody>
              {alsoNew.map((group) => (
                <tr key={group.seriesId}>
                  <td width="42" valign="top" style={{ padding: "6px 10px 6px 0", width: 42 }}>
                    {group.posterUrl ? (
                      <CoverImage src={group.posterUrl} alt={group.title} width={42} height={56} radius={4} />
                    ) : null}
                  </td>
                  <td valign="top" style={{ padding: "6px 0" }}>
                    <Text style={{ margin: 0, fontFamily: FONTS.body, fontSize: 14, lineHeight: "19px", color: COLORS.ink }}>
                      <FineLink href={group.url} strong>
                        {group.title}
                      </FineLink>
                      <span style={{ color: COLORS.muted }}> · ep {group.episodes.map((episode) => episode.number ?? "?").join(", ")}</span>
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      ) : null}

      {featuredPost ? (
        <Section style={{ padding: `${alsoNew.length ? 26 : 14}px 0 0` }}>
          {featuredPost.imageUrl ? (
            <a href={featuredPost.url} style={{ textDecoration: "none" }}>
              <CoverImage
                src={featuredPost.imageUrl}
                alt={featuredPost.title}
                width={600}
                height={variant.crop === "tall" ? 320 : 250}
                radius={0}
              />
            </a>
          ) : null}
          <div style={{ padding: `16px ${SIZE.pad}px 0` }}>
            <Kicker>{`Weekend read · ${featuredPost.category}`}</Kicker>
            <div style={{ height: 6 }} />
            <Headline size={22} href={featuredPost.url} accent={variant.accent}>
              {featuredPost.title}
            </Headline>
            {featuredPost.excerpt ? (
              <>
                <div style={{ height: 8 }} />
                <Paragraph size={15} tone="muted">
                  {featuredPost.excerpt}
                </Paragraph>
              </>
            ) : null}
          </div>
        </Section>
      ) : null}

      {news.length ? (
        <Block padding={`24px ${SIZE.pad}px 0`}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
            <tbody>
              <tr>
                {news.map((post, index) => (
                  <td
                    key={post.id}
                    width="50%"
                    valign="top"
                    className="nl-stack"
                    style={{ width: "50%", paddingRight: index === 0 && news.length > 1 ? 20 : 0 }}
                  >
                    <PostCard post={post} imageWidth={252} imageHeight={150} accent={variant.accent} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </Block>
      ) : null}

      {content.trending.length ? (
        <Block padding={`24px ${SIZE.pad}px 0`}>
          <TrendingList items={content.trending} />
        </Block>
      ) : null}

      {content.upcoming.length ? (
        <Block padding={`24px ${SIZE.pad}px 0`}>
          <ModuleTitle kicker="Season watch">Soon</ModuleTitle>
          <div style={{ height: 10 }} />
          {content.upcoming.map((item) => (
            <Text
              key={item.anilistId}
              style={{ margin: "0 0 6px", fontFamily: FONTS.body, fontSize: 14, lineHeight: "20px", color: COLORS.body }}
            >
              <FineLink href={item.url} strong>
                {item.title}
              </FineLink>{" "}
              · {item.startLabel}
            </Text>
          ))}
        </Block>
      ) : null}

      <Block padding={`26px ${SIZE.pad}px 30px`}>
        <Button href={`${brand.siteUrl}/episodes`} label="Browse all episodes" tone="outline" />
      </Block>
    </EmailShell>
  )
}

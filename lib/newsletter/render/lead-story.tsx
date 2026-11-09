/**
 * Layout 1 — lead-story.
 *
 * One dominant story, then a two-column grid of secondary reads. The most
 * common issue shape: a clear hero, an editorial note, and room for episodes
 * underneath when they exist.
 */

import { Section, Text } from "@react-email/components"
import { heroGeometry } from "../images"
import type { RenderContext } from "./context"
import {
  Block,
  Button,
  CoverImage,
  DateLine,
  Divider,
  EditorsNote,
  EmailShell,
  Headline,
  Kicker,
  ModuleTitle,
  Paragraph,
  PostCard,
  PostRow,
  TrendingList,
  UpcomingGrid,
} from "./parts"
import { COLORS, FONTS, SIZE, TEXT } from "./theme"

export function LeadStoryEmail(ctx: RenderContext) {
  const { content, copy, variant, brand } = ctx
  const hero = content.topStory
  const geometry = heroGeometry(variant.crop)
  const secondary = content.posts.slice(0, 4)
  const left = secondary.slice(0, 2)
  const right = secondary.slice(2, 4)

  const episodesModule =
    content.seriesGroups.length > 0 ? (
      <Block padding={`0 ${SIZE.pad}px`}>
        <ModuleTitle kicker="New episodes">Fresh from the site</ModuleTitle>
        <div style={{ height: 16 }} />
        {content.seriesGroups.slice(0, 3).map((group, index) => (
          <div key={group.seriesId}>
            {index > 0 ? <div style={{ height: 14 }} /> : null}
            <PostRow
              post={{
                id: group.seriesId,
                slug: group.slug,
                title: group.title,
                excerpt:
                  group.episodes.length > 1
                    ? `Episodes ${group.episodes.map((episode) => episode.number ?? "?").join(", ")} are up.`
                    : `Episode ${group.episodes[0]?.number ?? "?"} is up.`,
                category: "Episode",
                coverImage: group.posterUrl,
                imageUrl: group.posterUrl,
                url: group.episodes[0]?.url ?? group.url,
                views: 0,
                publishedAt: "",
                whyItMatters: null,
              }}
              thumbWidth={72}
              thumbHeight={96}
              showDek
            />
          </div>
        ))}
      </Block>
    ) : null

  const airingModule =
    content.airing.length > 0 ? (
      <Block padding={`0 ${SIZE.pad}px`}>
        <ModuleTitle kicker="Next 36 hours">Airing soon</ModuleTitle>
        <div style={{ height: 14 }} />
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
          <tbody>
            {content.airing.slice(0, 4).map((item) => (
              <tr key={`${item.anilistId}-${item.episode}`}>
                <td valign="top" style={{ padding: "7px 0" }}>
                  <Text style={{ margin: 0, fontFamily: FONTS.body, fontSize: 15, lineHeight: "21px", color: COLORS.ink }}>
                    {item.title}
                  </Text>
                  <Text style={{ margin: "2px 0 0", fontFamily: FONTS.body, fontSize: 12, lineHeight: "17px", color: COLORS.muted }}>
                    Episode {item.episode} · {item.dayLabel} {item.watTime}
                  </Text>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>
    ) : null

  const newsFirst = variant.order === "news-first"

  return (
    <EmailShell ctx={ctx} preview={copy.preheader}>
      <DateLine ctx={ctx} />

      <Block padding={`16px ${SIZE.pad}px 0`}>
        <EditorsNote text={copy.editorsNote} accent={variant.accent} />
      </Block>

      {hero ? (
        <Section style={{ padding: "22px 0 0" }}>
          {hero.imageUrl ? (
            <a href={hero.url} style={{ textDecoration: "none", display: "block" }}>
              <CoverImage
                src={hero.imageUrl}
                alt={hero.title}
                width={geometry.width}
                height={geometry.height}
                radius={0}
              />
            </a>
          ) : null}
          <div style={{ padding: `18px ${SIZE.pad}px 0` }}>
            <Kicker>{hero.category}</Kicker>
            <div style={{ height: 8 }} />
            <Headline size={TEXT.h1} href={hero.url} accent={variant.accent}>
              {hero.title}
            </Headline>
            {hero.excerpt ? (
              <>
                <div style={{ height: 10 }} />
                <Paragraph size={16} tone="body">
                  {hero.excerpt}
                </Paragraph>
              </>
            ) : null}
            {hero.whyItMatters ? (
              <>
                <div style={{ height: 8 }} />
                <Paragraph size={14} tone="muted">
                  {hero.whyItMatters}
                </Paragraph>
              </>
            ) : null}
            <div style={{ height: 18 }} />
            <Button href={hero.url} label="Read the story" tone={variant.button} />
          </div>
        </Section>
      ) : null}

      <Divider kind={variant.divider} inset={SIZE.pad} />

      {newsFirst ? (
        <>
          {secondary.length > 0 ? (
            <Block padding={`0 ${SIZE.pad}px`}>
              <ModuleTitle kicker="Also this morning">More to read</ModuleTitle>
              <div style={{ height: 18 }} />
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
                <tbody>
                  <tr>
                    <td width="258" valign="top" className="nl-stack" style={{ width: 258, paddingRight: 28 }}>
                      {left.map((post, index) => (
                        <div key={post.id} style={{ paddingBottom: index === 0 ? 26 : 0 }}>
                          <PostCard post={post} imageWidth={258} imageHeight={155} accent={variant.accent} />
                        </div>
                      ))}
                    </td>
                    <td width="258" valign="top" className="nl-stack nl-stack-gap" style={{ width: 258 }}>
                      {right.map((post, index) => (
                        <div key={post.id} style={{ paddingBottom: index === 0 ? 26 : 0 }}>
                          <PostCard post={post} imageWidth={258} imageHeight={155} accent={variant.accent} />
                        </div>
                      ))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Block>
          ) : null}
          {episodesModule ? <div style={{ height: 26 }} /> : null}
          {episodesModule}
          {airingModule ? <div style={{ height: 26 }} /> : null}
          {airingModule}
        </>
      ) : (
        <>
          {episodesModule}
          {episodesModule && secondary.length ? <div style={{ height: 26 }} /> : null}
          {secondary.length > 0 ? (
            <Block padding={`0 ${SIZE.pad}px`}>
              <ModuleTitle kicker="Also this morning">More to read</ModuleTitle>
              <div style={{ height: 16 }} />
              {secondary.map((post, index) => (
                <div key={post.id} style={{ paddingBottom: index === secondary.length - 1 ? 0 : 18 }}>
                  <PostRow post={post} showDek />
                </div>
              ))}
            </Block>
          ) : null}
          {airingModule ? <div style={{ height: 26 }} /> : null}
          {airingModule}
        </>
      )}

      {content.trending.length ? (
        <Block padding={`22px ${SIZE.pad}px 0`}>
          <TrendingList items={content.trending} />
        </Block>
      ) : null}

      {content.upcoming.length ? (
        <Block padding={`24px ${SIZE.pad}px 0`}>
          <ModuleTitle kicker="Season watch">Starting soon</ModuleTitle>
          <div style={{ height: 14 }} />
          <UpcomingGrid items={content.upcoming} />
        </Block>
      ) : null}

      <Block padding={`26px ${SIZE.pad}px 30px`}>
        <Button href={`${brand.siteUrl}/blog`} label="All stories" tone="outline" />
      </Block>
    </EmailShell>
  )
}

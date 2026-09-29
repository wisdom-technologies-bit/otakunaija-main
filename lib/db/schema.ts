import { pgTable, serial, text, timestamp, integer, boolean, unique, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const creators = pgTable('creators', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  facebookUrl: text('facebook_url'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const series = pgTable('series', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id')
    .notNull()
    .references(() => creators.id),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  synopsis: text('synopsis'),
  coverImageUrl: text('cover_image_url'),
  posterImageUrl: text('poster_image_url'),
  status: text('status').default('ongoing'),
  genre: text('genre'),
  anilistId: integer('anilist_id').unique(),
  titleChecked: boolean('title_checked').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
})

export const episodes = pgTable('episodes', {
  id: serial('id').primaryKey(),
  seriesId: integer('series_id')
    .notNull()
    .references(() => series.id),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  synopsis: text('synopsis'),
  videoPublicId: text('video_public_id'),
  videoUrl: text('video_url'),
  thumbnailUrl: text('thumbnail_url').notNull(),
  durationSeconds: integer('duration_seconds'),
  subtitlesUrl: text('subtitles_url'),
  playId: text('play_id').unique(),
  publishedAt: timestamp('published_at').defaultNow(),
  viewCount: integer('view_count').default(0),
  totalWatchMinutes: integer('total_watch_minutes').default(0),
})

export const postViews = pgTable(
  'post_views',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id').notNull(),
    deviceId: text('device_id').notNull(),
    viewedAt: timestamp('viewed_at').defaultNow(),
  },
  (table) => [index('post_views_post_viewed_at_idx').on(table.postId, table.viewedAt), index('post_views_viewed_at_idx').on(table.viewedAt)],
)

export const episodeViews = pgTable(
  'episode_views',
  {
    id: serial('id').primaryKey(),
    episodeId: integer('episode_id')
      .notNull()
      .references(() => episodes.id),
    deviceId: text('device_id').notNull(),
    viewedAt: timestamp('viewed_at').defaultNow(),
  },
  (table) => [unique('episode_views_episode_device_unique').on(table.episodeId, table.deviceId)],
)

export const episodeWatchPings = pgTable(
  'episode_watch_pings',
  {
    id: serial('id').primaryKey(),
    episodeId: integer('episode_id')
      .notNull()
      .references(() => episodes.id),
    deviceId: text('device_id').notNull(),
    minutesWatched: integer('minutes_watched').notNull().default(1),
    lastPingAt: timestamp('last_ping_at').defaultNow(),
  },
  (table) => [unique('episode_watch_pings_episode_device_unique').on(table.episodeId, table.deviceId)],
)

// ... at the end of lib/db/schema.ts

export const commentUsers = pgTable('comment_users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  username: text('username').notNull().unique(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  postSlug: text('post_slug').notNull(),
  parentId: integer('parent_id'),
  userId: integer('user_id').notNull().references(() => commentUsers.id),
  body: text('body').notNull(),
  likes: integer('likes').default(0),
  createdAt: timestamp('created_at').defaultNow(),
})

export const textAnnotations = pgTable('text_annotations', {
  id: serial('id').primaryKey(),
  postSlug: text('post_slug').notNull(),
  selectedText: text('selected_text'),
  contextHash: text('context_hash'),
  startOffset: integer('start_offset'),
  endOffset: integer('end_offset'),
  commentId: integer('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
})

export const reactions = pgTable('reactions', {
  id: serial('id').primaryKey(),
  commentId: integer('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => commentUsers.id),
  type: text('type').notNull(), // 'like','love','laugh','wow'
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  unique: unique('reactions_comment_user_type').on(table.commentId, table.userId, table.type),
}))

export const commentLikes = pgTable('comment_likes', {
  commentId: integer('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => commentUsers.id),
}, (table) => ({
  unique: unique('comment_likes_comment_user').on(table.commentId, table.userId),
}))

export const activatedPosts = pgTable('activated_posts', {
  slug: text('slug').primaryKey(),
  activatedAt: timestamp('activated_at').defaultNow(),
})

export const polls = pgTable('polls', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  status: text('status').notNull().default('DRAFT'),
  featured: boolean('featured').notNull().default(false),
  allowMultipleVotes: boolean('allow_multiple_votes').notNull().default(false),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [index('polls_status_idx').on(table.status)])

export const pollOptions = pgTable('poll_options', {
  id: serial('id').primaryKey(),
  pollId: integer('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  imagePublicId: text('image_public_id'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [index('poll_options_poll_order_idx').on(table.pollId, table.displayOrder)])

export const rateLimits = pgTable('rate_limits', {
  id: serial('id').primaryKey(),
  identifier: text('identifier').notNull(),
  action: text('action').notNull(),
  count: integer('count').default(1),
  windowStart: timestamp('window_start').defaultNow(),
}, (table) => [unique('rate_limits_identifier_action_unique').on(table.identifier, table.action)])

export const pollVotes = pgTable('poll_votes', {
  id: serial('id').primaryKey(),
  pollId: integer('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
  optionId: integer('option_id').notNull().references(() => pollOptions.id, { onDelete: 'cascade' }),
  voterHash: text('voter_hash').notNull(),
  countryCode: text('country_code'),
  countryName: text('country_name'),
  region: text('region'),
  city: text('city'),
  timezone: text('timezone'),
  continent: text('continent'),
  deviceType: text('device_type'),
  userAgentHash: text('user_agent_hash'),
  referrer: text('referrer'),
  votedAt: timestamp('voted_at').notNull().defaultNow(),
}, (table) => [
  unique('poll_votes_poll_voter_option_unique').on(table.pollId, table.voterHash, table.optionId),
  index('poll_votes_poll_time_idx').on(table.pollId, table.votedAt),
])

export const pollViews = pgTable('poll_views', {
  id: serial('id').primaryKey(),
  pollId: integer('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
  deviceId: text('device_id').notNull(),
  source: text('source'),
  sourceArticleId: integer('source_article_id'),
  viewedAt: timestamp('viewed_at').notNull().defaultNow(),
}, (table) => [index('poll_views_poll_time_idx').on(table.pollId, table.viewedAt)])

export const pollVoteSubmissions = pgTable('poll_vote_submissions', {
  id: serial('id').primaryKey(),
  pollId: integer('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
  voterHash: text('voter_hash').notNull(),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
}, (table) => [unique('poll_vote_submissions_poll_voter_unique').on(table.pollId, table.voterHash)])

// Relations
export const creatorsRelations = relations(creators, ({ many }) => ({
  series: many(series),
}))

export const seriesRelations = relations(series, ({ one, many }) => ({
  creator: one(creators, {
    fields: [series.creatorId],
    references: [creators.id],
  }),
  episodes: many(episodes),
}))

export const episodesRelations = relations(episodes, ({ one }) => ({
  series: one(series, {
    fields: [episodes.seriesId],
    references: [series.id],
  }),
}))

// TypeScript types inferred from schema
export type Creator = typeof creators.$inferSelect
export type CreatorInsert = typeof creators.$inferInsert
export type Series = typeof series.$inferSelect
export type SeriesInsert = typeof series.$inferInsert
export type Episode = typeof episodes.$inferSelect
export type EpisodeInsert = typeof episodes.$inferInsert
export type PostView = typeof postViews.$inferSelect
export type PostViewInsert = typeof postViews.$inferInsert
export type EpisodeView = typeof episodeViews.$inferSelect
export type EpisodeViewInsert = typeof episodeViews.$inferInsert
export type EpisodeWatchPing = typeof episodeWatchPings.$inferSelect
export type EpisodeWatchPingInsert = typeof episodeWatchPings.$inferInsert

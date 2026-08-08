import { pgTable, serial, text, timestamp, integer, foreignKey, unique } from 'drizzle-orm/pg-core'
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
  videoPublicId: text('video_public_id').notNull(),
  videoUrl: text('video_url').notNull(),
  thumbnailUrl: text('thumbnail_url').notNull(),
  durationSeconds: integer('duration_seconds'),
  subtitlesUrl: text('subtitles_url'),
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
  (table) => [unique('post_views_post_device_unique').on(table.postId, table.deviceId)],
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

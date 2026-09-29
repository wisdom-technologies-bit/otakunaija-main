SECTION 1 — POSTS DATA MODEL

Relevant source files: lib/db/schema.ts, lib/posts.ts, lib/admin-queries.ts.

Important finding: lib/db/schema.ts does not define a posts table. It defines post-related auxiliary tables, but the posts table is accessed through raw SQL in lib/posts.ts and lib/admin-queries.ts. Therefore there is no Drizzle posts-table definition in lib/db/schema.ts to paste.

The post shape used by the application is declared in lib/posts.ts exactly as follows:

export type Post = {
  id: number
  slug: string
  title: string
  excerpt: string
  content: string
  cover_image: string | null
  category: string
  author: string
  tags: string[] | null
  featured: boolean
  trending: boolean
  views: number
  read_time: number
  published_at: string
  created_at: string
}

The post-related Drizzle definitions that do exist in lib/db/schema.ts are:

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
  commentId: integer('comment_id').notNull().references(() => commentUsers.id),
  userId: integer('user_id').notNull().references(() => commentUsers.id),
}, (table) => ({
  unique: unique('comment_likes_comment_user').on(table.commentId, table.userId),
}))

export const activatedPosts = pgTable('activated_posts', {
  slug: text('slug').primaryKey(),
  activatedAt: timestamp('activated_at').defaultNow(),
})

There are no categories, tags, authors, or post-to-category join-table definitions in lib/db/schema.ts. In the application, category is a free-text posts column represented as category: string, with an application-level list in lib/posts.ts:

export const CATEGORIES = ["Shonen", "Romance", "Action", "Guides"] as const

The admin form renders those four values, but the database/application input type remains string. Tags are stored as a string array column in the database-facing application code: createPost inserts the tags array into posts.tags, and the Post type declares tags: string[] | null. There is no tags relational table.

There is no draft/published status column or enum in the inspected code. The Post type has published_at and created_at only. All post queries treat rows as published posts; getAllPosts, getPostBySlug, getAllSlugs, RSS, and public pages do not filter by a status field. Future-dated posts are excluded only by the trending query condition p.published_at <= NOW(); ordinary post listing queries do not apply that condition.

The featured/cover image field is cover_image: string | null. It is optional in the application: createPost inserts input.cover_image ?? null, and the admin editor uses an optional upload/value. The frontend falls back to a generated /placeholder.svg URL through getCoverImage when cover_image is empty.

The slug field is slug: string and is unique in application logic through ensureUniqueSlug in lib/admin-queries.ts. On create, createPost calls ensureUniqueSlug(input.slug || input.title). On edit, updatePost calls ensureUniqueSlug(input.slug, input.id) only when a slug is supplied. The generation logic is in lib/admin-queries.ts:

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200)
}

There are no dedicated SEO columns such as meta_description or og_image in the Post type or inspected post SQL. The public page derives SEO metadata from title, excerpt, author, tags, published_at, and cover_image in app/blog/[slug]/page.tsx. It sets description to post.excerpt and uses the cover image for Open Graph and Twitter images.

SECTION 2 — ADMIN POST CREATION/EDITING

The /admin/posts/new route is app/admin/posts/new/page.tsx:

import { PostEditor } from "@/components/admin/post-editor"

export const metadata = { title: "New Post" }

export default function NewPostPage() {
  return <PostEditor mode="create" />
}

The form implementation is components/admin/post-editor.tsx. It exposes these fields:

- title (required text)
- excerpt (required textarea)
- content (required textarea)
- cover_image (cover image uploader/URL value; optional)
- category (select: Shonen, Romance, Action, Guides)
- slug (optional text; auto-generated from title if empty on create)
- author (text; default OtakuNaija Team)
- read_time (number, default 5, min 1, max 60)
- tags (comma-separated text)
- featured (checkbox)
- trending (checkbox)

Edit routing is separate. Existing posts use app/admin/posts/[id]/edit/page.tsx, not /new with a query parameter. The dynamic page awaits params.id, loads getAdminPostById(Number(id)), and renders <PostEditor mode="edit" post={post} justCreated={created === "1"} />. The created query parameter only controls the post-created toast after redirect; it does not switch the form mode.

Submission uses React’s useActionState form action and server actions from app/actions/admin.ts. Create uses createPostAction; edit uses updatePostAction. Both call requireSession(), parse the FormData with buildInput(), then call createPost or updatePost from lib/admin-queries.ts. createPostAction revalidates /admin/posts and redirects to /admin/posts/{id}/edit?created=1. updatePostAction revalidates /admin/posts and returns { ok: true, error: null, savedAt: Date.now() }.

There is no rich text editor. The body is a plain textarea named content. The UI hint says to use Markdown-style headings and lists. The stored content is a string containing Markdown. The public page renders it with react-markdown, remark-gfm, and rehype-raw in app/blog/[slug]/page.tsx.

There is no separate body-image upload flow in the post editor. The only post image control is ImageUploader for the cover_image field. It posts to /api/admin/upload. That route is app/api/admin/upload/route.ts and calls uploadImageBuffer(buffer, "otakunaija/polls") from lib/cloudinary.ts. Despite the folder name, this is Cloudinary, not R2. The same component/route is used for the post cover image. No body-image endpoint or editor integration was found. The uploader text itself says “Uploading to Cloudinary...”.

SECTION 3 — PUBLISH FLOW

There is no explicit draft-to-published transition in the inspected post model or admin UI. Creating a post directly inserts into posts without a status field:

const rows = await sql`
    INSERT INTO posts (slug, title, excerpt, content, cover_image, category, author, tags, featured, trending, read_time)
    VALUES (
      ${slug},
      ${input.title},
      ${input.excerpt},
      ${input.content},
      ${input.cover_image ?? null},
      ${input.category},
      ${input.author ?? "OtakuNaija Team"},
      ${tags},
      ${input.featured ?? false},
      ${input.trending ?? false},
      ${input.read_time ?? 5}
    )
    RETURNING *
  `

The database/default behavior supplies published_at, because createPost does not include published_at in the INSERT. The exact database default is not defined in lib/db/schema.ts or the repository migrations available here. The application assumes a non-null published_at and uses it for ordering, RSS pubDate, metadata datePublished, and display.

On create, the only explicit side effect is revalidatePath("/admin/posts") followed by redirect to the edit page. On edit, the only explicit side effect is revalidatePath("/admin/posts"). There is no RSS regeneration call, sitemap update call, notification, or post-cache revalidation in the post server actions. The public reads use Next cache wrappers with tags such as blog-all, blog-post, blog-featured, blog-trending, and sitemap, but the post create/update actions do not revalidate those tags.

There is no scheduling UI or scheduling server action. publishAt is not an admin form field. Because public queries do not filter future dates, a future published_at value would not be consistently treated as scheduled by the general blog listing/page queries. The trending query does explicitly require p.published_at <= NOW().

There is no unpublish/revert-to-draft action, no status field, and no admin control for it. Deleting a post is supported by deletePostAction and removes the database row. A deleted post then causes getPostBySlug to return null and app/blog/[slug]/page.tsx calls notFound(), so its public URL becomes a 404. No redirect behavior was found. Changing a slug through the edit form changes the URL; no redirect record is created for the old slug.

SECTION 4 — ADMIN AUTH & ACCESS

The /admin/* path is protected in proxy.ts. It reads the otakunaija_session cookie, verifies it with verifySessionToken(), and redirects unauthenticated requests to /admin/login. The matcher is:

export const config = {
  matcher: ["/admin/:path*"],
}

The session implementation is in lib/auth.ts. It uses a custom HMAC-SHA-256 signed token stored in an HTTP-only cookie named otakunaija_session. getCurrentSession() reads the cookie with next/headers cookies(). The token payload contains email and exp, with a seven-day default TTL. The signing secret is SESSION_SECRET, falling back to the literal development default otakunaija-dev-secret-change-me if the environment variable is absent.

Credential checking is also custom in lib/auth.ts: the email must equal ADMIN_EMAIL (default support@otakunaija.name.ng) and the password must equal ADMIN_PASSWORD. Server actions also call requireSession(), and the upload API additionally checks that session.email.toLowerCase() === ADMIN_EMAIL.

There is one flat admin identity/access check. No roles, permission levels, or per-feature authorization levels were found.

SECTION 5 — EXISTING RSS/FEED INFRASTRUCTURE

The footer link is in components/site-footer.tsx and points to /rss.xml. The route is app/rss.xml/route.ts.

The route begins with:

export const dynamic = "force-dynamic"

It gets slugs with getAllSlugs(), takes the first 30, then loads each full post with getPostBySlug(). Each RSS item includes these post-derived fields:

- title
- slug, used in link and guid
- excerpt, used as description
- published_at, converted to UTC pubDate
- category

The route also emits fixed channel metadata: OtakuNaija title, the site link, a fixed description, language en, and an atom self link.

It auto-reads the database at request time because the route is force-dynamic and calls the post data layer. There is no manual RSS rebuild step and no explicit RSS regeneration trigger in the admin publish/create actions. Note that getAllSlugs itself is wrapped in unstable_cache with a revalidate period of 86400 and tag sitemap in lib/posts.ts; the RSS route is dynamic, but its slug query can still be served through that cached helper unless BLOG_RENDER_MODE is relevant elsewhere. No post action invalidates the sitemap/all-slugs cache tag.

SECTION 6 — ANYTHING ELSE STRUCTURALLY RELEVANT

Post-related tables and content behavior:

- post_views in lib/db/schema.ts stores id, post_id, device_id, and viewed_at. It has indexes post_views_post_viewed_at_idx and post_views_viewed_at_idx, but postId has no Drizzle foreign-key reference to a posts table.
- app/api/posts/[slug]/comments/route.ts and app/api/posts/[slug]/annotations/route.ts expose comments and annotations by post slug.
- comments stores postSlug, parentId, userId, body, likes, and createdAt. commentUsers stores commenter identity/token data. textAnnotations links annotations to postSlug and optionally comments. reactions and commentLikes provide comment engagement with unique constraints. app/api/comments/[id]/like/route.ts, react/route.ts, and replies/route.ts operate on that system.
- activated_posts stores slug and activatedAt. app/api/posts/[slug]/activate/route.ts is the related activation endpoint. This is separate from publication status; no connection to a posts status column was found.
- lib/posts.ts implements related posts by matching the same category and excluding the current slug:

const rows = await sql`
        SELECT * FROM posts
        WHERE category = ${category} AND slug <> ${slug}
        ORDER BY published_at DESC
        LIMIT ${limit}
      `

- lib/posts.ts increments views with UPDATE posts SET views = views + 1 WHERE slug = ${slug}; the public page uses components/blog-view-tracker.tsx for view tracking.
- lib/trending.ts computes trending candidates from posts, post_views, and comment activity. It requires published_at IS NOT NULL and published_at <= NOW(), and uses recent activity windows. It also contains an eligibility configuration with publishedOnly: true and excludesManualTrendingFlag: true, even though the legacy Post shape and admin editor still expose a trending boolean.
- Public post search is implemented as SQL ILIKE against title and excerpt in lib/posts.ts. No separate posts search index/table was found.
- Public page metadata is generated in app/blog/[slug]/page.tsx from the post fields rather than stored SEO columns. It also generates BlogPosting JSON-LD, Open Graph, Twitter metadata, canonical URL, related posts, recent posts, trending posts, comments, and view tracking.
- app/sitemap.ts consumes getAllSlugs() to build the blog URL set. No post create/update action explicitly revalidates the sitemap tag.
- app/admin/posts/page.tsx is the admin list page, and app/admin/posts/[id]/edit/page.tsx is the edit page. app/admin/posts/new/page.tsx is create-only. app/components/admin/delete-post-button.tsx is the delete UI component.
- The available repository migrations in lib/db/migrations contain only episode/series changes; they do not define the posts table. The actual posts table DDL is therefore external to the inspected repository files or was created outside the tracked migration/schema definitions.

Files inspected for this report include:
lib/db/schema.ts
lib/posts.ts
lib/admin-queries.ts
app/actions/admin.ts
components/admin/post-editor.tsx
components/admin/image-uploader.tsx
app/admin/posts/new/page.tsx
app/admin/posts/[id]/edit/page.tsx
app/api/admin/upload/route.ts
lib/cloudinary.ts
proxy.ts
lib/auth.ts
app/rss.xml/route.ts
components/site-footer.tsx
app/blog/[slug]/page.tsx
lib/trending.ts
lib/db/MIGRATIONS.md
lib/db/migrations/0000_add_subtitles_url.sql
lib/db/migrations/0001_black_mauler.sql
lib/db/migrations/0002_colossal_monster_badoon.sql
app/sitemap.ts
app/api/posts/[slug]/comments/route.ts
app/api/posts/[slug]/annotations/route.ts
app/api/posts/[slug]/activate/route.ts
app/admin/posts/page.tsx
components/admin/delete-post-button.tsx

No application source files were changed; this requested report is the only file created.

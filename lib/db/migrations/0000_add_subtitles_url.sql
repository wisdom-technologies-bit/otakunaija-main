CREATE TABLE "creators" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"bio" text,
	"avatar_url" text,
	"facebook_url" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "creators_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "episode_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer NOT NULL,
	"device_id" text NOT NULL,
	"viewed_at" timestamp DEFAULT now(),
	CONSTRAINT "episode_views_episode_device_unique" UNIQUE("episode_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "episode_watch_pings" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer NOT NULL,
	"device_id" text NOT NULL,
	"minutes_watched" integer DEFAULT 1 NOT NULL,
	"last_ping_at" timestamp DEFAULT now(),
	CONSTRAINT "episode_watch_pings_episode_device_unique" UNIQUE("episode_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"series_id" integer NOT NULL,
	"episode_number" integer NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"synopsis" text,
	"video_public_id" text NOT NULL,
	"video_url" text NOT NULL,
	"thumbnail_url" text NOT NULL,
	"duration_seconds" integer,
	"subtitles_url" text,
	"published_at" timestamp DEFAULT now(),
	"view_count" integer DEFAULT 0,
	"total_watch_minutes" integer DEFAULT 0,
	CONSTRAINT "episodes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "post_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"device_id" text NOT NULL,
	"viewed_at" timestamp DEFAULT now(),
	CONSTRAINT "post_views_post_device_unique" UNIQUE("post_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"synopsis" text,
	"cover_image_url" text,
	"poster_image_url" text,
	"status" text DEFAULT 'ongoing',
	"genre" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "series_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "episode_views" ADD CONSTRAINT "episode_views_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_watch_pings" ADD CONSTRAINT "episode_watch_pings_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;
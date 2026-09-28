ALTER TABLE "episodes" ALTER COLUMN "video_public_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "episodes" ALTER COLUMN "video_url" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "play_id" text;
--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "anilist_id" integer;
--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_play_id_unique" UNIQUE("play_id");
--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_anilist_id_unique" UNIQUE("anilist_id");

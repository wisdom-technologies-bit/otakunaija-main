# Database Migrations

This project uses Drizzle Kit to manage database migrations.

## Adding the Subtitles Column

The migration `0000_add_subtitles_url.sql` adds the `subtitles_url` column to the `episodes` table.

### To apply the migration:

```bash
pnpm db:migrate
```

This will:
1. Connect to your Neon database using the `DATABASE_URL` environment variable
2. Execute all pending migrations
3. Update your database schema

### Migration File Location

- Migration SQL: `./lib/db/migrations/0000_add_subtitles_url.sql`
- Schema Definition: `./lib/db/schema.ts`

### What the Migration Does

Adds a nullable `subtitles_url` column to the episodes table:
```sql
"subtitles_url" text
```

This column stores the URL to subtitle files (SRT/VTT format) hosted on Cloudflare R2.

### Other Useful Commands

- `pnpm db:generate` - Generate new migrations after schema changes
- `pnpm db:studio` - Open Drizzle Studio to inspect your database visually

## Environment Variables Required

Make sure your `.env.local` or `.env.development.local` has:
```
DATABASE_URL=postgresql://...
```

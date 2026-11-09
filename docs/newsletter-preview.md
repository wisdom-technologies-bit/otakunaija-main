# Daily newsletter: previews, dry runs, and the commands to run after deploy

Reference for the newsletter added in Prompt N3. Every layout can be rendered and
every cron stage can be exercised without a database, a Brevo account or a Groq
key.

## 1. Render the six layouts

```bash
npx tsx scripts/newsletter-previews.tsx
```

Writes `.previews/newsletter/<layout>.html` and `.previews/newsletter/<layout>.txt`
using the seeded fixtures in `lib/newsletter/fixtures.ts`. Sizes on the recorded
run (`600px`, Gmail clips at ~102 KB):

| layout | html | text | images |
| --- | --- | --- | --- |
| `lead-story` | 33.5 KB (34,310 bytes) | 3.9 KB | 8 |
| `episode-drop` | 49.0 KB (50,141 bytes) | 3.9 KB | 11 |
| `week-ahead` | 39.6 KB (40,565 bytes) | 4.1 KB | 15 |
| `weekend-watch` | 33.2 KB (34,002 bytes) | 4.1 KB | 9 |
| `roundup` | 26.4 KB (26,990 bytes) | 4.6 KB | 5 |
| `quiet-day` | 18.3 KB (18,689 bytes) | 1.7 KB | 3 |

The fixtures carry Cloudinary placeholder URLs on purpose: they show the
`f_jpg,q_auto:good,w_600,c_fill,g_auto` transformation shape the sender relies on,
but they 404 outside a real Cloudinary account. To screenshot the emails with
visible art, re-render with the fixture titles pointed at their real AniList covers:

```bash
npx tsx scripts/newsletter-shot-html.tsx    # writes .previews/newsletter/shots-html/
```

## 2. Screenshots

```bash
for f in lead-story episode-drop week-ahead weekend-watch roundup quiet-day; do
  for size in "600:desktop" "375:phone"; do
    w=${size%%:*}; label=${size##*:}
    for scheme in light dark; do
      npx playwright@1.49.0 screenshot --full-page --viewport-size="$w,900" \
        --color-scheme=$scheme --wait-for-timeout=3000 \
        "file://$PWD/.previews/newsletter/shots-html/$f.html" \
        ".previews/newsletter/shots/$f-$label-$scheme.png"
    done
  done
done
```

Twenty-four files: six layouts × two widths × two colour schemes.

## 3. Dry runs

```bash
npx tsx scripts/newsletter-dry-run.tsx
```

Recorded output, `2026-11-09T05:30:00Z`, seeded data, `approve` mode, cap 250:

```
### GET /api/cron/newsletter?stage=prepare&dry=1

{
  "issueDate": "2026-11-09",
  "layout": "week-ahead",
  "subject": "Solo Leveling Episode 11 and 20 more",
  "preheader": "15 new episodes, 6 stories, 4 airing soon. The studio confirmed a third season at the end",
  "items": { "posts": 6, "series": 8, "episodes": 15, "airing": 4, "upcoming": 3, "trending": 3, "meaningful": 18 },
  "skipped": false,
  "reason": null,
  "copySource": "fallback",
  "layoutReason": "monday-schedule",
  "copyReasons": ["dry-run:model-skipped"],
  "htmlKb": 39.3,
  "status": null,
  "dry": true,
  "brevoConfigured": true
}

(inserts written on a dry run: 0)

### GET /api/cron/newsletter?stage=send&dry=1

{
  "issueDate": "2026-11-09",
  "issueId": 42,
  "status": "approved",
  "dry": true,
  "paused": false,
  "candidates": 5,
  "sent": 0,
  "failed": 0,
  "remaining": 5,
  "capRemaining": 113,
  "sentToday": 137,
  "weeklyExcluded": 2,
  "reason": "dry-run"
}
```

Monday picks `week-ahead` (`layoutReason: monday-schedule`); 137 already sent today
leaves 113 of the 250 cap; the two weekly subscribers are excluded because it is
not Sunday.

## 4. After deploy

Run `docs/sql/newsletter.sql` in the Neon SQL editor first. Then set the env vars
from `.env.example` in Vercel: `BREVO_API_KEY`, `BREVO_WEBHOOK_SECRET`,
`NEWSLETTER_FROM_EMAIL`, `NEWSLETTER_FROM_NAME`, `NEWSLETTER_POSTAL_ADDRESS`, and
optionally `NEWSLETTER_REPLY_TO`, `NEWSLETTER_MODE`, `NEWSLETTER_DAILY_CAP`,
`SITE_URL`.

1. Prepare today's issue, read only:

```bash
curl -sS "https://otakunaija.name.ng/api/cron/newsletter?stage=prepare&dry=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```

2. Prepare for real (writes a `draft`):

```bash
curl -sS "https://otakunaija.name.ng/api/cron/newsletter?stage=prepare" \
  -H "Authorization: Bearer $CRON_SECRET"
```

3. Open `https://otakunaija.name.ng/admin/newsletter`, check the desktop and phone
   preview, edit the subject, preheader or editor's note if needed, press
   **Send test** and enter your own address. The test arrives prefixed `[TEST]`
   and does not touch subscriber state.

4. Approve, then send five real emails to check the pipeline end to end:

```bash
# approve (admin session cookie, from the browser devtools while signed in)
curl -sS -X POST "https://otakunaija.name.ng/api/admin/newsletter/42/action" \
  -H "content-type: application/json" \
  -H "cookie: $ADMIN_COOKIE" \
  -d '{"action":"approve"}'

# five recipients only
curl -sS "https://otakunaija.name.ng/api/cron/newsletter?stage=send&limit=5" \
  -H "Authorization: Bearer $CRON_SECRET"
```

5. Send the rest (resume safe: it skips everyone already served for this issue):

```bash
curl -sS "https://otakunaija.name.ng/api/cron/newsletter?stage=send" \
  -H "Authorization: Bearer $CRON_SECRET"
```

6. Two cron-job.org entries, both `GET`, both with the header
   `Authorization: Bearer <CRON_SECRET>`:

| when (Africa/Lagos) | UTC | URL |
| --- | --- | --- |
| 06:30 daily | 05:30 | `https://otakunaija.name.ng/api/cron/newsletter?stage=prepare` |
| 07:00 daily | 06:00 | `https://otakunaija.name.ng/api/cron/newsletter?stage=send` |

7. In the Brevo dashboard, add the webhook
   `https://otakunaija.name.ng/api/webhooks/brevo?secret=<BREVO_WEBHOOK_SECRET>`
   with the events delivered, opened, click, hard bounce, soft bounce, spam,
   unsubscribed, blocked and invalid email.

## 5. What could not be verified here

Brevo delivery, real inbox rendering in Gmail, Outlook and Apple Mail, and the
Groq-written copy (no API key in the sandbox, so the fallback copywriter ran). The
HTML, the layout choice, the selection rules, the send arithmetic and the webhook
handling are covered by the test suite.

# Player diagnosis: play-sourced streams do not start

Branch `player-diagnose-46`, cut from `main` at `f621114`.
Play repo: branch `player-diagnose-46`, cut from `main` at `e339c3d` (this repo's
default branch is `main`; there is no `master`).

Everything below was measured, not inferred, unless it is marked ASSUMED.

## 0. What was actually reachable

Both sites answered from the sandbox, so the chain was walked for real:

| Step | Result |
| --- | --- |
| `GET /api/watch/21-1180?debug=1` | 200, `provider: "ani"`, `type: "hls"`, `streamUrl: "/api/proxy/manifest?u=..."`, 1 subtitle, intro `{11,136}`, outro `{1401,1415}`, `Access-Control-Allow-Origin: *` |
| master manifest | 200, `application/vnd.apple.mpegurl`, CORS ok, 3 `EXT-X-STREAM-INF` levels (1080p first, then 720p, 480p), each URI root-relative `/api/proxy/manifest?u=...` |
| variant playlist | 200, CORS ok |
| first segment | 200, `video/mp2t`, 3,047,480 bytes, first byte `0x47`, CORS ok, `accept-ranges: bytes` |
| same segment with `Range: bytes=0-` | **206**, `content-range: bytes 0-588627/588628` (a different CDN host honoured the range) |
| same segment with `Range: bytes=0-2000000` | 200, whole 3 MB body (that host ignored the range) |
| `OPTIONS /api/watch/21-1180` | 204, `Access-Control-Allow-Headers: Content-Type` only |

**Play is healthy for this episode.** The owner's finding is confirmed independently.
Deployment detail worth recording: play is served by **Cloudflare in front of Railway**
(`server: cloudflare`, `x-railway-request-id`, `x-railway-edge`), not Vercel, so
Part A.4's Vercel limits do not apply to the live service.

## 1. The decisive measurement: `canPlayType`

`components/episodes/video-player.tsx` decided the playback path with

```ts
const nativeHlsSupported = video.canPlayType('application/vnd.apple.mpegurl') !== ''
if (nativeHlsSupported) { setHlsMode('native'); return }   // hls.js never loaded
```

Measured in Chromium 159 (headless, Linux) via Playwright:

| Profile | `canPlayType('application/vnd.apple.mpegurl')` | `MediaSource` |
| --- | --- | --- |
| desktop Chromium, default context | `"maybe"` | present |
| `devices['Pixel 7']` | `"maybe"` | present |
| `devices['iPhone 14']` | `"maybe"` | present |

So the old check was **true on desktop Chrome as well as Android Chrome**, and
hls.js was never used for any HLS stream. It was also true for the emulated
iPhone profile, but that profile is Chromium wearing a Safari user agent, so it
proves nothing about real iOS.

Two further facts keep this honest:

- Native HLS in this Chromium **does** play the real proxied manifest: a `<video
  crossOrigin="anonymous">` pointed straight at the master playlist reached
  `readyState 4`, `duration 1415.66`, no `error`. So the native path is not
  universally broken; it is *unverified and uncontrolled* on Chrome.
- Playwright device emulation changes the user agent, viewport and touch support
  only. It cannot reproduce a real Android media stack, so the value on a real
  phone remains ASSUMED (the owner reports it is non-empty).

The point that survives either way: `canPlayType` returning non-empty is not
evidence that HLS will play, and the player treated it as proof. Choosing hls.js
whenever MSE exists removes the guess.

## 2. What each failure looks like to a viewer

Driven against the live service in real Chromium, plus the code paths read line by line.

| # | Failure | What the code does | What the viewer sees | Mark |
| --- | --- | --- | --- | --- |
| a | normal resolve | 200 → `resolvedPlayback` → hls/native → `canplay` clears the timer | poster, then video plays | VERIFIED (`/episodes/a-good-day-to-ascend/episode-21-11`: `readyState 4`, duration 19:34) |
| b | resolve 404 `EPISODE_NOT_FOUND` / `NO_WORKING_STREAM` | `!response.ok` → throw → `setResolveFailed(true)`, no retry, no code | "This episode is currently unavailable" with no explanation | VERIFIED (`/episodes/maomao-no-hitorigoto-3rd-season/episode-8-35`: watch took **20.3 s** then 404) |
| c | 200 without `streamUrl` | excludes `provider:default`, recurses; second identical answer throws `Missing stream URL`; 1.2 s of "Switching provider..." first | spinner, "Switching provider...", then unavailable | ASSUMED (code path; no live example found) |
| d | manifest without CORS | `fetch` rejects with a `TypeError`, no status → generic throw | unavailable, and the console says nothing useful | ASSUMED for the manifest; the same *class* of response was VERIFIED live on a segment (row g) |
| e | slow resolve (10 s+) | `fetch` had **no client timeout**; spinner stays until the server answers | spinner with no upper bound | VERIFIED as a missing bound (row b's 20.3 s request shows the order of magnitude) |
| f | segments return 403 | hls.js fatal → `handlePlaybackFailure` → exclude provider → re-resolve | "Switching provider..." then either another provider or unavailable | ASSUMED (no 403 observed live) |
| g | platform error with no CORS | response reaches the browser without `Access-Control-Allow-Origin`, so `fetch`/hls.js reports a CORS failure and the real status is lost | unavailable, or a provider switch that throws away a working provider | **VERIFIED live**: `/api/proxy/segment?...seg-f1-00001.html` came back `net::ERR_FAILED` with "blocked by CORS policy" on `by31m.goldenanchor.space`, and the **same URL returned 206 with CORS on retry** |

Row (g) is the intermittent killer: the segment proxy and its Cloudflare/Railway
edge are healthy most of the time, and when an edge error page is returned
without CORS the player cannot tell it apart from a dead provider.

## 3. Every way the chain can fail between "page renders" and "first frame"

| # | Failure | Location | Mark |
| --- | --- | --- | --- |
| 1 | `playId` missing → player silently shows the poster, never tries play | `components/episodes/video-player.tsx:462` (`hasPlayId`) | VERIFIED (code) |
| 2 | `playId` present but play has no such row → 404 | `app/api/watch/[playId]/route.ts:341` (`EPISODE_NOT_FOUND`) | VERIFIED (live, row b) |
| 3 | resolve 5xx / timeout | `video-player.tsx:150` (`if (!response.ok) throw`) | VERIFIED (code) |
| 4 | no `streamUrl` in a 200 | `video-player.tsx:153-176` | ASSUMED (code) |
| 5 | manifest CORS rejection, indistinguishable from offline | `video-player.tsx:150` catch | ASSUMED; class VERIFIED via row g |
| 6 | hls.js fatal error collapses to one retry decision, no `data.type`/`response.code` read | `video-player.tsx:324` (`if (data.fatal) handlePlaybackFailure()`) | VERIFIED (code) |
| 7 | fixed 12 s `readyState <= 1` timer starts before hls.js even loads, cannot tell slow from dead | `video-player.tsx:308-312` | VERIFIED (code) |
| 8 | `canPlayType` false positive skips hls.js entirely | `video-player.tsx:315-318` | VERIFIED (measured, section 1) |
| 9 | Plyr/hls.js DOM race on `<source>` children | `video-player.tsx:367-425`, guarded by `shouldRenderSource` | VERIFIED as guarded (code) |
| 10 | mixed content (https page, http stream) | impossible: play always returns a relative `/api/proxy/*` path | VERIFIED (live) |
| 11 | `crossOrigin="anonymous"` makes every `<track>` a CORS request | `video-player.tsx:492` | VERIFIED; subtitle proxy answers with CORS, and `SUBTITLE_LOAD_ERROR` is now non-fatal |
| 12 | subtitle failure blocks playback | tracks are advisory; a `<track>` error never stops the media element | VERIFIED (code) |
| 13 | `exclude` loop ends "exhausted" while a provider would have worked | `video-player.tsx:240-259` + `resolvePlayback` recursion | VERIFIED (code) |

## 4. `play_id` matching

`app/api/play/episodes/route.ts:23` and `app/api/play/videos/route.ts:29` store the
`playId` string play sends verbatim (`app/api/export/run/route.ts:143`), into
`episodes.play_id` / `videos.play_id` (`lib/db/schema.ts:98,120`, both `text`,
`unique()`). The player trims before use. Live check: `21-1180` resolves, and
`/episodes/a-good-day-to-ascend/episode-21-11` requested `214260-21`, which
answered 200. **No mismatch found.** Two paths can still store a value play
cannot resolve, and neither needs a fix now:

- `app/actions/admin.ts:54` accepts any string from the admin form, untrimmed and
  unvalidated, so a typo becomes a permanent 404.
- `videos.play_id` is used by `app/episodes/movies/[slug]/page.tsx:103`, but play's
  `/api/watch` only looks in `episodes`, so a movie whose `play_id` was never
  mirrored into play's `episodes` table will always 404.

Because A does not prove a mapping break, no audit SQL was added.

## 5. Root cause statement

**Proven:** the player chose its playback path from `canPlayType`, which returns
`"maybe"` on desktop and Android Chromium, so hls.js was never used for HLS
streams and every failure collapsed into one 12 s deadline and one message. That
is why a working stream can present as "unavailable" with no evidence.

**Proven:** a non-2xx edge response on `/api/proxy/segment` can arrive without
CORS, and the player treated that as a dead provider, discarding the provider
that had just resolved.

**Not proven:** that native HLS playback itself is broken on the owner's phone.
This Chromium plays it. Only `PLAYER_MODE` plus `NATIVE_HLS_ERROR` from a real
device will settle that, which is what Part B adds.

**Not the cause:** play's resolve, the manifest, the variant playlist, the
segments, the signed proxy or the CORS on the success path. All verified healthy.

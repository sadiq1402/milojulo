# Architecture

```
RN CLI app ───────────────► Supabase (Mumbai)
   │  direct, under RLS        ├─ Postgres: RLS, PostGIS, pg_cron
   │  + function calls         ├─ Postgres functions (business rules)  ◄── your code
   │                           ├─ Edge Functions (TypeScript)          ◄── your code
   │                           ├─ Realtime (Broadcast, private channels)
   │                           └─ Auth (email OTP, JWT)
   │
   ├── signed URLs ──────────► Cloudflare R2 (photos, chat media)
   └── (admin page, web) ───► Supabase, admin role claim

Edge Functions ──► FCM (HTTP v1)            Auth ──► email provider (API)
```

## Two paths
1. Simple reads and writes (own profile, chat) go straight to Supabase under RLS.
2. Anything privileged is a Postgres function: discovery feed and scoring, connection requests, accept, block, report, age gate and consents (which create the profile), circle join, meetup feedback.
Edge Functions only do what SQL cannot: sign R2 URLs, send push notifications, handle database webhooks, run media checks, perform admin actions.

## Components
- **Auth**: Supabase Auth, email OTP (6-digit code, not magic link). Custom SMTP/HTTP email provider on your own domain with SPF, DKIM, DMARC. Cloudflare Turnstile CAPTCHA, disposable-email blocklist, per-email and per-IP rate limits. Self-declared date of birth, 18+. Label it "email verified" only; the real "Verified" badge is reserved for a later selfie/phone check.
- **Database**: Postgres in Mumbai with PostGIS. Coarse location cell only. Matching is SQL: candidate generation (area/cell, overlapping modes, availability, block exclusion) then scoring.
- **Chat**: client inserts a message with a client-generated UUID; RLS checks participant, accepted connection, no block. Delivery uses Broadcast from database triggers on a private channel per connection, with RLS on `realtime.messages`. Do not use Postgres Changes for chat: it authorises every event per subscriber on a single thread and does not scale with compute. After a reconnect, fetch messages newer than the last seen, then resume the subscription. Typing and presence use Broadcast/Presence (not stored). Read receipts: one `last_read_at` per participant.
- **Media (R2)**: private bucket. Upload: app asks an Edge Function for a short-lived upload link (checks user, file type, size). New photos are live once the upload is confirmed (no pre-approval, decision 15); admins take down reported ones. Download: link issued only after the same visibility and block checks. Profile photos (#35, decision 28) go through the `media` Edge Function: `photo-upload` makes an upload slot and returns a presigned PUT to a staging key `uploads/<member id>/<photo id>.jpg` (JPEG, at most 5 MB, valid 300 s, Content-Type and Content-Length signed, so R2 refuses another type or size); the app PUTs straight to R2; `photo-confirm` checks the staged file with a signed HEAD, copies it server side (S3 CopyObject) to the live key and deletes the staged file, then the photo takes its position (the photo it replaces is deleted from R2, unless an admin took it down: kept as evidence). Upload links never point at a live key, so a still-valid link can't overwrite a live photo. `photo-delete` deletes the Member's own photo through SQL (the profile minimum applies) and then its file; `photo-urls` takes up to 60 photo ids per call (a whole feed page) and returns presigned GETs valid 600 s, leaving out ids the caller may not see. Object keys are `<member id>/<photo id>.jpg`; the app only ever handles photo ids and signed links. R2 requests are signed with a small hand-rolled AWS SigV4 (Web Crypto), no SDK. Chat media (#12) works the same way: `chat-upload` (`connectionId`, `kind` image/video/voice, `contentType`, `size`; image JPEG ≤ 5 MB, video MP4 ≤ 20 MB, voice M4A ≤ 5 MB) makes a slot through `start_chat_upload()` (accepted, unblocked Connection; in a Casual Connection images and video need both sides' Media Consent) and returns its `uploadId` and a presigned PUT to the staging key `uploads/chat/<connection id>/<upload id>.<ext>` (valid 300 s, Content-Type and Content-Length signed); after the PUT, `chat-confirm` checks the staged file with a signed HEAD against the slot's type and size, copies it server side to the live key `chat/<connection id>/<upload id>.<ext>`, deletes the staged file and confirms the slot, returning the `mediaKey`. The app then inserts the message with that key, which the database accepts once, from that sender, for that Connection, kind and type. Chat upload links never point at a live key either, so a still-valid link can't overwrite sent media. `chat-urls` takes up to 60 message ids and returns presigned GETs valid 600 s for the media messages the caller may open (their Connections, no Block, not removed, not expired; in a Casual Connection, images and video only while both sides have Media Consent on, decision 33). Staged uploads that are never confirmed are removed by an R2 lifecycle rule on the `uploads/` prefix (delete after 1 day), set by the founder in the Cloudflare dashboard (supabase/README.md); the function also deletes the staged file of a slot it discards. The function runs with `verify_jwt = false` so it can answer `sign in first` itself; signed-out calls therefore still reach the function and count as invocations before it refuses them. Store `object key + provider` in Postgres so media can move later. Compress images on the phone; chat video up to 30 s and 20 MB, voice notes up to 2 min; chat media deleted after 90 days.
- **Push**: FCM only. The app registers a device token (a React Native Firebase messaging library); an Edge Function sends through the FCM HTTP v1 API (service-account OAuth) from a database webhook. No Expo push service.
- **Mobile app**: React Native CLI (bare) in TypeScript. Supabase JS client with an async-storage session and URL polyfill. Screenshot blocking on Android needs a small native flag-secure module. iOS builds need macOS.
- **Scheduling**: `pg_cron` for SQL jobs (expire Tonight/This-weekend activities). pg_cron schedules SQL only; a job that needs R2 (daily chat media purge) calls its Edge Function over HTTP with the `pg_net` extension.
- **Admin**: Supabase dashboard first; later a small Next.js moderation page using an admin role claim. Every admin action is written to `admin_actions`.

## Limits to design around
- Edge Functions: 2 s CPU per request (async I/O not counted), 256 MB memory, 150 s wall clock on free, 20 MB bundle, outgoing ports 25/587 blocked. Free plan includes 500,000 invocations a month.
- Realtime: Free 200 concurrent connections / 100 msgs per second; Pro with spend cap 500 / 500; Pro without cap and Team 10,000 / 2,500. Adjustable via support. Each foreground user holds one connection.
- Supabase free: 500 MB database, projects pause after about a week of inactivity, no daily backups. Upgrade to Pro before the beta.
- Cloudflare R2 free tier: 10 GB storage, 1M Class A and 10M Class B operations a month, free egress. Cloudflare may require a payment method before the first bucket. Set a billing alert.

## Scaling path (in order)
1. Indexes (match on a coarse cell) and connection pooling.
2. Chat on Broadcast from the start (this is the fix that matters).
3. Raise the Realtime plan limits before a few hundred are online at once.
4. Precompute candidates per user, cache the feed, then a read replica for discovery.
5. Only then consider moving hot paths to a container service. Business rules stay in SQL so they move with Postgres.
Load test with k6 before the beta (several hundred chatters plus feed loads) and watch slow queries.

## Environments and delivery
Supabase CLI for migrations and functions, GitHub Actions for CI, Sentry free plan for crashes, Supabase logs. Schema and infrastructure live in git.

## Costs
About $0 until the beta. Then Supabase Pro about $25/month, plus domain, email provider if the free tier is outgrown, and store fees (Apple $99/year, Google $25 one-time). SMS only if phone verification is added.

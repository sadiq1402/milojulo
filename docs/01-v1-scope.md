# V1 scope: the beta

## In V1
Status as of 2026-10-18: the database (#1) and the app (#33) are built; the Status column names what is still open.

| Area | What ships | Status |
|---|---|---|
| Access | Open sign-up (no invite codes), email OTP, 18+ date-of-birth gate, acceptance of terms, community guidelines and the data notice | Built. Open: Turnstile bot check (#70) and disposable-email blocklist (#71); the documents' texts are drafts in `docs/legal/`, hosted on milojulo.co.in and linked through `consent_documents.url` (decision 64); a lawyer still has to review them |
| Profile | Name, 2 to 4 photos, two short prompts, Modes (Friends, Activities, Dating, Serious, Casual, Networking), own gender plus age-range, gender and distance preferences for the dating modes, optional profession, industry and career stage, about 40 curated interest and activity tags, availability | Built. Open: the catalogs are starters: 14 tags (the mockups' list, not 40), 2 prompt questions, 12 provisional industries |
| Discovery | A "Same Vibe" feed of every Visible Member within the Member's Discover Range (2, 5, 10, 25, 50 or 100 km; default 10) of their phone's location, no Mode overlap needed (every Mode shown, decision 45; requests keep the Casual and Dating rules), ranked by SQL rules with distance as one signal and a templated "Why you match" line. Members the viewer has a waiting request or a Connection with are left out (decision 49). No location from the last 30 days: the Member is not shown and sees nobody, with a way to turn location on (decision 66) | Built |
| Activity board | Post an activity with type, time window, spots and a venue chosen from Google's place search, or a pin dropped on the Google Map and named when the place isn't listed (required; #248, #249, decisions 70, 71), optionally to a Circle; it is placed where the host is when posting, and the board shows Activities within the viewer's Discover Range, nearest first, with a distance band (decision 66). Activities expire automatically once over (a pg_cron job every 15 minutes). Others request to join (cap of 10 per 24 h); accepting a joiner opens a 1:1 chat with the host; everyone who can see it reads the venue's name and address, which open that place in Google Maps when tapped (decisions 69, 70); Activities posted earlier keep their typed venue | Built |
| Dating, Serious and Casual | Three more connection modes. Discover shows these Modes to everyone (decision 45), but a request under Casual needs both to have chosen it; dating modes add age-range, gender and distance preferences, which must fit in both directions. Casual carries an explicit adult-intent label and Media Consent (images and video only after both people allow media in that chat, decision 33) | Built |
| Networking | Professional mode with optional profession and industry (no company field); feed ranked by shared industry and career stage | Built |
| Circles | Small local communities with a place (a place name and a centre point) and an interest, shown within the Member's Discover Range plus any active one they joined (decision 66). Admins create circles (SQL functions, no admin screen); members join, see who else is in the circle and its activities, and can post activities to it | Built |
| Connecting | Request under a Mode either of them chose, with a warning in the app when they share none (decision 63; Casual still only when both chose it, decision 39) and only to a Member inside the sender's Discover Range (decision 43), with a short note; recipient accepts or declines. Chat opens only after mutual acceptance. Either side can propose changing the Mode; the other accepts. Cap of 10 requests per 24 h | Built |
| Chat | 1:1 chat over Supabase Realtime (one private channel per Member, decision 51) with push notifications, image and video sharing, voice notes; video up to 15 s, images up to 2 MB, voice notes up to 2 min, and one photo, video or voice note per chat per sender in any 24 hours (text unlimited), all from a settings row the founder can change without a release (decisions 59, 60); chat media deleted after 90 days | Built |
| Safety | Report and block everywhere, mute, safety centre with first-meet tips, word filter (refuses names, prompt answers and Activity text; messages are delivered and filed as a report), no pre-approval (profiles go live on submission; a profile, photo or Activity reported by 3 Members within 7 days is auto-hidden until an admin looks; messages are never auto-hidden), screenshots blocked in chat on Android (FLAG_SECURE); iOS does nothing and the app never claims otherwise (decision 34) | Built. The banned-terms list starts empty; admins fill it |
| Admin | Report queue with a 24-hour response target, auto-hidden items, recently-joined spot checks, takedown, restore and ban, append-only audit log | Built as SQL: admins read `reports` under RLS and call `admin_takedown`, `admin_restore` and `admin_ban`, each written to `admin_actions`; used from the Supabase dashboard, where the queue and spot checks are table queries (docs/runbooks/moderation.md). No admin screen yet (`apps/admin` is a placeholder). Not built: unbanning (decision 56) |
| Account | In-app account deletion (an hourly purge then erases the Member's R2 media and auth user), pause profile, notification settings, consent withdrawal, request a copy of my data, plus a web deletion page | Built; the web deletion page is milojulo.co.in/delete-account (#98, with an optional reason for leaving). A data copy request is only queued; nothing fulfils it automatically |
| Learning loop | After an activity (or a "We met" in chat) both people answer: did you meet, and keep the connection? A connection counts as kept only when both say yes. A week after a Connection is accepted and both have written, one push asks each side whether they met (decision 53) | Built |

The learning loop gives the North Star metric directly and is cheap (one table, one push, one screen).

## Not in V1 (deferred on purpose)
| Deferred | Why |
|---|---|
| Ticketed events | Run offline events by hand; the app is the invite channel |
| Payments and premium | Prove retention before paywalls |
| LLM features and embeddings | Matching is rule-based SQL; AI becomes one more signal later |
| Selfie or phone verification | Email OTP plus Turnstile and a disposable-email blocklist (both not built yet, #70, #71) and fast report handling cover the first few hundred users; phone at public launch (see open questions for Dating and Casual) |
| Group chat | Extra moderation and realtime complexity |
| Map view | Distance bands are enough; a map would help pinpoint people |
| Incognito and hide-from-coworkers | Needs company data and premium logic |
| Religion and community fields | Privacy and discrimination risk, no help proving connection |
| Referral program | Offline events and word of mouth cover growth for now |
| Web app | Mobile-first; only the admin screen is web |
| Progressive reveal / Blind Match | Blueprint signature features, not in V1 as scoped; decision open |

## Sign-up
Sign-up is open (decision 27): anyone with an email who passes the 18+ gate and accepts the terms, guidelines and data notice becomes a Member. Invite codes were dropped to lower friction for the beta, and nothing in the app limits where Members are; offline events and outreach decide where the beta starts. Bot protection rests on Cloudflare Turnstile and a disposable-email blocklist (#70, #71); neither is built yet, so sign-up has no bot check today. Reviewers get a seeded demo account (the Reviewer Account).

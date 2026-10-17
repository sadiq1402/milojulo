# V1 scope: Pune beta

## In V1
| Area | What ships |
|---|---|
| Access | Open sign-up (no invite codes), email OTP, 18+ date-of-birth gate, acceptance of terms and community guidelines, consent notice |
| Profile | Name, 2 to 4 photos, two short prompts, area (55 Pune neighbourhoods in five zones, nearest one suggested from the phone's location), Modes (Friends, Activities, Dating, Serious, Casual, Networking), own gender plus age-range, gender and distance preferences for the dating modes, optional profession, industry and career stage, about 40 curated interest and activity tags, availability |
| Discovery | A "Same Vibe" feed of every Visible Member within the Member's Discover Range (2, 5, 10, 25, 50 km or anywhere in Pune; default 10) of their phone's location, no Mode overlap needed (every Mode shown, decision 45; requests keep the Casual and Dating rules), ranked by SQL rules with distance as one signal and a templated "Why you match" line. No location permission: the Member's Area centre |
| Activity board | Post an activity with type, area, time window and spots. Tonight and This weekend posts expire automatically. Others request to join (cap of 10 per 24 h); accepting a joiner opens a 1:1 chat with the host |
| Dating, Serious and Casual | Three more connection modes. Discover shows these Modes to everyone (decision 45), but a request under Casual needs both to have chosen it; dating modes add age-range, gender and distance preferences, which must fit in both directions. Casual carries an explicit adult-intent label and consent-aware messaging (images and video only after both people allow media in that chat) |
| Networking | Professional mode with optional profession and industry (company hidden or shown only broadly); feed ranked by shared industry and career stage |
| Circles | Small local communities by neighbourhood and interest. Admins create circles; members join, see who else is in the circle and its activities, and can post activities to it |
| Connecting | Request under one of the other Member's Modes (Casual only when both chose it, decision 39), with a short note; recipient accepts or declines. Chat opens only after mutual acceptance. Either side can propose changing the Mode; the other accepts. Cap of 10 requests per 24 h |
| Chat | 1:1 chat over Supabase Realtime with push notifications, image/video sharing, voice notes |
| Safety | Report and block everywhere, mute, safety centre with first-meet tips, word filter on bios and messages, no pre-approval (profiles go live on submission; anything reported by 3 Members is auto-hidden until an admin looks), no screenshot chat (Android can block; iOS can only detect), report other user |
| Admin | Report queue with a 24-hour response target, auto-hidden items, recently-joined spot checks, takedown and ban tools |
| Account | In-app account deletion plus a web deletion page, pause profile, notification settings |
| Learning loop | After an activity (or a "We met" in chat) both people answer: did you meet, and keep the connection? A connection counts as kept only when both say yes |

The learning loop gives the North Star metric directly and is cheap (one table, one push, one screen).

## Not in V1 (deferred on purpose)
| Deferred | Why |
|---|---|
| Ticketed events | Run offline events by hand; the app is the invite channel |
| Payments and premium | Prove retention before paywalls |
| LLM features and embeddings | Matching is rule-based SQL; AI becomes one more signal later |
| Selfie or phone verification | Email OTP plus Turnstile, a disposable-email blocklist and fast report handling cover the first few hundred users; phone at public launch (see open questions for Dating and Casual) |
| Group chat | Extra moderation and realtime complexity |
| Map view | Distance bands are enough; a map would help pinpoint people |
| Incognito and hide-from-coworkers | Needs company data and premium logic |
| Religion and community fields | Privacy and discrimination risk, no help proving connection |
| Referral program | Offline events and word of mouth cover growth for now |
| Web app | Mobile-first; only the admin screen is web |
| Progressive reveal / Blind Match | Blueprint signature features, not in V1 as scoped; decision open |

## Sign-up
Sign-up is open (decision 27): anyone with an email who passes the 18+ gate and accepts the terms, guidelines and data notice becomes a Member. Invite codes were dropped to lower friction for the beta, so nothing in the app keeps users to two clusters; offline events and outreach do that. Bot protection rests on Cloudflare Turnstile and a disposable-email blocklist (#70, #71). Reviewers get a seeded demo account (the Reviewer Account).

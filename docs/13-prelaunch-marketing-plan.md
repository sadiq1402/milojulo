# Pre-launch plan: Pune, zero budget

Status: proposal for the founder, 2026-10-21. Not a decision. Nothing here changes the product; where it touches a decision or an open question in docs/09 it says so.

Every claim is tagged: **[S]** sourced (link in Sources), **[R]** from this repo, **[I]** my inference, **[V]** you must verify or measure yourself. Search in this session was US-only and several fetches failed, so the outside evidence is thin (see Limits at the end). Treat [I] and [V] as hypotheses, not findings.

## 1. The reframe

The job is not "create hype". The job is to put a few hundred people, in two places close enough together, in front of a feed that is not empty on day one. docs/10 already names the top risks: empty feed, skewed gender mix, fake accounts [R]. Marketing here is supply seeding for those risks, so every tactic below is judged by one question: does it add Members in a cluster, with a sensible gender mix, who will actually show up?

Two facts from the repo shape everything:

1. **The beta is Android only** (decision 8, docs/09) [R]. iPhone users cannot join. The waitlist must ask the phone type and say so plainly, or the first impression is a broken promise. [I] iPhone share among Pune's 18 to 30 year olds is unmeasured here; the waitlist will tell you. [V]
2. **Sign-up has no bot check and the legal texts are placeholders** (#70, #71, docs/09) [R]. So do not publish an open download link before those are fixed. [I] A waitlist then an invite fits this: Firebase App Distribution and the Play closed test are both gated by a tester email list [R: android-distribute.yml, docs/04], so the waitlist can be the gate without changing the product (decision 27 stays as is; this is about how the beta build is handed out, not who may sign up in the product). Founder to confirm.

## 2. What the evidence says (and doesn't)

- **Loneliness is a live local story.** A Pune news piece frames Pune as helping with loneliness while India ranks 2nd among the world's loneliest nations [S: Pune Pulse; headline only, I could not open the article, and the ranking is unverified [V]]. Use as a content angle, not as a statistic until you have the source.
- **People do try to meet in Pune and it's clumsy.** A 2021 r/pune meetup thread: about 20% arrived on time, groups waited in different parts of the park, then moved to a café; one commenter said people without a community "feel lost since they know no one" [S: r/pune thread]. One thread from 2021 is an anecdote. The real work is the interviews in section 5.
- **Supply of organised activity exists** and is the natural partner base: Meetup hiking, running, yoga, football groups; an eChai startup trek at Baner Hills; badminton venues in Wakad (Nav Sahyadri Krida Sankool); Muddie Trails group treks; Pune Startups and Entrepreneurs meetups [S: Meetup, Lyfskills, eChai]. None of these is confirmed active today. [V]
- **Where young professionals are.** Hinjewadi roughly 200,000 IT workers; Hinjewadi plus Kharadi over 400,000, mostly aged 25 to 40, many in rentals and shared housing near coworking hotspots [S: Sobha blog and a developer brochure; both are real-estate marketing, so treat as upper-bound]. No source found for how many are newcomers to Pune. [V]
- **Competitors.** Third-party blogs say bots and fake profiles are about 21% of dating app complaints and match quality 17%, and that reports "lead to nothing" [S: unstar.app; method unchecked, not India-specific]. I could not obtain Play Store reviews for Bumble, Hinge, Tinder or Bumble BFF. [V: see section 5, step 2]. Timeleft (dinners with strangers) operates in 275+ cities by its own account; I found no confirmation of a Pune launch [S: Timeleft; V].

## 3. Cluster recommendation (hypothesis to test, not a finding)

docs/09 leaves the two clusters open. Constraints: Discover Range defaults to 10 km and runs 2 to 50 km [R], so a cluster should be one contiguous area a person can cross in 20 to 30 minutes, with enough people that a 5 to 10 km feed is not empty.

| Candidate | Why | Doubt |
|---|---|---|
| **West belt: Baner, Balewadi, Wakad (Hinjewadi at its edge)** | Contiguous; the blueprint's own list; large IT and rental population [S, R]; activity supply (Baner Hills treks, Wakad badminton) [S] | Hinjewadi commuters live all over; Baner is expensive, so audience skews to higher income [I] |
| **East: Kharadi (with Viman Nagar if students are wanted)** | EON IT Park is a large employer [S]; a distinct second cluster | Kharadi to Baner is a long cross-city trip, so the two clusters will not overlap. That's fine for the beta and should be said out loud. |
| **Student areas** (Kothrud, FC Road, Viman Nagar) | Easy to reach, high social density [I] | Not in the blueprint's list; Dating and Casual raise age-gate and store exposure with a student crowd [R: docs/04]. Defer unless interviews point here. |

**Test before committing:** the waitlist asks for neighbourhood. After 2 weeks, take the two clusters with the most sign-ups that are also contiguous. If sign-ups are scattered across 20+ neighbourhoods, the cluster is not forming yet and more offline concentration is needed, not more reach.

## 4. Channels scored (ICE: impact x confidence x ease, each 1 to 10; scores are my judgement [I], re-score after week 1; highest first: interviews 432, own meetups 336, co-hosted activities 270)

| Channel | Impact | Confidence | Ease | Score | Assumption it rests on |
|---|---|---|---|---|---|
| Co-hosted activities with existing groups (trek, badminton, run clubs) | 9 | 6 | 5 | 270 | An organiser lets you pitch for 5 minutes and collect waitlist sign-ups on the spot |
| Own small meetups (coffee, board games, walks) in the chosen clusters | 8 | 7 | 6 | 336 | You can get 10 to 20 strangers to show up with zero ad spend |
| Interview-to-waitlist (every interviewee joins and forwards to two people) | 6 | 8 | 9 | 432 | People you interview in the target group are willing to sign up |
| Café, coworking and gym partnerships (board, QR, host a meetup) | 7 | 5 | 6 | 210 | A venue gains footfall from your meetup nights |
| Instagram Reels and Stories on "making friends in Pune after college" | 6 | 4 | 7 | 168 | Organic reach in Pune is enough; a founder face beats a brand |
| Reddit (r/pune etc.) and local WhatsApp or Telegram groups | 5 | 4 | 6 | 120 | Posts are welcome, not removed as self-promotion. Read each group's rules first. [V] |
| College ambassadors | 6 | 4 | 5 | 120 | Students want a role; risk: age-gate and Dating-mode exposure |
| Micro-influencers (blueprint phase 1) | 7 | 3 | 3 | 63 | Free collaboration; you have no budget, so only offer early access and a real event |
| Paid ads | n/a | n/a | n/a | skip | Budget is zero. Also, Meta's dating-ad policy requires prior written permission and 18+ targeting [S]; with Dating, Serious and Casual in the app, treat an ad account as at risk until Meta confirms. A third-party tracker says the permission rule was removed in July 2026; unverified [V] |
| Posters and flyers | 4 | 5 | 6 | 120 | Only with permission. Unauthorised posters and banners are an offence under the Maharashtra Defacement of Property Act, 1995; Pune civic body has filed criminal cases and reports fines of ₹1,000 to ₹15,000 per display (figures conflict) [S]. Use café notice boards and partner-owned QR stands instead. |

Lead with Friends and Activities in all outward messaging, as the blueprint phase 1 says [R: blueprint 19]. Do not advertise Dating or Casual: it narrows the audience, raises ad and store exposure [R: docs/04], and the platform rules above apply.

## 5. Four-week experiment plan

Rules: one hypothesis per experiment, a threshold set before you start, a stop rule. The thresholds are **proposals** to replace docs/09's open "numeric go/no-go thresholds" item; the founder sets the real ones.

**Tracking setup (day 1, about 2 hours):** a one-page site on Carrd or a Tally form (free tiers [V]). Fields: email, neighbourhood (dropdown of the 55 areas from the app), what you want (Friends, Activities, Dating, Serious, Casual, Networking), Android or iPhone, how you heard. Every link carries `?utm_source=<channel>&utm_campaign=<experiment>`. Put the sheet in Google Sheets. Add the data notice line (what you collect, why, how to be deleted; DPDP main obligations apply from 13 May 2027 [R: docs/04], but be tidy now). No analytics SDK needed.

| Week | Experiment | Hypothesis | Threshold | Stop rule |
|---|---|---|---|---|
| 1 | **E1 Interviews.** 15 to 20 people, 18 to 30, in the candidate clusters (script below). Also validate Orchid pop with 5 to 8 women (docs/09) in the same sessions | Newcomers want to meet people but find it awkward or unsafe; at least 6 of 15 say they'd try something like this | ≥ 6 of 15 unprompted mention of "hard to meet people"; ≥ 10 of 15 join the waitlist | If fewer than 4 of 15 recognise the problem, stop and rethink the audience before anything else |
| 1 | **E2 Play Store mining.** 1 to 3 star recent reviews of Bumble, Hinge, Tinder, Bumble BFF; filter "fake", "bot", "report", "safe" | The top complaints are fake profiles and ignored reports | Top 3 themes written up with 10 quotes each | n/a, one pass |
| 2 | **E3 Co-hosted activity.** Pitch one trek, badminton or run organiser; table at their event with the QR | An organiser says yes to a 5-minute pitch; ≥ 20 sign-ups from one event | ≥ 20 sign-ups, ≥ 60% naming a cluster neighbourhood | After 5 organisers pitched and 0 yes, the offer is wrong; change the offer |
| 2 | **E4 Own meetup #1** (coffee or board games, 10 to 20 people, free, at a partner café) | You can fill it without ads | ≥ 12 RSVPs, ≥ 60% show up | If show-up is < 40%, change format or time before running #2 |
| 3 | **E5 Reels test.** 6 short Reels in 2 weeks on one theme; one with the founder on camera | Founder-led content gets sign-ups, not just views | ≥ 15 sign-ups attributable to Instagram links | If 0 attributable sign-ups after 6 posts, drop Reels and move that time to meetups |
| 3 | **E6 Community posts.** 2 to 3 posts in groups whose rules allow it | Posts bring sign-ups without a ban | ≥ 10 sign-ups, no removals | One removal: stop in that group |
| 4 | **E7 Partner venues.** 3 cafés or coworking spaces, one QR board each, host one meetup night each | At least 2 say yes; their board produces ≥ 5 sign-ups each in 2 weeks | ≥ 2 partners live | n/a |
| 4 | **E8 Gender mix check.** Look at who signs up | Women are ≥ 40% of the waitlist in each cluster | ≥ 40% women per cluster | Below 30%: pause the channel that skews it; recruit through women-led groups and venues. Gender mix is a known beta risk [R: docs/10] |

**Interview script (Mom Test style).** Ask about the past, not the product.
1. "Tell me about the last time you wanted to meet someone new in Pune. What happened?"
2. "What did you try? What did it cost you (time, money, awkwardness)?"
3. "Have you used an app or group for it? What went wrong?"
4. "What would make meeting a stranger feel safe enough to actually go?"
5. "Who else do you know who feels this? Can you introduce me?"
Do not describe MiloJulo until the end. Record what they did, not what they say they would do. Ask women specifically about safety (point 4) and about what shows up in their feed today.

## 6. Offline launch plan

1. **First meetup (week 2):** coffee or board games, a partner café, 10 to 20 people, free. Founder greets at the door. Share the community guidelines at the start and name one person to contact for safety, in line with docs/04's tone.
2. **Co-host a recurring activity with an existing group** (trek or badminton): you bring the people and the sign-up, they bring the activity.
3. **Partner venues:** offer a free monthly meetup night in exchange for a QR board. Ask them first, in person.
4. **Permission-safe posters:** only in places that allow notice boards; never on public walls, poles or flex boards.
5. **Closing the loop:** every attendee is invited to the waitlist and asked "who would you bring?" That is word of mouth, not an in-app referral program (deferred in docs/01; if you want a formal "invite a friend" mechanic, that is a new decision for docs/08).

## 7. Trust and policy

- **Women-first safety message.** Lead with what is built and true: report and block everywhere, a 24-hour report response target, auto-hide on 3 reports, first-meet tips in the Safety centre [R: docs/01, docs/04]. Do not claim "verified" (email OTP only), and do not claim screenshots are blocked on iPhone (decision 34). Do not promise approval of profiles; there is none (decision 15).
- **Google Play.** Dating and social apps must prohibit CSAE in published standards and self-certify an in-app reporting mechanism; dating-main-purpose apps must use the Restrict Minor Access tool [S: Google support pages via search; verify exact wording and any 26 Aug 2026 deadline changes against Google's own page [V]]. A personal account needs the 12-tester, 14-day closed test (docs/04) [R]; the waitlist is a ready source of testers.
- **Meta ads.** See section 4: skip ads. Organic Instagram posts are fine; just don't advertise Dating.
- **Privacy.** The waitlist is personal data. Collect only what section 5 lists, store it in one sheet, and delete anyone who asks.
- **Pre-launch blockers the marketing depends on** (from docs/10 [R]): final terms and guidelines, Turnstile (#70) and the email blocklist (#71) before any open link, web deletion page (#98), Play listing. Marketing can start before these; sign-ups through an open link cannot.

## 8. Pre-mortem: top five ways this fails

1. **Empty feed on day one.** Sign-ups scatter over many neighbourhoods and no cluster reaches density. *Guard:* E1 and the neighbourhood field; announce the beta only to the clusters that crossed the threshold.
2. **Male-heavy mix** (a known risk [R: docs/10]). *Guard:* E8; recruit through women-led groups, venues and events; hold invites in a cluster until the mix recovers.
3. **iPhone people sign up and can't join.** *Guard:* ask the phone type up front; keep an honest "iPhone later" list; this is also the data for the iOS decision in docs/09.
4. **Fake or spam sign-ups arrive before the bot check exists.** *Guard:* waitlist then invite only; ship #70 and #71 first.
5. **Founder bandwidth.** Meetups, interviews and content eat the build and moderation time. *Guard:* cap it (suggest 6 hours a week, I'm guessing [V]); drop the lowest-scoring channel after week 2 rather than adding one.

## 9. How we'll know it's right (outside our own opinion)

Set these numeric lines yourself in docs/09; the ones below are proposals.

| Signal | Who or what produces it | Proposed bar |
|---|---|---|
| Strangers sign up | Waitlist rows, by channel and neighbourhood | ≥ 300 sign-ups from outside your network, ≥ 120 in each chosen cluster |
| Gender mix | Waitlist | ≥ 40% women per cluster |
| People show up | Meetup and event attendance counts | ≥ 60% of RSVPs attend |
| Third parties commit | Organisers and venues saying yes | ≥ 3 organisers and ≥ 2 venues |
| Blind reaction | 5 target users (not interviewed before) read the landing page and describe it in their own words | ≥ 4 of 5 say it's for making friends or meeting people for activities, not only dating |
| Safety review | A Pune community organiser or moderator reads the safety messaging | No major concern; list of changes |
| Policy | Google Play closed-test and listing review outcome | Passes without a rejection for dating or UGC |
| Post-launch | Invite-to-install rate, week-1 activation, kept connections [R: North Star] | Replace with your docs/09 thresholds |

## 10. What I need from you

- Pick the two clusters after E3 and E4 (section 3), or tell me you have already decided. Docs/09 item.
- Confirm the waitlist-then-invite approach is consistent with decision 27, or tell me the beta link is meant to be public.
- Confirm Android only is fine for the waitlist message (decision 8).
- Do the interviews, the Play Store review pull and the first meetup; I can't.
- Decide whether a "bring a friend" mechanic is wanted (new decision).

## Limits of this research

- Search was US-only and several fetches (Pune Pulse, Meta's dating-ad page) failed on network errors, so those points rest on search snippets. I could not read Play Store reviews, Instagram, Reddit's live pages or Meta's page directly.
- The one r/pune thread is from 2021. No current Pune community count, rental share or iPhone share was found.
- Pricing of Carrd, Tally and similar tools is from memory. [V]
- ICE scores, cluster ranking, thresholds and the 6 hours a week cap are my judgement, not data.

## Sources

- [r/pune meetup thread, Oct 2021](https://redlib.belloworld.it/r/pune/comments/qbgtny/reddit_pune_meetup/hkl3hxw/?context=3)
- [Pune Pulse: Pune and loneliness](https://www.mypunepulse.com/?p=203014) (snippet only)
- [Meetup: Pune](https://pro.meetup.com/find/in--pune/), [Lyfskills: Nav Sahyadri Krida Sankool](https://discover.lyfskills.com/listing/41579), [eChai: Pune communities](https://echai.ventures/grid/pune/communities), [Pune travel club](https://meetup.com/pune_travel_club)
- [Sobha: Pune workforce and housing](https://www.sobha.com/blog/pune-workforce-residential-housing-demand/), [Paranjape Xion brochure](https://www.slideshare.net/slideshow/paranjape-xion-brochure-zrickscom/70239854)
- [unstar.app: dating app scams and bots](https://unstar.app/blog/dating-app-scams-tinder-bumble-hinge-bots-catfishing-2026), [Indie Hackers: 730 dating app complaints](https://www.indiehackers.com/post/dating-app-what-730-user-complaints-reveal-about-the-market-8b861346e8)
- [Meta: Dating ads policy](https://transparency.meta.com/policies/ad-standards/restricted-goods-services/dating-ads/), [ConductAtlas tracker (unverified)](https://conductatlas.com/platform/meta-ads/meta-advertising-policies/prior-written-permission-requirements/)
- [Free Press Journal: PMC permissions for banners](https://www.freepressjournal.in/amp/pune/pmc-mandates-permissions-for-banners-hoardings-in-pune-pcmc-launches-crackdown-in-pimpri-chinchwad), [Punekar News: PMC cases for defacement](https://www.punekarnews.in/pune-pmc-to-file-cases-against-110-for-defacing-public-spaces-with-unauthorized-advertisements/), [Punekar News: ₹15,000 flex fine](https://www.punekarnews.in/pmc-to-impose-rs-15000-fine-for-illegal-flex-boards-in-pune/)
- [Google Play support: child safety and age-restricted policy](https://support.google.com/googleplay/android-developer/answer/14747720?hl=en), [ecorpit summary (secondary)](https://ecorpit.com/google-play-anonymous-chat-age-restricted-policy-august-2026/)
- [Timeleft launch post](https://timeleft.com/post/back-to-basics-timeleft-launches-its-unique-dinners-in-paris/)
- Repo: docs/00, 01, 04, 09, 10, reference/blueprint.md (sections 18 to 20), CLAUDE.md

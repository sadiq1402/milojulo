# Build plan

The original plan assumed 15 to 20 hours a week: about eleven build weeks, then a five-week closed beta. Scope has since grown (Dating, Serious, Casual, Networking, Circles, media in chat), so treat the build weeks as a floor and re-estimate. Build each mode behind a switch; open modes to the beta in stages if time runs short. Never cut: safety items, the learning loop, RLS tests.

| Weeks | Stage | Done when |
|---|---|---|
| 1 | Foundations | Supabase project, migrations and CI run; a signed-in hello screen works; a hello-world Edge Function is deployed |
| 2 to 4 | Onboarding, profile, photos | Email OTP, the age gate and consents, and a profile with photos work end to end; a submitted profile appears in Discover; an admin can take down a photo and ban |
| 5 to 7 | Discovery and activity board | Same Vibe feed with Why you match; activities can be posted and joined; requests can be sent and accepted |
| 8 to 9 | Chat, safety tools, deletion | Chat with push works; report, block and mute work; moderation queue usable; accounts can be deleted in the app and on the web |
| 10 to 11 | Tests, policies, store listing | RLS tests pass in CI; learning loop works; terms, privacy notice and consent live; Play listing and Data safety form complete |
| 12 to 16 | Closed beta and Play test | 12+ testers opted in for 14 days; weekly user calls; metrics reviewed against thresholds |

## Status (2026-10-18)
The build stages (weeks 1 to 11) are done apart from the items below: the database (#1) and the app (#33) were closed as complete. RLS tests (`db-tests`), app tests (`app-checks`, `app-integration`) and Edge Function tests (`function-tests`) run in CI; merges to `main` deploy migrations and Edge Functions (deploy.yml) and send an Android build to testers through Firebase App Distribution (android-distribute.yml).

Still to do before the closed beta:
- [ ] Remove a taken-down message from open chats live (#163).
- [ ] Bot check (#70) and disposable-email blocklist (#71) on sign-up; both wait on founder input.
- [ ] Web account deletion page (#98); waits on hosting and domain.
- [ ] Report evidence retention and cleanup (#160); waits on the retention period.
- [ ] Moderation is usable from the Supabase dashboard only (admin SQL functions); the admin page in `apps/admin` is not started.
- [ ] Terms, community guidelines and data notice texts, lawyer-reviewed, with URLs in `consent_documents` (the app links placeholders today).
- [ ] Google Play: developer account, listing, Data safety form, and a release signing key (dev builds use the debug keystore).
- [ ] Load test with k6 and upgrade to Supabase Pro before real users (docs/02).
- [ ] Beta metric thresholds, the two clusters and the open questions in docs/09.

## First week (do these first)
- [x] Create the Supabase project (Mumbai), the Git repo, the migrations folder and CI (#2; supabase/config.toml, .github/workflows).
- [x] Bootstrap the app: `npx @react-native-community/cli@latest init MiloJulo` in `apps/mobile`, add `@react-native-community/cli` as a devDependency, set up the Android toolchain (Android Studio, JDK, SDK, emulator) and confirm a debug build runs (#34).
- [x] Register the domain and connect an email provider: `milojulo.co.in` on Cloudflare, verified in Resend (PR #78). DMARC is not recorded in the repo; check it.
- [x] Deploy a hello-world Edge Function in TypeScript and call a Postgres function from the app with RLS on (superseded: the real `media`, `push`, `account-purge` and `purge-chat-media` functions deploy on merge).
- [x] Create a Firebase project for FCM and add the Android `google-services.json` (#36).
- [x] Create a Cloudflare account and a private R2 bucket (#35).
- [ ] Set an R2 billing alert (not recorded in the repo; check).
- [ ] Start the Google Play developer registration (identity verification takes time).
- [ ] Draft community guidelines and the outreach plan for the first offline event.

## Beta metrics (set numeric thresholds first)
Weekly meaningful connections (North Star), request accept rate, conversation start rate (both sides send a message), activities that happened, retention at day 7 and 30, safety (reports per 100 active users, median hours to resolve, safety-satisfaction survey), gender and cluster balance.

## Top risks
Empty feed (low density), safety incident, moderation overload, RLS leak, fake accounts, skewed gender mix, store rejection, free-tier limits, single-vendor dependency, solo-founder bandwidth, scope growth, R2 billing and media access control.

## Suggested first prompts for Claude Code
1. "Read CLAUDE.md and docs/10-build-plan.md. Propose the repo layout, the React Native CLI bootstrap and CI for the first-week tasks, then wait for approval."
2. "Write migration 0001: profiles, tags, profile_tags, availability, consents with RLS default-deny, plus pgTAP tests for each policy."
3. "Write is_blocked(), discover_feed() and match_reason() with tests that prove blocked, paused, hidden and unsubmitted Members never appear."
4. "Write the Edge Function that signs R2 upload and download URLs, checking visibility and block status first."

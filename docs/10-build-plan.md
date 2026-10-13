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

## First week (do these first)
- [ ] Create the Supabase project (Mumbai), the Git repo, the migrations folder and CI.
- [ ] Bootstrap the app: `npx @react-native-community/cli@latest init MiloJulo` in `apps/mobile`, add `@react-native-community/cli` as a devDependency, set up the Android toolchain (Android Studio, JDK, SDK, emulator) and confirm a debug build runs.
- [ ] Register the domain and connect an email provider with SPF, DKIM, DMARC.
- [ ] Deploy a hello-world Edge Function in TypeScript and call a Postgres function from the app with RLS on.
- [ ] Create a Firebase project for FCM and add the Android `google-services.json`.
- [ ] Create a Cloudflare account and a private R2 bucket; set a billing alert.
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

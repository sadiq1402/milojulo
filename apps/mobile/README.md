# MiloJulo mobile app

React Native CLI (bare workflow) with TypeScript. No Expo, no EAS (CLAUDE.md hard rule 11). Android first; iOS builds need macOS.

## Set up

1. Node 22.11 or newer (`engines` in package.json; `mobile.yml` uses Node 22). Android toolchain: JDK 17, the Android SDK (`ANDROID_HOME` set, `platform-tools` on `PATH`) and an emulator or a USB device.
2. `npm install` in this folder. It also creates `src/config/env.ts` from `env.example.ts` (gitignored).
3. Local Supabase, from the repo root: `npx supabase start` (Docker). `npx supabase status` prints the API URL and keys.
4. Put the anon key in `src/config/env.ts`. The URL depends on where the app runs:
   - Android emulator: `http://10.0.2.2:54321` (the emulator's address for your computer)
   - USB device: `adb reverse tcp:54321 tcp:54321`, then `http://127.0.0.1:54321`
5. Push notifications (#36) need `android/app/google-services.json` (gitignored; the Android build fails without it). Download it from the Firebase console: Project settings → Your apps → the Android app `co.in.milojulo` → `google-services.json`, and put it in `android/app/`.
6. `npm start` (Metro) and, in another terminal, `npm run android`.

Photo and chat media uploads need the `media` Edge Function served with R2 secrets (see supabase/README.md). Without them, finish profile setup locally by giving your account two confirmed photos with `scripts/dev/confirmed_photos.sql` (instructions inside; local only).

Sign in with any email: the code arrives in the local mail catcher at http://127.0.0.1:54324. A new account goes to Age and consent, then the five profile setup steps; a Member with a Submitted Profile lands on the tabs (after the location ask, when due).

## Scripts

| Script                     | What it does                                                                     |
| -------------------------- | -------------------------------------------------------------------------------- |
| `npm start`                | Metro bundler                                                                    |
| `npm run android`          | Build and install the Android app (`npm run ios` exists but needs macOS)         |
| `npm run lint`             | ESLint and Prettier check                                                        |
| `npm run typecheck`        | TypeScript                                                                       |
| `npm test`                 | Component tests (Jest and React Native Testing Library)                          |
| `npm run test:integration` | Data modules against the local Supabase stack (needs `npx supabase start`)       |
| `npm run gen:types`        | Regenerate `src/lib/database.types.ts` from the local database after a migration |

## Layout

- `src/theme`: re-exports `design/tokens.ts` (Metro watches `design/`), text styles and `shadow()`. Never hard-code sizes or colours; add a token instead.
- `src/components`: shared components from `design/README.md`, built to docs/05-ui-standards.md (48 hit areas via hit slop).
- `src/features/<feature>/`: the data modules, the only code that talks to Supabase. Mostly `api.ts` (with `queries.ts` for the TanStack Query hooks screens use); the exceptions are `live/memberChannel.ts` (the Member's Realtime channel) and `media/mediaFunction.ts` and `chat/media.ts` (calls to the media Edge Function).
- `src/lib`: the Supabase client (`supabase.ts`), the query client and its on-phone cache (`persistCache.ts`), generated `database.types.ts`, and `secureScreen.ts` (Android screenshot blocking through the in-repo native module in `android/app/src/main/java/com/milojulo/securescreen`).
- `src/navigation`: `RootNavigator` picks the signed-out stack (Welcome, Email, Otp), onboarding (Age and consent, then profile setup), the re-consent stack, or a Member's app; `MemberNavigator` has the five tabs and the screens pushed over them. docs/07-screens.md lists every screen.
- `src/screens`: one folder per area (gettingIn, profileSetup, location, discover, profile, requests, inbox, chat, activities, circles, meetFeedback, reports, me, account).

## Tests

The seam is the feature data module.

- Component tests (`__tests__/`) render the app or a component and mock `src/features/*/api`; `src/lib/supabase` is stubbed so they never reach the network. `test/render.tsx` renders the whole app with a given session.
- Integration tests (`__integration__/`) call the real data modules against local Supabase, reading sign-in codes from the mail catcher. They take the URL and keys from `npx supabase status` unless `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `MAILPIT_URL` are all set.
- CI (`.github/workflows/mobile.yml`) runs lint, typecheck and the component tests, then the integration tests against a local stack, on pull requests and pushes to `main` that touch `apps/mobile`, `design` or `supabase`.

## Fonts

Static Bricolage Grotesque (Bold) and Figtree (Regular, Medium, SemiBold, Bold) TTFs are in `android/app/src/main/assets/fonts` with their OFL licences; Android uses the file name as the font family. iOS still needs them added to the Xcode project and `UIAppFonts` (needs macOS).

## Conventions

- Ask before adding any dependency; a native module must autolink with the CLI.
- Function errors arrive as plain messages (for example `you have sent 10 requests in the last 24 hours`). The feature's data module maps each to friendly copy (exported when a screen needs to recognise it, like `cannotSendMessage`), so screens just show `error.message`.
- Media is never shown by public URL; photos come from signed URLs issued by the media Edge Function.

## Distributing dev builds (Firebase App Distribution)

`.github/workflows/android-distribute.yml` builds a release APK (arm64 only) and sends it to Firebase App Distribution. Run it by hand when testers need a build: `gh workflow run android-distribute.yml --ref main`, or the Actions tab. It ran on every merge touching `apps/mobile/**` until 2026-10-26, at about 20 Actions minutes a time. Testers get a notification and install with one tap — no Play Store. The APK targets the hosted Supabase project and is signed with the shared debug keystore, so each build updates the app in place.

App package id: `co.in.milojulo`. Requires three GitHub Actions secrets:

- `FIREBASE_APP_ID` — the Android app id from Firebase (e.g. `1:…:android:…`).
- `FIREBASE_SERVICE_ACCOUNT` — the full JSON of a Firebase service account (Project settings → Service accounts → Generate new private key).
- `GOOGLE_SERVICES_JSON` — the full contents of `google-services.json` (see Set up, step 5); the workflow writes it to `android/app/` before building.

In Firebase App Distribution, create a tester group named `devs` and add the tester emails. A real upload key replaces the debug keystore when the app goes to the Play Store.

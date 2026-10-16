# MiloJulo mobile app

React Native CLI (bare workflow) with TypeScript. No Expo, no EAS (CLAUDE.md hard rule 11). Android first; iOS builds need macOS.

## Set up

1. Android toolchain: JDK 17, the Android SDK (`ANDROID_HOME` set, `platform-tools` on `PATH`) and an emulator or a USB device.
2. `npm install` in this folder. It also creates `src/config/env.ts` from `env.example.ts` (gitignored).
3. Local Supabase, from the repo root: `npx supabase start` (Docker). `npx supabase status` prints the API URL and keys.
4. Put the anon key in `src/config/env.ts`. The URL depends on where the app runs:
   - Android emulator: `http://10.0.2.2:54321` (the emulator's address for your computer)
   - USB device: `adb reverse tcp:54321 tcp:54321`, then `http://127.0.0.1:54321`
5. Push notifications (#36) need `android/app/google-services.json` (gitignored; the Android build fails without it). Download it from the Firebase console: Project settings → Your apps → the Android app `co.in.milojulo` → `google-services.json`, and put it in `android/app/`.
6. `npm start` (Metro) and, in another terminal, `npm run android`.

Photo uploads need the media Edge Function with R2 secrets. Without them, finish profile setup locally by giving your account two confirmed photos with `scripts/dev/confirmed_photos.sql` (instructions inside; local only).

Sign in with any email: the code arrives in the local mail catcher at http://127.0.0.1:54324. A new account lands on the hello screen (onboarding); a Member with a Submitted Profile lands on the tabs.

## Scripts

| Script                     | What it does                                                                     |
| -------------------------- | -------------------------------------------------------------------------------- |
| `npm run lint`             | ESLint and Prettier                                                              |
| `npm run typecheck`        | TypeScript                                                                       |
| `npm test`                 | Component tests (Jest and React Native Testing Library)                          |
| `npm run test:integration` | Data modules against the local Supabase stack (needs `npx supabase start`)       |
| `npm run gen:types`        | Regenerate `src/lib/database.types.ts` from the local database after a migration |

## Layout

- `src/theme`: re-exports `design/tokens.ts` (Metro watches `design/`), text styles and `shadow()`. Never hard-code sizes or colours; add a token instead.
- `src/components`: shared components from `design/README.md`, built to docs/05-ui-standards.md (48 hit areas via hit slop).
- `src/features/<feature>/api.ts`: the only code that talks to Supabase for that feature. Screens call these through TanStack Query.
- `src/navigation`: signed-out stack, onboarding stack and the five tabs, chosen from the session and the Member's own profile row.
- `src/screens`: placeholders until each screen ticket lands.

## Tests

The seam is the feature data module.

- Component tests (`__tests__/`) render the app or a component and mock `src/features/*/api`; `src/lib/supabase` is stubbed so they never reach the network. `test/render.tsx` renders the whole app with a given session.
- Integration tests (`__integration__/`) call the real data modules against local Supabase, reading sign-in codes from the mail catcher.

## Fonts

Static Bricolage Grotesque (Bold) and Figtree (Regular, Medium, SemiBold, Bold) TTFs are in `android/app/src/main/assets/fonts` with their OFL licences; Android uses the file name as the font family. iOS still needs them added to the Xcode project and `UIAppFonts` (needs macOS).

## Conventions

- Ask before adding any dependency; a native module must autolink with the CLI.
- Function errors arrive as plain messages (for example `you have sent 10 requests in the last 24 hours`). The feature's data module maps each to friendly copy (exported when a screen needs to recognise it, like `cannotSendMessage`), so screens just show `error.message`.
- Media is never shown by public URL; photos come from signed URLs issued by the media Edge Function.

## Distributing dev builds (Firebase App Distribution)

`.github/workflows/android-distribute.yml` builds a release APK and sends it to Firebase App Distribution on every push to `main` that touches `apps/mobile/**`. Testers get a notification and install with one tap — no Play Store. The APK targets the hosted Supabase project and is signed with the shared debug keystore, so each build updates the app in place.

App package id: `co.in.milojulo`. Requires three GitHub Actions secrets:

- `FIREBASE_APP_ID` — the Android app id from Firebase (e.g. `1:…:android:…`).
- `FIREBASE_SERVICE_ACCOUNT` — the full JSON of a Firebase service account (Project settings → Service accounts → Generate new private key).
- `GOOGLE_SERVICES_JSON` — the full contents of `google-services.json` (see Set up, step 5); the workflow writes it to `android/app/` before building.

In Firebase App Distribution, create a tester group named `devs` and add the tester emails. A real upload key replaces the debug keystore when the app goes to the Play Store.

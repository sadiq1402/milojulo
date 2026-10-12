# MiloJulo mobile app

React Native CLI (bare workflow) with TypeScript. No Expo, no EAS (CLAUDE.md hard rule 11). Android first; iOS builds need macOS.

## Set up

1. Android toolchain: JDK 17, the Android SDK (`ANDROID_HOME` set, `platform-tools` on `PATH`) and an emulator or a USB device.
2. `npm install` in this folder. It also creates `src/config/env.ts` from `env.example.ts` (gitignored).
3. Local Supabase, from the repo root: `npx supabase start` (Docker). `npx supabase status` prints the API URL and keys.
4. Put the anon key in `src/config/env.ts`. The URL depends on where the app runs:
   - Android emulator: `http://10.0.2.2:54321` (the emulator's address for your computer)
   - USB device: `adb reverse tcp:54321 tcp:54321`, then `http://127.0.0.1:54321`
5. `npm start` (Metro) and, in another terminal, `npm run android`.

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
- Function errors arrive as plain messages (for example `you have sent 10 requests in the last 24 hours`). The feature's data module maps each to friendly copy (exported when a screen needs to recognise it, like `invalidInviteMessage`), so screens just show `error.message`.
- Media is never shown by public URL; photos come from signed URLs issued by the media Edge Function.

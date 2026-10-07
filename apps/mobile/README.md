# Mobile app (placeholder)

React Native CLI (bare workflow) with TypeScript. Decided: no Expo, no EAS.

## Bootstrap
```
cd apps/mobile
npx @react-native-community/cli@latest init MiloJulo --directory .
npm i -D @react-native-community/cli      # keep it as an explicit devDependency
npx @react-native-community/cli run-android
```
(The old `npx react-native init` is deprecated.) Android first; iOS needs macOS.

## Conventions
- Import design tokens from `design/tokens` (colours, spacing, radius, type, sizes). Hit area 48 with hit slop where the visual is smaller.
- Supabase client: `@supabase/supabase-js` with an async-storage session and a URL polyfill; Realtime for chat (Broadcast from database, private channels).
- Push: FCM through a React Native Firebase messaging library; the Edge Function sends via the FCM HTTP v1 API.
- Android screenshot blocking: a small native flag-secure module on chat screens (iOS can only detect screenshots).
- Ask before adding any native dependency; it must autolink with the CLI.

Suggested structure: `src/theme`, `src/components`, `src/features/{auth,profile,discover,activities,circles,inbox,chat,safety,settings}`, `src/lib/supabase.ts`.

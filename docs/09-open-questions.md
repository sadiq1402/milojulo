# Open questions (do not assume; ask)

## Build-affecting
- [ ] **Progressive reveal and Blind Match.** Blueprint signature features; V1 as scoped shows names and photos as soon as a profile is submitted. Decide whether a light version is in V1.
- [x] **Chat media moderation and retention:** decided 2026-10-07 (Decision 17): report-only; video 30 s / 20 MB, voice 2 min; chat media deleted from R2 after 90 days (built, #97). Amended by decision 55: nothing is copied; reported media is kept at its original key.
- [x] **Report evidence retention (#160):** decided 2026-10-25 (decision 62): the media is copied to an `evidence/` prefix when the report is made, and the copy is deleted 90 days after the report unless the report is still open or an admin holds it. A scheduled job does the deleting; not built yet (#160).
- [ ] **Verification for Dating and Casual:** is email OTP with open sign-up (decision 27) and after-the-fact moderation enough (manual approval was dropped in decision 15), or must phone or selfie verification come first?
- [ ] **Circle conversation:** built activities-only (tap a member, send a request, chat 1:1 after acceptance; decision 31). Confirm that, or add a text-only circle chat later (group chat is outside V1).
- [x] **Screenshot blocking:** decided 2026-10-15 (Decision 34): Android blocks screenshots in chat screens (FLAG_SECURE); iOS does nothing and the app never claims they are blocked there.

- [ ] **iOS build path.** React Native CLI means iOS needs macOS: buy or borrow a Mac, or use macOS CI runners. Android-only beta avoids this for now.
- [x] **Native module choices** for chat media: decided 2026-10-15 (Decision 34): image-crop-picker, react-native-video, react-native-nitro-sound, react-native-compressor, and an in-repo FLAG_SECURE module. Push uses `@react-native-firebase/app` and `@react-native-firebase/messaging` (#36).
- [ ] **Over-the-air updates:** none built in with the bare CLI. Decide whether to skip them for the beta or add a service later.
- [x] **Firebase project** for FCM and the Android `google-services.json`: done with push (#36); the Android package is `co.in.milojulo` and CI writes the file from a secret (apps/mobile/README.md).
- [ ] **Bot check on sign-up (#70):** the Cloudflare Turnstile site key and secret, and how to show the widget in a React Native CLI app (a WebView component is a native dependency).
- [ ] **Disposable-email blocklist (#71):** whether the check runs in a Supabase Auth hook or in `accept_consents()`, and where the domain list comes from and how it stays current.
- [x] **Web account deletion page (#98):** decided 2026-10-25 (decision 61): one static page on milojulo.co.in (Cloudflare Pages), email OTP through Supabase Auth, then `delete_account()`. Not built yet (#98); still needs the Turnstile keys from #70.
- [ ] **Catalog content:** the full ~40 interest and activity tags (14 seeded), the prompt questions (2 seeded) and the final industries (12 provisional). The banned-terms list starts empty for admins to fill.
- [ ] **Data copy requests:** `request_data_copy()` queues a request, but nothing fulfils it. Decide how a copy is produced and sent, and in what time.

## Business and launch
- [ ] Google Play account type (personal needs the 12-tester, 14-day closed test; organization is exempt but needs verification first).
- [ ] Android only for the beta, or iOS too ($99/year plus TestFlight). Decision 8 says Android first.
- [ ] Pick the two neighbourhood clusters for the beta.
- [ ] Numeric go/no-go thresholds for each beta metric.
- [ ] Lawyer review of terms, privacy notice and consent screen; decide the data-retention period for safety records (stated in the privacy notice, not on the delete screen; see #160). The app links placeholder URLs until the documents exist.
- [ ] Trademark search for "MiloJulo" and the chosen logo (IP India device/logo search, reverse image search, adjacent classes).
- [x] Final logo choice: decided 2026-10-15 (Decision 32): design/brand/logo.png, used as is.
- [x] Email provider and domain: Resend, sending sign-in codes from `no-reply@milojulo.co.in` (PRs #72, #78).
- [ ] Support address behind the Contact support button: the app uses the placeholder `support@milojulo.in`, a different domain from `milojulo.co.in`. Confirm the address.
- [ ] Date the beta. The V1 build is done (#1 and #33 closed 2026-10-18); what remains is in docs/10-build-plan.md.
- [ ] Validate Orchid pop with 5 to 8 women in Pune.

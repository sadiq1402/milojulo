# Open questions (do not assume; ask)

## Build-affecting
- [ ] **Progressive reveal and Blind Match.** Blueprint signature features; V1 as scoped shows names and photos as soon as a profile is submitted. Decide whether a light version is in V1.
- [x] **Chat media moderation and retention:** decided 2026-10-07 (Decision 17): report-only; video 30 s / 20 MB, voice 2 min; chat media deleted from R2 after 90 days; reported media copied to evidence and kept for the safety-retention period (period still a legal decision).
- [ ] **Verification for Dating and Casual:** is email OTP with open sign-up (decision 27) and after-the-fact moderation enough (manual approval was dropped in decision 15), or must phone or selfie verification come first?
- [ ] **Circle conversation:** the screens are designed activities-only (tap a member, send a request, chat 1:1 after acceptance). Confirm that, or add a text-only circle chat later (group chat is outside V1).
- [x] **Screenshot blocking:** decided 2026-10-15 (Decision 33): Android blocks screenshots in chat screens (FLAG_SECURE); iOS does nothing and the app never claims they are blocked there.

- [ ] **iOS build path.** React Native CLI means iOS needs macOS: buy or borrow a Mac, or use macOS CI runners. Android-only beta avoids this for now.
- [x] **Native module choices** for chat media: decided 2026-10-15 (Decision 33): image-crop-picker, react-native-video, react-native-nitro-sound, react-native-compressor, and an in-repo FLAG_SECURE module. Push (Firebase messaging) is still to choose.
- [ ] **Over-the-air updates:** none built in with the bare CLI. Decide whether to skip them for the beta or add a service later.
- [ ] **Firebase project** for FCM (free) and the Android `google-services.json`.

## Business and launch
- [ ] Google Play account type (personal needs the 12-tester, 14-day closed test; organization is exempt but needs verification first).
- [ ] Android only for the beta, or iOS too ($99/year plus TestFlight).
- [ ] Pick the two neighbourhood clusters for the beta.
- [ ] Numeric go/no-go thresholds for each beta metric.
- [ ] Lawyer review of terms, privacy notice and consent screen; decide the data-retention period for safety records (stated in the privacy notice, not on the delete screen).
- [ ] Trademark search for "MiloJulo" and the chosen logo (IP India device/logo search, reverse image search, adjacent classes).
- [ ] Final logo choice (Mingle plus Tail recommended; People ring is the alternative).
- [ ] Email provider (Resend or Brevo) and the domain; then set the support address behind the Contact support button.
- [ ] Re-estimate the timeline (assumption: 15 to 20 build hours a week).
- [ ] Validate Orchid pop with 5 to 8 women in Pune.

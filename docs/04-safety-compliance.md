# Safety, store requirements and privacy

Safety is a differentiator and a launch blocker. Treat trust and safety as core engineering work.

## Launch-blocking items (both stores review UGC apps for these)
| Requirement | V1 implementation |
|---|---|
| Terms and community guidelines accepted before use | Mandatory onboarding step (`accept_consents()`: terms, community guidelines and data notice, plus the 18+ date of birth); each accepted document version and its timestamp stored per user in `consents`. A Member missing a current document (a new version, or a withdrawn one) is hidden and sent to Reconsent (`needs_reconsent()`) |
| Filtering of objectionable content | Word filter (`banned_terms`): display names, prompt answers and Activity titles and descriptions are rejected; messages are delivered and flagged to admins as a `word_filter` report. No pre-approval (decision 15): profiles and photos are live on submission; a profile, photo or Activity reported by 3 distinct Members in 7 days is auto-hidden until an admin acts (reports an admin dismissed by restoring don't count; messages are never auto-hidden, an admin takes them down). **Risk:** nothing screens photos before others see them; re-check store rules before submission, with automated photo screening as the fallback |
| Report users and content | Report on profiles, photos, messages and Activities (`report()`) with a reason list (fake or spam, harassment, inappropriate content, underage, felt unsafe, other) and up to 500 characters of free text; each report keeps a snapshot of the content as evidence |
| Block users | Separate, clearly labelled Block action (`block_user()`); hides both people from each other, closes their Connection and withdraws Join Requests between them. Unblocking is in Settings → Blocked people |
| Timely action on reports | Reports reviewed daily in the Supabase dashboard (the moderation page is not built), 24-hour target; admins act through `admin_takedown`, `admin_restore` and `admin_ban`, each written to the append-only `admin_actions` log |
| Published contact information | Support email in the app (Safety centre: `support@milojulo.in`), on the store listing and on the website |
| Account deletion | In-app Delete account (`delete_account()`): the Member is hidden everywhere at once and the hourly `account-purge` job deletes their R2 files, then the account (the cascade removes the rest; files a report keeps as evidence stay, #160). Google also requires a public web page to request deletion without reinstalling, declared in the Data safety form: not built (#98). Deactivation alone does not count |
| Reviewer access | A demo account (Reviewer Account), seeded per environment with `supabase/seed/reviewer.sql` (`seed_reviewer()`), is already past the age gate and consents so reviewers can log in |

Confirm against Apple's App Review Guidelines (1.2 user-generated content, 5.1.1(v) account deletion) and Google's UGC and Child Safety Standards policies before the first submission.

## Google Play closed testing
A personal developer account created after 13 Nov 2023 needs a closed test with at least 12 testers opted in continuously for 14 days before it can apply for production. Organization accounts are exempt but need business verification (can take 30+ days). Review of the production application usually takes 7 days or less. Run the closed beta as this test; keep a written summary of tester feedback.

## DPDP Act readiness (main obligations apply from 13 May 2027)
Not legal advice; a lawyer must review the notice, terms and privacy policy before the beta.
| Obligation | What V1 does |
|---|---|
| Standalone, itemised consent notice | One onboarding screen listing each data item, its purpose, and links to withdraw and to complain |
| Withdrawal as easy as giving consent | Consent settings page with one-tap withdraw per document (`withdraw_consent()`; the profile is hidden until the Member accepts again), plus Delete account |
| Children | 18+ date-of-birth gate; minors who slip through are removed on report; verifiable parental consent applies if any child's data is processed |
| Breach readiness | Written incident plan: notify affected users and the Board without delay, then the 72-hour update with cause, scope and fixes |
| Security safeguards | Encryption at rest and in transit, RLS, admin access control, audit logs, backups |
| Log retention | Keep logs and personal data needed for breach investigation for one year |
| Rights requests and grievances | Published support email; a data copy request in the app (`request_data_copy()`, queued in `data_requests` and fulfilled by the founder by hand); grievance answers within the legal limit (no more than 90 days) |
| Processor contracts | Review terms of Supabase, Cloudflare, the email provider and the push service |

Data minimisation: no religion or community fields, location only as one offset point per Member (latest only, no history, readable by no one, deleted with the account, shown as rounded distance bands; decision 40), the data notice (v2) says so, no company or education details. Chat media is deleted after 90 days by the nightly `purge-chat-media` job, except files a report keeps as evidence, whose retention is not yet decided (#160).

## Elevated exposure to design for
- **Casual mode and media in chat** raise moderation and store-review exposure: chat images and video in Casual need both people to allow media in that chat, a reported photo's or message's media file is kept for moderators (the original file, not a copy; retention open, #160), label Casual clearly, and read Google's and Apple's rules for dating apps before submitting.
- **Email-only verification** is easy to fake, and sign-up is open (decision 27): disposable-email blocklist (#71) and Turnstile (#70), both not built yet; Supabase Auth rate limits, auto-hide on reports, and admin spot checks of recently joined Members in the dashboard (no dedicated list yet; manual approval was dropped in decision 15).
- **Screenshots:** the chat screen blocks screenshots and screen recording on Android (FLAG_SECURE); iOS does nothing (it can only detect them). Decide what the app promises before promising it.
- **Gender mix:** track from day one; with open sign-up, balance it through outreach and offline events rather than metered invites.

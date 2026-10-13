# Safety, store requirements and privacy

Safety is a differentiator and a launch blocker. Treat trust and safety as core engineering work.

## Launch-blocking items (both stores review UGC apps for these)
| Requirement | V1 implementation |
|---|---|
| Terms and community guidelines accepted before use | Mandatory onboarding step; accepted version and timestamp stored per user |
| Filtering of objectionable content | Word filter on bios and activity posts (rejected) and messages (delivered, flagged to admins). No pre-approval (decision 15): profiles and photos are live on submission; anything reported by 3 distinct Members in 7 days is auto-hidden until an admin acts. **Risk:** nothing screens photos before others see them; re-check store rules before submission, with automated photo screening as the fallback |
| Report users and content | Report on profiles, messages, activity posts with a reason list and free text |
| Block users | Separate, clearly labelled Block action; hides both people from each other and closes the chat |
| Timely action on reports | Admin report queue reviewed daily, 24-hour target for removal or ban |
| Published contact information | Support email in the app, on the store listing and on the website |
| Account deletion | In-app Delete account. Google also requires a public web page to request deletion without reinstalling, declared in the Data safety form. Deactivation alone does not count |
| Reviewer access | Seed a demo account (Reviewer Account) that is already past the age gate and consents so reviewers can log in |

Confirm against Apple's App Review Guidelines (1.2 user-generated content, 5.1.1(v) account deletion) and Google's UGC and Child Safety Standards policies before the first submission.

## Google Play closed testing
A personal developer account created after 13 Nov 2023 needs a closed test with at least 12 testers opted in continuously for 14 days before it can apply for production. Organization accounts are exempt but need business verification (can take 30+ days). Review of the production application usually takes 7 days or less. Run the closed beta as this test; keep a written summary of tester feedback.

## DPDP Act readiness (main obligations apply from 13 May 2027)
Not legal advice; a lawyer must review the notice, terms and privacy policy before the beta.
| Obligation | What V1 does |
|---|---|
| Standalone, itemised consent notice | One onboarding screen listing each data item, its purpose, and links to withdraw and to complain |
| Withdrawal as easy as giving consent | Consent settings page with one-tap withdraw, plus Delete account |
| Children | 18+ date-of-birth gate; minors who slip through are removed on report; verifiable parental consent applies if any child's data is processed |
| Breach readiness | Written incident plan: notify affected users and the Board without delay, then the 72-hour update with cause, scope and fixes |
| Security safeguards | Encryption at rest and in transit, RLS, admin access control, audit logs, backups |
| Log retention | Keep logs and personal data needed for breach investigation for one year |
| Rights requests and grievances | Published support email, a rights-request channel, grievance answers within the legal limit (no more than 90 days) |
| Processor contracts | Review terms of Supabase, Cloudflare, the email provider and the push service |

Data minimisation: no religion or community fields, coarse area only (never exact location), no company or education details.

## Elevated exposure to design for
- **Casual mode and media in chat** raise moderation and store-review exposure: chat images and video in Casual need both people to allow media in that chat, reported media is copied to evidence for moderators, label Casual clearly, and read Google's and Apple's rules for dating apps before submitting.
- **Email-only verification** is easy to fake, and sign-up is open (decision 27): disposable-email blocklist (#71), Turnstile (#70), rate limits, auto-hide on reports, and an admin spot-check list of recently joined Members (manual approval was dropped in decision 15).
- **Screenshots:** Android can block them in a chat screen; as far as is known iOS can only detect them. Decide what the app promises before promising it.
- **Gender mix:** track from day one; with open sign-up, balance it through outreach and offline events rather than metered invites.

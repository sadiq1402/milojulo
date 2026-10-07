# No pre-approval of profiles or photos

Founder decision (2026-10-07): Members go live as soon as their profile is submitted; there is no admin approval of profiles or photos at any point, and moderation is after the fact (reports with a 24-hour target, bans, word filter, invite codes). This reverses Decision 7 in docs/08-decisions.md, which made manual approval the main trust layer for the first few hundred users.

## Consequences
- No Pending state, no Under Review screen, no approval queue; Account Status is Active or Banned.
- Nothing screens photos before other Members see them. With Casual mode and email-only signup, this weakens the "filtering of objectionable content" answer that Apple 1.2 and Google's UGC policy look for. Re-check store rules before the first submission; automated photo screening is the fallback if a review is rejected.
- Invite codes and fast report handling now carry most of the trust load.

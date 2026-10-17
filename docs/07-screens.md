# Screens

Static HTML mockups: design/reference-html/screens/*.dc.html (390 x 844 each; Admin is a web page). Read them for exact styling. Live canvas (private): https://claude.ai/artifact/CUiLCrHKpSmoQ8SSF6aY7x

| Flow | Screen (file) | Purpose and key elements |
|---|---|---|
| Get in | Welcome (Main) | Full-orchid hero, sticker chips for modes, "Get started" (the mockup's "I have an invite code" is gone, decision 27) |
| | Invite code (InviteCode) | **Dropped** (decision 27: open sign-up). Mockup kept for reference |
| | Email (Email) | Email entry; note that email verified only confirms an inbox |
| | Verify code (Otp) | 6 boxes, resend timer |
| | Age and consent (AgeConsent) | DOB (18+), itemised data notice, consent and terms checkboxes |
| Profile setup | Basics (Setup1Basics) | First name, area chips |
| | Photos (Setup2Photos) | 2 to 4 photo slots (4:5), review notice |
| | Prompts (Setup3Prompts) | Two prompts, 140 chars |
| | Modes (Setup4Modes) | Six option rows incl. Casual note |
| | Interests (Setup5Interests) | Interest chips, availability chips |
| | Under review (UnderReview) | **Dropped** (decision 15: no pre-approval; submitting goes straight to Discover). Mockup kept for reference |
| Discover and connect | Discover (Discover) | Mode filter chips, Same Vibe cards with why-you-match |
| | Profile (ProfileDetail) | Hero 4:5, why you match sticker, prompts, Send request |
| | Send request (SendRequest) | Bottom sheet with optional note |
| | Inbox: requests (Inbox) | Incoming (accept/decline) and sent |
| | Inbox: chats (Chats) | Conversation list with unread dot |
| | Chat (Chat) | Text, image, voice note, activity plan card, safety strip, composer |
| Activities and circles | Activities (Activities) | Tonight / This weekend / Later, Post and Joined compact buttons, tinted activity cards with the host's photo |
| | Activity (ActivityDetail) | Details, host, safety tips, Request to join, Report |
| | Activity, joined (ActivityDetailJoined) | As Activity for an accepted joiner or the host: You're in tag, venue with Directions (Google Maps), Message host |
| | New activity (CreateActivity) | Plan, type, area, when, time, spots, optional details |
| | Circles (Circles) | List with Join / Joined |
| | Circle (CircleDetail) | Description, upcoming activities, tappable members, Post an activity |
| | After you meet (MeetFeedback) | Did you meet? Keep the connection? (private until both say yes) |
| Safety and account | Report (Report) | Reason list, optional details, optional block, 24-hour promise |
| | Safety Centre (SafetyCentre) | First-meet tips, tools, Call 112, Contact support |
| | Me (Me) | Profile summary, edit, links |
| | Settings (Settings) | Visibility, notifications, privacy and data, delete account |
| | Delete account (DeleteAccount) | Consequences, type DELETE, pause alternative |
| Admin (web) | Moderation queue (Admin) | Reports table with response targets, detail panel, actions |

Screens still to design (from docs/12-db-schema.md): a Dating setup step after Modes (own gender, Dating Preferences) shown only when a Dating Mode is chosen and reused from Settings; a Mode picker in Send request (Eligible Modes only); propose / accept a Mode change in Chat; the Casual media-consent switch and first-open reminder in Chat; a "We met" action in Chat; Withdraw on an accepted Activity; the Joined list opened from Activities (#134); Networking industry and career stage fields; admin auto-hidden and recently-joined lists.

Navigation: bottom tabs are Discover, Activities, Circles, Inbox, Me. No bracketed placeholders remain in the mockups. The support address and the retention period are still open (see docs/09-open-questions.md).

For the data each screen reads and writes, see docs/11-screen-data-map.md.

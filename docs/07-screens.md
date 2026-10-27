# Screens

Static HTML mockups: design/reference-html/screens/*.dc.html (45 files: 44 phone screens at 390 x 844, plus Admin, a web page). Read them for exact styling. Live canvas (private): https://claude.ai/artifact/CUiLCrHKpSmoQ8SSF6aY7x

The app is in apps/mobile/src/screens; routes are in apps/mobile/src/navigation (RootNavigator.tsx picks signed out, onboarding, re-consent or Member; MemberNavigator.tsx holds the five tabs and the screens pushed over them). "Route" below is the navigator's screen name.

## Built screens

| Flow | Mockup | Route / app file | What it does |
|---|---|---|---|
| Get in | Main | `Welcome` / gettingIn/WelcomeScreen | Full-orchid hero, tilted sticker chips for Modes, logo mark, "Meet people near you who want the same kind of hangout.", "Get started". The mockup's "I have an invite code" link is not built (decision 27) |
| | Email | `Email` / gettingIn/EmailScreen | Email entry, "Send code"; note that a verified email only confirms an inbox |
| | Otp | `Otp` / gettingIn/OtpScreen | 6 code boxes, Verify, "Resend code" after 30 s |
| | AgeConsent | `AgeConsent` / gettingIn/AgeConsentScreen | Date of birth (DD MM YYYY, 18+), itemised data notice, data-use checkbox, Terms and Community Guidelines checkbox |
| | (none) | `Reconsent` / gettingIn/ReconsentScreen | Shown instead of the tabs after a consent is withdrawn or a document gets a new version: accept the current documents again (date of birth kept) or "Delete my account instead" |
| Profile setup | Setup1Basics | `ProfileSetup` / profileSetup/BasicsStep | First name only; no Area (#203). Location is asked after submitting, by `LocationGate` |
| | Setup2Photos | profileSetup/PhotosStep, PhotoSlot | 2 to 4 photo slots (4:5); take or choose a photo, make main, move earlier or later, replace, remove. Intro is "Clear photos where your face is visible." (no review notice: no pre-approval, ADR 0002) |
| | Setup3Prompts | profileSetup/PromptsStep | Two prompts from the catalog |
| | Setup4Modes | profileSetup/ModesStep | Six Mode rows (Casual tagged "18+ · adults only"). Choosing Dating, Serious or Casual shows own gender, who to meet, age range and distance on the same step; choosing Networking shows profession, industry and career stage. There is no separate Dating step |
| | Setup5Interests | profileSetup/InterestsStep | Interest chips and availability chips; the last step submits the profile, which goes live at once and opens Discover |
| | Location | location/LocationScreens (`LocationScreen`) | Asks for location before the phone's own dialog ("Allow location" / "Not now"); shown by `LocationGate` in front of the tabs when due, including right after a new Member submits; allowing sends the location at once |
| | LocationOff | location/LocationScreens (`LocationOffScreen`) | Shown once after location is refused: "Discover needs your location", without it you won't see anyone or be seen; "Turn on in Settings", "Not now" |
| Discover and connect | Discover, DiscoverDistance, DiscoverDistanceSheet, DiscoverModesSheet | `Discover` tab / discover/DiscoverScreen, DiscoverSheets, FeedCard | Two filter chips: distance (2, 5, 10, 25, 50 or 100 km, saved as the Discover Range) and Modes (several at once); Same Vibe cards with photo, distance band, Mode tags, why-you-match note and shared tags; pull to refresh, paged |
| | DiscoverEmpty | DiscoverScreen | "Nobody within N km yet" with "Widen to …" and "Choose distance"; at 100 km just "Check back soon." |
| | DiscoverNoLocation | DiscoverScreen | Without a location from the last 7 days: "Discover needs your location" and "Turn on location", which asks for permission (or opens the phone Settings once the phone's dialog was refused), sends the location and reloads Discover |
| | ProfileDetail | `Profile` / profile/ProfileScreen, ProfileMenu | Hero photo (first photo only) with Mode tags, name and age, Why you match, prompts, interests; "Send request", "Request sent" or "Open chat"; menu with Block and Report; long-press the photo to report it |
| | SendRequest, SendRequestModes, SendRequestNoShared | profile/ProfileScreen → requests/SendRequestSheet | Bottom sheet: "Connect as" chips of the other Member's Modes, shared ones first and tagged Shared, Casual tagged 18+; optional note with counter |
| | Inbox | `Inbox` tab, Requests segment / inbox/InboxScreen, requests/RequestList, AnswerCard | Connection Requests and Join Requests to answer (Accept / Decline), then the Member's own sent ones; tab badge counts the waiting ones |
| | Chats | `Inbox` tab, Chats segment / inbox/InboxScreen | Chat list with last message preview, time and unread dot |
| | Chat | `Chat` / chat/ChatScreen, ChatMenu, MessageBubble, MediaContent, ModeChangeCard | Text, photo, video (gallery, camera, record) and hold-to-record voice notes; Mode tag in the header; seen marker; retry on a failed send; long-press a message to report it; safety note at the top of the history; screenshots blocked on Android. Menu: Allow photos and video (Casual Media Consent, with a note while either side is off), We met, Change Mode (accept or decline card in the chat), Mute notifications, Close chat, Block, Safety Centre |
| Activities and circles | Activities | `Activities` tab / activities/ActivitiesScreen, ActivityCard | Board grouped by when, nearest first within each group, only Activities within the Discover Range; each card shows its distance band. Without a fresh location, "Activities need your location" with Turn on location. Post and Joined compact buttons, tinted cards by type with the host's photo; after an Activity ends, a "did you meet" row per person to answer about (MeetPrompts) |
| | ActivityDetail, ActivityDetailJoined | `ActivityDetail` / activities/ActivityDetailScreen | Details, distance band, host, Circle, safety tips, Report. Others: Ask to join, Requested / Cancel request, Going / Withdraw, Open chat; venue (tap it, or Directions, for Google Maps) for everyone who can see the Activity (decision 69). Host: Edit, Cancel Activity, waiting Join Requests to accept or decline, joiners with Open chat |
| | Joined, JoinedWaiting | `Joined` / activities/JoinedScreen | Going and Waiting segments of Activity cards |
| | CreateActivity | `CreateActivity` / activities/CreateActivityScreen, ActivityForm | What, type, day chips, start time and Spots steppers, length (or no set end), details, where exactly; a Circle pre-selected when posting from one. No Area: the Activity is placed where the host is when posting (#203), so posting needs a fresh location |
| | (none) | `EditActivity` / activities/EditActivityScreen | The same form for the host; type can't change, and a Locked Activity only allows the description and more Spots |
| | Circles | `Circles` tab / circles/CirclesScreen, CircleCard | Circles within the Discover Range plus every active one I joined, each with its place tag (e.g. "Baner, Pune"), distance band, interest tag and a Joined tag. Without a fresh location, "Circles need your location" with Turn on location above the joined Circles only. Joining is on the Circle screen, not the list |
| | CircleDetail | `CircleDetail` / circles/CircleDetailScreen | Place tag and distance band, description, coming-up Activities, tappable members, Post an activity to this circle, Join Circle / Leave Circle |
| | MeetFeedback | `MeetFeedback` / meetFeedback/MeetFeedbackScreen | Did you two meet? Keep the connection? Only you see your answer; kept when both say yes. Opened after an Activity or from "We met" in Chat |
| Safety and account | Report | `Report` / reports/ReportScreen | Reason list, optional details, optional "also block", 24-hour line |
| | SafetyCentre | `SafetyCentre` / me/SafetyCentreScreen | Before-you-meet tips, how to report, Block someone, Pause my profile, Call 112, Contact support |
| | Me | `Me` tab / me/MeScreen | Profile summary and a Paused tag; rows to edit Name, Photos, Prompts, Modes and preferences, Interests and availability; Safety Centre, Settings, Sign out |
| | (none) | `EditProfile` / me/EditProfileScreen | One setup step on its own, button "Save" |
| | Settings | `Settings` / me/SettingsScreen | Pause my profile; notification switches (Requests and messages, Activity updates); Consent settings, Blocked people, Request a copy of my data; Delete account |
| | (none) | `ConsentSettings` / account/ConsentSettingsScreen | Accepted documents with version; Withdraw (hides the profile until accepted again) |
| | (none) | `BlockedPeople` / me/BlockedPeopleScreen | Blocked Members with Unblock |
| | (none) | `DataCopy` / account/DataCopyScreen | Request a copy of my data, emailed when ready |
| | DeleteAccount | `DeleteAccount` / account/DeleteAccountScreen | Consequences, type DELETE, "Pause my profile instead" (left out when opened from Reconsent) |
| App shell | (none) | components/BrandLoader, StatusScreen | Logo loader while the session restores; loading and load-error screens |

Navigation: bottom tabs are Discover, Activities, Circles, Inbox, Me (the Inbox badge counts waiting requests). Every other screen is pushed over the tabs.

## In the mockups, not built
| Mockup / element | Status |
|---|---|
| InviteCode, and "I have an invite code" on Main | Dropped (decision 27: open sign-up) |
| UnderReview | Dropped (decision 15, ADR 0002: no pre-approval; submitting goes straight to Discover) |
| Activity plan card in Chat | The message type exists (`activity_card`) and a received one renders as a plain "Shared an Activity" card, but nothing in the app or database creates one and it doesn't open the Activity |
| Join / Joined buttons on the Circles list | The list shows a Joined tag; joining is on the Circle screen |
| Admin (web) | Not built. apps/admin holds only a README; moderation runs from the Supabase dashboard with the admin SQL functions (#18). Outside the app epic (#33) |

Still to design and build: admin auto-hidden and recently-joined lists; the web account deletion page (#98). The support address and the retention period are still open (see docs/09-open-questions.md).

For the data each screen reads and writes, see docs/11-screen-data-map.md.

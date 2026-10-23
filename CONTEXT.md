# MiloJulo

Intent-first social discovery for Pune: people pick the kinds of connection they want, discover others nearby, and are nudged toward meeting in real life.

## Language

### People

**Member**:
A person with a MiloJulo account who has passed the age gate (18+) and accepted the current consent documents. Sign-up is open; there are no invite codes (decision 27).
_Avoid_: User, account. Write "Circle member" in full for Circle membership

**Mode**:
One of six kinds of connection a Member opts into: Friends, Activities, Dating, Serious, Casual, Networking. A Member holds one or more.
_Avoid_: Intent (reserve "intent-first" for positioning copy only)

**Dating Mode**:
Any of Dating, Serious or Casual; holding one requires the Member's own gender and dating preferences.

**Dating Preferences**:
The genders, age range and maximum distance a Member in a Dating Mode will accept. The distance is measured between the two Members' Area centres, not their Member Locations. Applied in both directions, and only to Eligible Modes (Connection Requests and Mode Changes): Discover shows every Mode whatever the preferences (decision 45).

**Account Status**:
Whether a Member is Active or Banned. There is no pre-approval: a Member is Active from the moment their profile is submitted, and moderation happens after the fact through reports.
_Avoid_: Review Status, approved, pending

**Banned**:
Removed by an admin with a stated reason (`admin_ban`); there is no unban yet. The Member's requested and accepted Connections close (so their chats turn read-only), they leave every Circle, their Join Requests to Activities that haven't started are withdrawn or cancelled, their own Activities that haven't started are cancelled, and every open Report about them is settled. A banned Member can't file Reports.

**Paused**:
A Member's own choice to stop meeting new people: not a Visible Member, so hidden from Discover and Circle member lists, and their own Discover, Activity Board and Circles come back empty; cannot post Activities, ask to join one or send Connection Requests. Existing Connections and chats carry on, and their hosted Activities stay on the board. Independent of Account Status.

**Submitted Profile**:
A profile that has met the minimum (a first name, 2 photos, 2 prompts, a Mode, an Area, and gender and Dating Preferences if a Dating Mode is held) and been submitted once; it can never fall back below the minimum.

**Visible Member**:
A Member who is Active, has a Submitted Profile with at least 2 live photos (uploaded, not Auto-hidden, not taken down), is not Paused, not Auto-hidden, not deleted and has accepted every current required consent (none missing or withdrawn); the only kind others can discover (`is_visible()`).

**Reviewer Account**:
The seeded account store reviewers use to sign in, already past the age gate and the current consents (`seed_reviewer()`, run by supabase/seed/reviewer.sql). Meant to be left out of metrics, but nothing marks it yet, so `kept_connections()` would count it.

**Industry** and **Career Stage**:
Fixed lists a Member in Networking may pick from (career stages: student, early, mid, senior, founder); used to rank the Networking feed. Profession stays free text and is display-only.

### Connecting

**Connection**:
A one-to-one relationship between two Members, carried under a single Mode (one of the recipient's Eligible Modes when sent; the sender need not hold it, decision 39), which unlocks chat once accepted. Status: Requested, Accepted, Declined or Closed. At most one Requested or Accepted Connection per pair; a sender whose request was declined waits 30 days to ask that Member again.
_Avoid_: Match, friendship

**Mode Change**:
A proposal by one side of an accepted Connection to move it to another Eligible Mode; the Connection keeps its current Mode until the other side accepts. One open proposal at a time; it lapses after 7 days, and a declined proposer waits 7 days to propose again.

**Eligible Mode**:
From a sender to a recipient: a Mode the recipient chose that is open between them (Casual only when both chose it; a Dating Mode only when both Members' Dating Preferences fit and the recipient's range includes the sender). The sender need not hold it (decision 39). Connection Requests use the recipient's Eligible Modes; a Mode Change uses those of the side who answers it. Discover shows every Visible Member in range with all their Modes (decision 45), except those the viewer has a waiting Connection Request or an accepted Connection with (decision 49); the Casual and Dating rules apply only to Eligible Modes.

**Media Consent**:
In a Casual Connection, the per-side switch that must be on for both Members before either can send or open images or video (including ones sent earlier). Changing a Connection's Mode into Casual switches it off on both sides.

**Chat Media Limits**:
The longest video, the largest image and the longest voice note a Member may send in chat, set in one settings row the founder changes without a release (launch: 15 s, 2 MB, 2 min; decision 59). They can only tighten the fixed maximums (30 s video, 5 MB image, 2 min voice).

**Media Expiry**:
Chat images, video and voice notes are deleted 90 days after sending (daily job); the message remains and shows that its media expired. A file that a Report holds as evidence is marked expired in the chat but kept in R2 (how long is open, #160).

**Mute**:
One Member silencing notifications from one Connection, without telling the other side. Distinct from Block.

**Block**:
One Member hiding both people from each other everywhere; closes their Connection, cancels or withdraws the Join Requests between them, and prevents any future Connection while it stands. Checked everywhere through `is_blocked(a, b)`. The blocker can lift it from Blocked people; the closed Connection stays closed.

**Why you match**:
The templated line on a Discover card and profile: the distance band, then the other Member's Modes when none is shared, then "You both ..." from shared Modes, interests and availability (`match_reason()`).

**Distance Band**:
How a distance leaves the database: "<2 km" or "~N km", rounded to the kilometre, never finer.

**Connection Request**:
A Connection in its Requested state, sent with an optional note under one of the recipient's Eligible Modes, only to a Member the sender could see in Discover (inside their Discover Range). Accepting it is not re-checked against range.

**Request Cap**:
The limit of 10 Connection Requests a Member may send in any rolling 24 hours, across all Modes.

### Activities and Circles

**Activity**:
A posted plan to do something at a time in an Area, with a fixed number of spots, that other Members ask to join; optionally posted to a Circle. It is over at its end time, or 3 hours after its start when it has none, and leaves the board then. Status: Open, Cancelled (by the host, or by a ban), Expired (set every 15 minutes once it is over) or Removed (taken down by an admin). Only accepted joiners and the host see its venue.
_Avoid_: Event, meetup (for the post itself)

**Join Request**:
A Member's request to take one of an Activity's spots; the host accepts or declines it. Status: Requested, Accepted, Declined, Cancelled (the asker gave up while waiting) or Withdrawn (an accepted joiner gave up their spot). A Member asks once per Activity, whatever the answer; Activities they have asked to join leave their Activity Board and live on Joined.
_Avoid_: Activity request

**Spots**:
An Activity's capacity, counted in joiners only (never the host); spots left is capacity minus accepted Join Requests.

**Withdrawal**:
An accepted joiner giving up their spot before the Activity starts; their Activity Connection stays.

**Locked Activity**:
An Activity with at least one accepted joiner; its time, Area and venue can no longer change, only its description and a higher capacity, or it is cancelled.

**Join Cap**:
The limit of 10 Join Requests a Member may send in any rolling 24 hours.

**Activity Connection**:
The Connection between an Activity's host and a Member whose Join Request is accepted; created under the Activities Mode and linked to the Activity, or else the pair's existing Connection: an accepted one reused with its Mode, or a waiting Connection Request accepted as it stands (decision 25). Doesn't count toward the Request Cap.

**Activity Board**:
The list of open Activities not yet over, shown to every Visible Member regardless of the Modes they hold, grouped under Tonight, This weekend and Later (India time). Leaves out Activities whose host is blocked, banned, deleted, Auto-hidden or has withdrawn consent (a Paused host's stay), Auto-hidden Activities, and ones the viewer has asked to join.

**Joined**:
The Activities screen listing a Member's Going (Activities they were accepted into, not yet over) and Waiting (Join Requests not yet answered); hosted Activities are left out.

**Meet Feedback**:
The two questions each side answers after an Activity that ran (Open past its end, or Expired) or about a chat: did you meet, and do you want to keep the connection? Both answers are required; never asked about a banned, deleted, Auto-hidden or Blocked Member.

**Meet Nudge**:
The push "Did you meet <name>?" sent once per Member per chat, a week after a non-Activity Connection was accepted and both sides have written; opens Meet Feedback.

**Kept Connection**:
A pair of Members who both answered, about the same route (the same Activity, or their chat), that they met and want to keep the connection; counted once per pair, dated from the earliest such route. The unit behind the North Star (weekly meaningful connections).
_Avoid_: Match, successful meetup

**Circle**:
A small admin-created community tied to one Area and one interest, which Members join; Activities posted to it remain visible on the main board. An archived Circle disappears and its label drops off upcoming Activities.
_Avoid_: Group, community (as a noun for this concept)

**Area**:
One of the 55 fixed Pune neighbourhoods, each in one of five zones (West, Pimpri-Chinchwad, Central, East, South), that a Member, Activity or Circle belongs to; its centre stands in for a Member who has no recent Member Location. Profile setup suggests the nearest Area when its centre is within 3 km of the phone.
_Avoid_: cell

**Member Location**:
The latest point from a Member's phone, moved by a fixed random offset of a few hundred metres; never shown or readable, only used to measure distance. At most one update an hour, inside an active Service Region only, ignored once older than 7 days, no history, deleted with the account (decisions 40, 42).
_Avoid_: Location history, GPS, exact location (in product copy)

**Discover Range**:
How far from their Member Location a Member wants Discover to look: 2, 5, 10, 25 or 50 km, or anywhere in their Service Region (the app says "Anywhere in Pune"); 10 km by default. One-way: it limits what that Member sees and whom they can send a Connection Request to (decision 43); the other Member's range matters only for a Dating Mode, which is an Eligible Mode only when the recipient's range includes the sender (decision 45).

**Service Region**:
A city MiloJulo runs in (a bounding box, active or not; Pune first). Locations outside every active one are refused with "MiloJulo isn't in your city yet".
_Avoid_: city box, Pune box

### Moderation

**Report**:
A Member flagging a profile, photo, message or Activity to admins, with a reason and optional details (up to 500 characters); keeps a snapshot of the reported text, and for a photo or chat media the original file's key as evidence (decision 55). Status: Open, Actioned or Dismissed.

**Auto-hide**:
Hiding a profile, photo or Activity automatically once 3 different Members have reported it within 7 days, until an admin restores or removes it. Reports an admin dismissed don't count. Messages are never Auto-hidden.

**Takedown**:
An admin removing a photo, message or Activity after the fact (`admin_takedown`); marks the open Reports on it actioned and is always logged. A taken-down message is gone for both sides; a taken-down Activity is Removed. A profile is never taken down; the Member is Banned.

**Restore**:
An admin clearing Auto-hide from a profile, photo or Activity (`admin_restore`); marks the open Reports on it dismissed and is always logged.

**Flagged Message**:
A delivered message that matched the word filter and was copied into the admin queue. Profile text and Activities that match are rejected instead.

**Admin**:
A signed-in account whose JWT carries `app_metadata.role = 'admin'` (`is_admin()`); reads Reports and runs Takedown, Restore, Ban and the Circle tools. Not a Member role in the app.

**Audit Log**:
`admin_actions`: one row per Takedown, Restore and Ban, with the admin, target and note; append-only for everyone.

### Account

**Consent Documents**:
The current Terms, Community Guidelines and data notice (v2 since location, decision 41). A Member with any one missing or withdrawn is hidden everywhere and sent to Reconsent until they accept again (`needs_reconsent()`, decision 37).

**Account Deletion**:
A Member's own `delete_account()`: hides them everywhere at once, deletes their Member Location and queues an erasure; an hourly purge then deletes their R2 media (their photos and all chat media in their Connections, except Report evidence) and their auth user, which erases the rest.

**Data Copy**:
A Member's request for a copy of their data (`request_data_copy()`); one waiting at a time.

# MiloJulo

Intent-first social discovery for Pune: people pick the kinds of connection they want, discover others whose choices overlap, and are nudged toward meeting in real life.

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
The genders, age range and maximum distance a Member in a Dating Mode will accept; applied in both directions, so two Members see each other in a Dating Mode only if each fits the other's preferences.

**Account Status**:
Whether a Member is Active or Banned. There is no pre-approval: a Member is Active from the moment their profile is submitted, and moderation happens after the fact through reports.
_Avoid_: Review Status, approved, pending

**Banned**:
Removed by an admin; all the Member's Connections close, they leave every Activity and Circle, and their chats turn read-only for the other side.

**Paused**:
A Member's own choice to stop meeting new people: hidden from Discover, cannot post Activities or send requests, while existing Connections and chats carry on. Independent of Account Status.

**Submitted Profile**:
A profile that has met the minimum (a first name, 2 photos, 2 prompts, a Mode, an Area, and gender and Dating Preferences if a Dating Mode is held) and been submitted once; it can never fall back below the minimum.

**Visible Member**:
A Member who is Active, has a Submitted Profile, is not Paused, not Auto-hidden and not deleted; the only kind others can discover.

**Reviewer Account**:
The seeded account store reviewers use to sign in, already past the age gate and consents; excluded from metrics.

**Industry** and **Career Stage**:
Fixed lists a Member in Networking may pick from (career stages: student, early, mid, senior, founder); used to rank the Networking feed. Profession stays free text and is display-only.

### Connecting

**Connection**:
A one-to-one relationship between two Members, carried under a single Mode that both hold, which unlocks chat once accepted.
_Avoid_: Match, friendship

**Mode Change**:
A proposal by one side of an accepted Connection to move it to another Eligible Mode; the Connection keeps its current Mode until the other side accepts. One open proposal at a time; it lapses after 7 days, and a declined proposer waits 7 days to propose again.

**Eligible Mode**:
For a pair of Members, a Mode both hold that, if it is a Dating Mode, also passes both Members' Dating Preferences. Discover, Connection Requests, Mode Changes and "Why you match" only use Eligible Modes.

**Media Consent**:
In a Casual Connection, the per-side switch that must be on for both Members before either can send images or video.

**Media Expiry**:
Chat images, video and voice notes are deleted 90 days after sending; the message remains and shows that its media expired. Media copied into a Report's evidence is kept for the safety-retention period instead.

**Mute**:
One Member silencing notifications from one Connection, without telling the other side. Distinct from Block.

**Block**:
One Member hiding both people from each other everywhere; closes their Connection and prevents any future one while it stands.

**Connection Request**:
A Connection in its Requested state, sent with an optional note under a chosen shared Mode.

**Request Cap**:
The limit of 10 Connection Requests a Member may send in any rolling 24 hours, across all Modes.

### Activities and Circles

**Activity**:
A posted plan to do something at a time in an Area, with a fixed number of spots, that other Members ask to join.
_Avoid_: Event, meetup (for the post itself)

**Join Request**:
A Member's request to take one of an Activity's spots; the host accepts or declines it. A Member asks once per Activity.
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
The Connection between an Activity's host and a Member whose Join Request is accepted; created under the Activities Mode, or the pair's existing Connection reused with its current Mode.

**Activity Board**:
The list of open Activities, visible to every Visible Member regardless of the Modes they hold.

**Kept Connection**:
A pair of Members who both answered that they met and want to keep the connection; the unit behind the North Star (weekly meaningful connections).
_Avoid_: Match, successful meetup

**Circle**:
A small admin-created community tied to one Area and one interest, which Members join; Activities posted to it remain visible on the main board. An archived Circle disappears and its label drops off upcoming Activities.
_Avoid_: Group, community (as a noun for this concept)

**Area**:
One of the fixed Pune neighbourhoods a Member or Activity belongs to; the only location MiloJulo knows.
_Avoid_: Location, cell

### Moderation

**Report**:
A Member flagging a profile, photo, message or Activity to admins, with a reason; keeps a copy of the reported content.

**Auto-hide**:
Hiding a profile, photo or Activity automatically once 3 different Members have reported it within 7 days, until an admin restores or removes it.

**Takedown**:
An admin removing a photo, message or Activity after the fact; always logged.

**Flagged Message**:
A delivered message that matched the word filter and was copied into the admin queue. Profile text and Activities that match are rejected instead.

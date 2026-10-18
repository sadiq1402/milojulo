# Connections are per-pair history rows that carry a Mode

_Status: accepted (decision 16). Amended by decision 39 (built in #104, #107) and decision 45: the Mode is chosen from the recipient's Eligible Modes and the sender need not hold it. Amended by decision 25: accepting a Join Request while the pair has a waiting Connection Request accepts that request as it stands._

A pair of Members may have many Connection rows over time but at most one that is Requested or Accepted, enforced by a partial unique index on (least, greatest) of the pair rather than a plain unique pair. This lets people reconnect after a close or a lapsed decline (30-day wait for the same sender after a decline; never while a Block stands) without losing history.

Each Connection carries the Mode it was made under, chosen from the pair's Eligible Modes, because Casual consent-aware messaging, per-mode metrics and moderation context all need to know which kind of connection a chat is. The Mode changes only by consent: one side proposes a Mode Change, the other accepts, and every change is logged. Dropping a Mode from your profile does not close or relabel existing Connections.

Accepting a Join Request creates an Activity Connection (Activities Mode, linked to the Activity) between host and joiner, or reuses the pair's existing Connection with its current Mode, because V1 has no group chat and host and joiner need a way to coordinate.

## Considered options
- Plain unique pair (one Connection per pair, ever): simplest, but a decline or unblock would be permanent.
- No Mode on the Connection, inferred from the overlap: cannot tell a Casual chat from a Friends chat once Modes change.
- Join Requests without chat, or a separate Connection Request: leaves host and joiner unable to coordinate on the day.

# Member location: one offset point per Member, readable by no one

_Status: accepted (decisions 40 to 42). Built as described (migrations 20261017090000_member_location.sql, 20261018090000_discover_by_distance.sql); the app sends a point on open at most every 3 hours (`refreshEvery` in apps/mobile/src/features/location/prompt.ts)._

Founder decision (2026-10-15, #101): Discover filters by distance from the phone, so MiloJulo stores a real location. This reverses the old hard rule 7 ("coarse location cell only, never exact coordinates").

`member_locations` keeps one row per Member: the latest point only, as a PostGIS geography, already moved by a fixed random offset (200 to 500 m in a random direction, drawn on the first update and kept). The raw point from the phone is never stored. RLS is on with no policies, so no client role reads or writes it, the owner and admins included. Only security definer functions touch it: `set_location(lat, lng)` writes it, and the feed measures from `member_point(member)` (internal; the offset point, else the Member's Area centre).

`set_location` accepts at most one update an hour and refuses any point outside every active Service Region (`service_regions`: name, bounding box, active; the first is Pune, 18.40 to 18.75 N, 73.65 to 74.05 E) with `MiloJulo isn't in your city yet` (decision 42). A new city is a row, not a migration. Inside one region two points are at most about 60 km apart, so with an hour between updates a speed check (for example 200 km/h) could never fire; the region is the whole check. A Member Location older than 7 days is ignored and the Area centre stands in, so a Member who stopped opening the app is not pinned to a stale place. `in_service_region()` lets the app say when the Member's point lies in no active region. Distances leave the database only as bands (`<2 km`, `~N km`), never finer than a kilometre.

## Considered options
- Area only (the old model): too coarse for a 2 or 5 km range, and every Member in an Area is "0 km" away.
- Snapping to a grid cell: pinpointing by moving between cells is still possible, and cell edges make distances jumpy. The fixed offset plus rounded distance bands on cards gives similar protection with smoother results.
- Keeping a history: no use for Discover, more to lose in a breach.

## Consequences
- Trilateration needs many fake-location probes; the hourly limit, device-only updates, the offset and banded distances make it slow and imprecise. Revisit if abuse shows up.
- The offset is per Member and stable, so repeated updates don't average it away.
- The data notice moved to v2; Members accept it again (`needs_reconsent()`), and are hidden until they do.
- Account deletion removes the row at once (`delete_account()`), before the purge.

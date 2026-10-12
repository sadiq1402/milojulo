import {
  cancelActivity,
  fetchActivity,
  fetchBoard,
  postActivity,
  updateActivity,
} from '../src/features/activities/api';
import type {
  ActivityFields,
  StartsWhen,
} from '../src/features/activities/model';
import {
  addDays,
  indiaInstant,
  indiaParts,
} from '../src/features/activities/time';
import { signOut } from '../src/features/auth/api';
import { admin } from './support/admin';
import { createMember, type TestMember } from './support/members';

let me: TestMember;
let ravi: TestMember;

const minutesFromNow = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString();
const today = () => indiaParts(new Date()).dateKey;
// Monday 1 to Sunday 7.
const isoDayOf = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00Z`).getUTCDay() || 7;

// The board's rule in India time, so the expected group holds whatever day the test runs.
function expectedWhen(startsAt: string): StartsWhen {
  const day = indiaParts(new Date(startsAt)).dateKey;
  const now = today();
  if (day <= now) {
    return 'tonight';
  }
  const saturday = addDays(now, 6 - isoDayOf(now));
  const sunday = addDays(now, 7 - isoDayOf(now));
  return day >= saturday && day <= sunday ? 'this_weekend' : 'later';
}

const fields = (overrides: Partial<ActivityFields> = {}): ActivityFields => ({
  title: 'Badminton doubles',
  type: 'sports',
  areaId: 'baner',
  startsAt: indiaInstant(addDays(today(), 14), 19 * 60),
  endsAt: indiaInstant(addDays(today(), 14), 21 * 60),
  capacity: 4,
  description: 'All levels welcome.',
  venueDetail: 'Baner Sports Complex, court 2',
  ...overrides,
});

beforeAll(async () => {
  me = await createMember('Asha', { app: true });
  ravi = await createMember('Ravi');
});

afterAll(() => signOut());

test('a posted Activity is on the board with its details, grouped by the database', async () => {
  const soon = await postActivity(
    fields({
      title: 'Chai walk',
      type: 'food_chai',
      startsAt: minutesFromNow(30),
      endsAt: null,
    }),
  );
  // The coming Sunday, or next Saturday when today is Sunday.
  const isoDay = isoDayOf(today());
  const weekendDay = addDays(today(), isoDay < 7 ? 7 - isoDay : 6);
  const nextWeekend = await postActivity(
    fields({
      title: 'Weekend trek',
      startsAt: indiaInstant(weekendDay, 22 * 60),
      endsAt: null,
    }),
  );
  const later = await postActivity(fields());

  const board = await fetchBoard();
  const byId = (id: string) => board.find(a => a.id === id)!;
  expect(byId(later)).toMatchObject({
    hostId: me.id,
    hostName: 'Asha',
    title: 'Badminton doubles',
    type: 'sports',
    areaId: 'baner',
    capacity: 4,
    spotsLeft: 4,
    description: 'All levels welcome.',
    startsWhen: 'later',
    isMine: true,
  });
  expect(Date.parse(byId(later).startsAt)).toBe(Date.parse(fields().startsAt));
  expect(byId(soon)).toMatchObject({
    startsWhen: expectedWhen(byId(soon).startsAt),
    endsAt: null,
  });
  expect(byId(nextWeekend).startsWhen).toBe(
    expectedWhen(byId(nextWeekend).startsAt),
  );
  // The board never carries the venue.
  expect(byId(later)).not.toHaveProperty('venueDetail');
});

test('the host sees the venue; another Member gets the details without it', async () => {
  const mine = await postActivity(fields({ title: 'Evening ride' }));
  expect(await fetchActivity(mine)).toMatchObject({
    title: 'Evening ride',
    status: 'open',
    venueDetail: 'Baner Sports Complex, court 2',
    isLocked: false,
    isMine: true,
  });

  const { data: theirs, error } = await ravi.client.rpc('post_activity', {
    title: 'Board games night',
    type: 'games',
    area_id: 'wakad',
    starts_at: fields().startsAt,
    venue_detail: 'Ravi’s flat, Wakad',
  });
  expect(error).toBeNull();
  expect(await fetchActivity(theirs!)).toMatchObject({
    hostName: 'Ravi',
    title: 'Board games night',
    areaId: 'wakad',
    isMine: false,
    venueDetail: null,
  });
  expect((await fetchBoard()).some(a => a.id === theirs)).toBe(true);
});

test('refusals come back as friendly copy tied to their field', async () => {
  await expect(postActivity(fields({ title: '   ' }))).rejects.toMatchObject({
    message: 'Give your Activity a title.',
    field: 'title',
  });
  await expect(
    postActivity(fields({ startsAt: minutesFromNow(-30), endsAt: null })),
  ).rejects.toMatchObject({
    message: 'Pick a start time that is still to come.',
    field: 'startsAt',
  });
  await expect(
    postActivity(fields({ endsAt: fields().startsAt })),
  ).rejects.toMatchObject({
    message: 'The end has to be after the start.',
    field: 'endsAt',
  });
  await expect(postActivity(fields({ capacity: 21 }))).rejects.toMatchObject({
    message: 'Spots must be between 1 and 20.',
    field: 'capacity',
  });
});

test('the host edits only what changed; an empty venue clears it', async () => {
  const id = await postActivity(fields({ title: 'Sinhagad trek' }));
  await updateActivity(id, {
    title: ' Sinhagad sunrise trek ',
    capacity: 6,
    venueDetail: '',
  });
  expect(await fetchActivity(id)).toMatchObject({
    title: 'Sinhagad sunrise trek',
    capacity: 6,
    description: 'All levels welcome.',
    areaId: 'baner',
    venueDetail: null,
  });
  await expect(
    updateActivity(id, { endsAt: minutesFromNow(-60) }),
  ).rejects.toMatchObject({ field: 'endsAt' });
});

test('cancelling takes it off the board; the host still sees it as cancelled', async () => {
  const id = await postActivity(fields({ title: 'Kabaddi practice' }));
  await cancelActivity(id);
  expect((await fetchBoard()).some(a => a.id === id)).toBe(false);
  expect((await fetchActivity(id))?.status).toBe('cancelled');
  await expect(cancelActivity(id)).rejects.toThrow(
    'This Activity is already over or cancelled.',
  );
  await expect(updateActivity(id, { capacity: 5 })).rejects.toThrow(
    "This Activity can't be changed any more.",
  );
});

test('a Paused Member is told to unpause before posting', async () => {
  await admin
    .from('profiles')
    .update({ paused_at: new Date().toISOString() })
    .eq('id', me.id);
  try {
    await expect(postActivity(fields())).rejects.toMatchObject({
      message: 'Your profile is paused. Unpause it to post Activities.',
      field: undefined,
    });
  } finally {
    await admin.from('profiles').update({ paused_at: null }).eq('id', me.id);
  }
});

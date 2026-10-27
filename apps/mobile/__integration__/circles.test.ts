import { fetchBoard, postActivity } from '../src/features/activities/api';
import type { ActivityFields } from '../src/features/activities/model';
import {
  fetchCircle,
  fetchCircleActivities,
  fetchCircleMembers,
  fetchCircles,
  joinCircle,
  leaveCircle,
} from '../src/features/circles/api';
import { signOut } from '../src/features/auth/api';
import {
  addDays,
  indiaInstant,
  indiaParts,
} from '../src/features/activities/time';
import { admin } from './support/admin';
import { baner, createMember, type TestMember } from './support/members';

// These run against local Supabase and only pass once #15's migration is applied (the circles
// tables and member functions). They are written against the agreed contract and may fail
// until #15 lands. Shared database: never `db reset`; run through the integration lock.

let kabir: TestMember;
let circleId: string;
// Where the Members are put by default, so the Circle is well inside the Discover Range.
const banerPoint = `SRID=4326;POINT(${baner.lng} ${baner.lat})`;

const today = () => indiaParts(new Date()).dateKey;

const fields = (overrides: Partial<ActivityFields> = {}): ActivityFields => ({
  title: 'Sinhagad trek',
  type: 'outdoors',
  startsAt: indiaInstant(addDays(today(), 14), 6 * 60),
  endsAt: indiaInstant(addDays(today(), 14), 10 * 60),
  capacity: 6,
  description: 'Early start.',
  venueDetail: 'Sinhagad base',
  circleId: null,
  ...overrides,
});

beforeAll(async () => {
  // The app's own client is signed in as Asha for the whole file.
  await createMember('Asha', { app: true });
  kabir = await createMember('Kabir');

  const { data: tag } = await admin.from('tags').select('id').limit(1).single();
  // An active Circle, created the way an admin or the dev seed would.
  const { data: circle, error } = await admin
    .from('circles')
    .insert({
      name: 'Weekend Trekkers',
      place_name: 'Baner, Pune',
      place: banerPoint,
      tag_id: tag!.id,
      description: 'Sunday treks around the city.',
    })
    .select('id')
    .single();
  if (error) {
    throw error;
  }
  circleId = circle!.id;
});

afterAll(() => signOut());

test('an active Circle is on the browse list, with its place, distance and count', async () => {
  const circles = await fetchCircles();
  const mine = circles.find(c => c.id === circleId);
  expect(mine).toMatchObject({
    name: 'Weekend Trekkers',
    placeName: 'Baner, Pune',
    distanceBand: '<2 km',
    memberCount: 0,
    iAmMember: false,
  });
});

test('joining is idempotent and shows me as a member', async () => {
  await joinCircle(circleId);
  await joinCircle(circleId);
  const circle = await fetchCircle(circleId);
  expect(circle).toMatchObject({ memberCount: 1, iAmMember: true });
});

test('a member sees fellow members, not themselves', async () => {
  await joinCircle(circleId);
  await kabir.client.rpc('join_circle', { circle_id: circleId });
  const members = await fetchCircleMembers(circleId);
  // The caller is left out: fellow members are the others you can send a request to.
  expect(members.map(m => m.name)).toEqual(['Kabir']);
});

test('posting to the Circle shows on its list and on the main board with the label', async () => {
  await joinCircle(circleId);
  const activityId = await postActivity(fields({ circleId }));
  const circleActivities = await fetchCircleActivities(circleId);
  expect(circleActivities.find(a => a.id === activityId)).toMatchObject({
    circleId,
    circleName: 'Weekend Trekkers',
  });
  const board = await fetchBoard();
  expect(board.find(a => a.id === activityId)).toMatchObject({
    circleName: 'Weekend Trekkers',
  });
});

test('posting to a Circle I have not joined is refused', async () => {
  const { data: other, error } = await admin
    .from('circles')
    .insert({
      name: 'Other Circle',
      place_name: 'Baner, Pune',
      place: banerPoint,
      tag_id: 1,
    })
    .select('id')
    .single();
  if (error) {
    throw error;
  }
  await expect(postActivity(fields({ circleId: other!.id }))).rejects.toThrow(
    'Join this Circle before posting an Activity to it.',
  );
});

test('leaving removes me; leaving again is refused', async () => {
  await joinCircle(circleId);
  await leaveCircle(circleId);
  const circle = await fetchCircle(circleId);
  expect(circle?.iAmMember).toBe(false);
  await expect(leaveCircle(circleId)).rejects.toThrow(
    "You're not a member of this Circle.",
  );
});

test('an archived Circle drops off the list and its Activities lose the label', async () => {
  await joinCircle(circleId);
  const activityId = await postActivity(fields({ circleId }));
  await admin.from('circles').update({ is_active: false }).eq('id', circleId);

  const circles = await fetchCircles();
  expect(circles.find(c => c.id === circleId)).toBeUndefined();

  const board = await fetchBoard();
  const activity = board.find(a => a.id === activityId);
  // The Activity stays; only its Circle label drops.
  expect(activity).toBeDefined();
  expect(activity?.circleName).toBeNull();
});

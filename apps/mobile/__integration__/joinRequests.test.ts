import {
  askToJoin,
  fetchActivity,
  fetchJoinRequests,
  fetchMyJoinRequests,
  postActivity,
  respondJoinRequest,
  withdrawJoinRequest,
} from '../src/features/activities/api';
import type { ActivityFields } from '../src/features/activities/model';
import {
  addDays,
  indiaInstant,
  indiaParts,
} from '../src/features/activities/time';
import { signOut } from '../src/features/auth/api';
import { fetchConversations } from '../src/features/chat/api';
import { admin } from './support/admin';
import { createMember, type TestMember } from './support/members';

let me: TestMember;
let ravi: TestMember;
let isha: TestMember;
let kabir: TestMember;

const startsAt = indiaInstant(
  addDays(indiaParts(new Date()).dateKey, 14),
  19 * 60,
);

const fields = (overrides: Partial<ActivityFields> = {}): ActivityFields => ({
  title: 'Badminton doubles',
  type: 'sports',
  startsAt,
  endsAt: null,
  capacity: 4,
  description: '',
  venueDetail: 'Baner Sports Complex, court 2',
  circleId: null,
  ...overrides,
});

// An Activity posted by another Member from their own phone.
async function postAs(
  host: TestMember,
  overrides: { title?: string; capacity?: number } = {},
): Promise<string> {
  const { data, error } = await host.client.rpc('post_activity', {
    title: overrides.title ?? 'Chai and board games',
    type: 'games',
    starts_at: startsAt,
    capacity: overrides.capacity ?? 4,
    venue_detail: 'Wakad social, upstairs',
  });
  if (error) {
    throw error;
  }
  return data;
}

async function joinAs(member: TestMember, activityId: string): Promise<string> {
  const { data, error } = await member.client.rpc('join_activity_request', {
    activity_id: activityId,
  });
  if (error) {
    throw error;
  }
  return data;
}

async function answerAs(
  member: TestMember,
  requestId: string,
  accept: boolean,
) {
  const { data, error } = await member.client.rpc('respond_activity_request', {
    request_id: requestId,
    accept,
  });
  if (error) {
    throw error;
  }
  return data;
}

beforeAll(async () => {
  me = await createMember('Asha', { app: true });
  ravi = await createMember('Ravi');
  isha = await createMember('Isha');
  kabir = await createMember('Kabir');
});

afterAll(() => signOut());

test('asking to join shows the request as pending on the Activity and in both request lists', async () => {
  const id = await postAs(ravi);
  const requestId = await askToJoin(id);

  expect(await fetchActivity(id)).toMatchObject({
    myRequest: { id: requestId, status: 'requested' },
    connectionId: null,
    venueDetail: 'Wakad social, upstairs',
  });
  expect(
    (await fetchMyJoinRequests()).find(r => r.id === requestId),
  ).toMatchObject({
    activityId: id,
    activityTitle: 'Chai and board games',
    otherId: ravi.id,
    otherName: 'Ravi',
    direction: 'outgoing',
  });
  const { data: hosts } = await ravi.client.rpc('my_join_requests');
  expect(hosts!.find(r => r.request_id === requestId)).toMatchObject({
    other_id: me.id,
    other_name: 'Asha',
    direction: 'incoming',
  });

  await expect(askToJoin(id)).rejects.toThrow(
    "You've already asked to join this Activity.",
  );
});

test('the host lists requests, accepts one into an Activity Connection and declines another', async () => {
  const id = await postActivity(fields());
  const fromRavi = await joinAs(ravi, id);
  const fromKabir = await joinAs(kabir, id);

  expect(await fetchJoinRequests(id)).toEqual([
    expect.objectContaining({
      id: fromRavi,
      requesterId: ravi.id,
      requesterName: 'Ravi',
      status: 'requested',
      connectionId: null,
    }),
    expect.objectContaining({ id: fromKabir, requesterName: 'Kabir' }),
  ]);
  expect(
    (await fetchMyJoinRequests()).filter(r => r.activityId === id),
  ).toHaveLength(2);

  const connectionId = await respondJoinRequest(fromRavi, true);
  expect(connectionId).toEqual(expect.any(String));
  expect(await respondJoinRequest(fromKabir, false)).toBeNull();

  expect(await fetchJoinRequests(id)).toEqual([
    expect.objectContaining({ id: fromRavi, status: 'accepted', connectionId }),
  ]);
  expect(
    (await fetchConversations()).find(c => c.connectionId === connectionId),
  ).toMatchObject({ otherId: ravi.id, status: 'accepted', mode: 'activities' });
  expect(await fetchActivity(id)).toMatchObject({
    spotsLeft: 3,
    isLocked: true,
  });
  await expect(respondJoinRequest(fromKabir, true)).rejects.toThrow(
    'This Join Request is no longer waiting for an answer.',
  );
});

test('an accepted joiner gets the chat; withdrawing ends it for good', async () => {
  const id = await postAs(isha);
  const requestId = await askToJoin(id);
  const connectionId = await answerAs(isha, requestId, true);

  expect(await fetchActivity(id)).toMatchObject({
    myRequest: { id: requestId, status: 'accepted' },
    connectionId,
    venueDetail: 'Wakad social, upstairs',
  });

  await withdrawJoinRequest(requestId);
  expect(await fetchActivity(id)).toMatchObject({
    myRequest: { id: requestId, status: 'withdrawn' },
    connectionId: null,
    venueDetail: 'Wakad social, upstairs',
  });
  // The Activity Connection stays.
  expect(
    (await fetchConversations()).find(c => c.connectionId === connectionId),
  ).toMatchObject({ status: 'accepted' });
  await expect(askToJoin(id)).rejects.toThrow(
    "You've already asked to join this Activity.",
  );
  await expect(withdrawJoinRequest(requestId)).rejects.toThrow(
    "This Join Request can't be cancelled or withdrawn any more.",
  );
});

test('a pending request can be cancelled', async () => {
  const id = await postAs(kabir);
  const requestId = await askToJoin(id);
  await withdrawJoinRequest(requestId);
  expect((await fetchActivity(id))?.myRequest).toEqual({
    id: requestId,
    status: 'cancelled',
  });
  expect((await fetchMyJoinRequests()).some(r => r.id === requestId)).toBe(
    false,
  );
});

test('refusals come back as friendly copy', async () => {
  const mine = await postActivity(fields({ title: 'My own trek' }));
  await expect(askToJoin(mine)).rejects.toThrow(
    "You're hosting this Activity.",
  );

  const full = await postAs(ravi, { title: 'Doubles, one spot', capacity: 1 });
  await answerAs(ravi, await joinAs(isha, full), true);
  await expect(askToJoin(full)).rejects.toThrow(
    'There are no spots left on this Activity.',
  );

  const { data: cancelled } = await ravi.client.rpc('post_activity', {
    title: 'Called off',
    type: 'games',
    starts_at: startsAt,
  });
  await ravi.client.rpc('cancel_activity', { activity_id: cancelled! });
  await expect(askToJoin(cancelled!)).rejects.toThrow(
    "This Activity isn't open to join any more.",
  );
});

test('a Paused Member is told to unpause before asking', async () => {
  const id = await postAs(ravi, { title: 'Evening ride' });
  await admin
    .from('profiles')
    .update({ paused_at: new Date().toISOString() })
    .eq('id', me.id);
  try {
    await expect(askToJoin(id)).rejects.toThrow(
      'Your profile is paused. Unpause it to join Activities.',
    );
  } finally {
    await admin.from('profiles').update({ paused_at: null }).eq('id', me.id);
  }
});

test('the 11th join request in 24 hours is refused (Join Cap)', async () => {
  // Earlier tests in this file already sent some; fill up to 10, then one more.
  const { count } = await admin
    .from('activity_requests')
    .select('id', { count: 'exact', head: true })
    .eq('requester_id', me.id);
  for (let i = count ?? 0; i < 10; i++) {
    await askToJoin(await postAs(kabir, { title: `Game ${i}` }));
  }
  await expect(
    askToJoin(await postAs(kabir, { title: 'One too many' })),
  ).rejects.toThrow(
    "You've sent 10 Join Requests in the last 24 hours, the most allowed. Try again later.",
  );
});

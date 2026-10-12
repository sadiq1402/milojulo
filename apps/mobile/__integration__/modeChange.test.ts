import { signOut } from '../src/features/auth/api';
import {
  fetchConversations,
  fetchEligibleModes,
  fetchOpenModeChange,
  proposeModeChange,
  respondModeChange,
} from '../src/features/chat/api';
import { admin } from './support/admin';
import { connect, createMember, type TestMember } from './support/members';

let asha: TestMember;
let ravi: TestMember;
let connectionId: string;

beforeAll(async () => {
  asha = await createMember('Asha', { app: true });
  ravi = await createMember('Ravi');
  // Both also hold Activities, so it's an Eligible Mode besides Friends.
  await admin
    .from('profiles')
    .update({ modes: ['friends', 'activities'] })
    .in('id', [asha.id, ravi.id]);
  connectionId = await connect(ravi, asha);
});

afterAll(() => signOut());

test('the Eligible Modes for the pair come from their profiles', async () => {
  expect((await fetchEligibleModes(ravi.id)).sort()).toEqual([
    'activities',
    'friends',
  ]);
});

test('a proposal shows for the other side, and accepting moves the Connection to that Mode', async () => {
  await proposeModeChange(connectionId, 'activities');
  const { data } = await ravi.client
    .from('connection_mode_changes')
    .select('id')
    .is('outcome', null);
  expect(data).toHaveLength(1);

  // Ravi answers on his phone; Asha's app then sees the new Mode.
  await ravi.client.rpc('respond_mode_change', {
    change_id: data![0].id,
    accept: true,
  });
  expect(await fetchOpenModeChange(connectionId)).toBeNull();
  expect((await fetchConversations())[0].mode).toBe('activities');
});

test('only one open proposal at a time, refused with friendly copy', async () => {
  await proposeModeChange(connectionId, 'friends');
  const open = await fetchOpenModeChange(connectionId);
  expect(open).toMatchObject({
    proposedBy: asha.id,
    fromMode: 'activities',
    toMode: 'friends',
  });
  await expect(proposeModeChange(connectionId, 'friends')).rejects.toThrow(
    "There's already a Mode Change waiting for an answer.",
  );
});

test('after a decline the proposer waits, told so in friendly copy', async () => {
  const open = (await fetchOpenModeChange(connectionId))!;
  await ravi.client.rpc('respond_mode_change', {
    change_id: open.id,
    accept: false,
  });
  await expect(proposeModeChange(connectionId, 'friends')).rejects.toThrow(
    'Your last Mode Change was declined. You can suggest another in 7 days.',
  );
});

test('the other side accepts from the app', async () => {
  const { data: id } = await ravi.client.rpc('propose_mode_change', {
    connection_id: connectionId,
    to_mode: 'friends',
  });
  expect(await fetchOpenModeChange(connectionId)).toMatchObject({
    id,
    proposedBy: ravi.id,
  });
  await respondModeChange(id!, true);
  expect((await fetchConversations())[0].mode).toBe('friends');
});

test('a proposal older than 7 days has lapsed and no longer shows', async () => {
  const { data: id } = await ravi.client.rpc('propose_mode_change', {
    connection_id: connectionId,
    to_mode: 'activities',
  });
  await admin
    .from('connection_mode_changes')
    .update({
      proposed_at: new Date(Date.now() - 8 * 86_400_000).toISOString(),
    })
    .eq('id', id!);
  expect(await fetchOpenModeChange(connectionId)).toBeNull();
});

import { signOut } from '../src/features/auth/api';
import { blockMember } from '../src/features/chat/api';
import { fetchMyDiscoverState } from '../src/features/discover/api';
import { fetchMyBlocks, setPaused, unblock } from '../src/features/me/api';
import { createMember, type TestMember } from './support/members';

let me: TestMember;
let ravi: TestMember;
let neha: TestMember;

beforeAll(async () => {
  me = await createMember('Asha', { app: true });
  ravi = await createMember('Ravi');
  neha = await createMember('Neha');
});

afterAll(() => signOut());

test('pausing and unpausing flips my own paused state', async () => {
  await setPaused(true);
  expect((await fetchMyDiscoverState(me.id)).paused).toBe(true);
  await setPaused(false);
  expect((await fetchMyDiscoverState(me.id)).paused).toBe(false);
});

test('blocked people lists whom I blocked, not who blocked me', async () => {
  await blockMember(ravi.id);
  await neha.client.rpc('block_user', { member_id: me.id });
  const blocks = await fetchMyBlocks();
  expect(blocks.map(b => b.memberId)).toEqual([ravi.id]);
  expect(blocks[0].name).toBe('Ravi');
});

test('unblocking removes only my own Block', async () => {
  await unblock(ravi.id);
  expect(await fetchMyBlocks()).toEqual([]);

  // Neha's Block on me is hers: my unblock can't lift it.
  await unblock(neha.id);
  const { data } = await neha.client.rpc('my_blocks');
  expect(data!.map(b => b.member_id)).toEqual([me.id]);
});

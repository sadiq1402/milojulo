import { signOut } from '../src/features/auth/api';
import { fetchConversations } from '../src/features/chat/api';
import { respondRequest, sendRequest } from '../src/features/requests/api';
import { admin } from './support/admin';
import { createMember, type TestMember } from './support/members';

let me: TestMember;
let ravi: TestMember;
let isha: TestMember;
let kabir: TestMember;

beforeAll(async () => {
  me = await createMember('Asha', { app: true });
  ravi = await createMember('Ravi');
  isha = await createMember('Isha');
  kabir = await createMember('Kabir');
});

afterAll(() => signOut());

function conversationWith(member: TestMember) {
  return fetchConversations().then(list =>
    list.find(c => c.otherId === member.id),
  );
}

test('a sent request shows as outgoing and pending with its Mode and note, and a second one is refused', async () => {
  await sendRequest(ravi.id, 'friends', 'Badminton at Baner?');
  expect(await conversationWith(ravi)).toMatchObject({
    status: 'requested',
    direction: 'outgoing',
    mode: 'friends',
    note: 'Badminton at Baner?',
  });
  await expect(sendRequest(ravi.id, 'friends')).rejects.toThrow(
    "You're already connected with this Member, or a request between you is waiting.",
  );
});

test('a recent decline refuses another request, with friendly copy', async () => {
  const { data: incoming } = await ravi.client.rpc('my_connections');
  await ravi.client.rpc('respond_request', {
    connection_id: incoming![0].connection_id,
    accept: false,
  });
  // A declined request leaves the sender's lists; nothing says it was declined.
  expect(await conversationWith(ravi)).toBeUndefined();
  await expect(sendRequest(ravi.id, 'friends')).rejects.toThrow(
    "You can't send this Member another request yet.",
  );
});

test('a member who blocked me reads as not available, never as a Block', async () => {
  await kabir.client.rpc('block_user', { member_id: me.id });
  const error = await sendRequest(kabir.id, 'friends').catch(e => e);
  expect(error.message).toBe(
    "This Member isn't available for requests right now.",
  );
  expect(error.message).not.toMatch(/block/i);
});

test('a Mode the pair do not share is refused', async () => {
  await expect(sendRequest(isha.id, 'networking')).rejects.toThrow(
    "That Mode isn't open between you two.",
  );
});

test('accepting an incoming request opens the Connection', async () => {
  const { data: connectionId } = await isha.client.rpc('send_request', {
    to_member: me.id,
    mode: 'friends',
    note: 'Coffee?',
  });
  expect(await conversationWith(isha)).toMatchObject({
    connectionId,
    status: 'requested',
    direction: 'incoming',
    note: 'Coffee?',
  });
  await respondRequest(connectionId!, true);
  expect((await conversationWith(isha))?.status).toBe('accepted');
  await expect(respondRequest(connectionId!, true)).rejects.toThrow(
    'This request is no longer waiting for an answer.',
  );
});

test('declining an incoming request removes it from my lists', async () => {
  const leela = await createMember('Leela');
  const { data: connectionId } = await leela.client.rpc('send_request', {
    to_member: me.id,
    mode: 'friends',
  });
  await respondRequest(connectionId!, false);
  expect(await conversationWith(leela)).toBeUndefined();
});

test('a Paused sender is told to unpause', async () => {
  const neel = await createMember('Neel');
  await admin
    .from('profiles')
    .update({ paused_at: new Date().toISOString() })
    .eq('id', me.id);
  try {
    await expect(sendRequest(neel.id, 'friends')).rejects.toThrow(
      'Your profile is paused. Unpause it to send requests.',
    );
  } finally {
    await admin.from('profiles').update({ paused_at: null }).eq('id', me.id);
  }
});

test('a sender who is not visible (Auto-hidden) is told so', async () => {
  const tara = await createMember('Tara');
  await admin
    .from('profiles')
    .update({ hidden_at: new Date().toISOString() })
    .eq('id', me.id);
  try {
    await expect(sendRequest(tara.id, 'friends')).rejects.toThrow(
      "Your profile isn't visible right now, so you can't send requests.",
    );
  } finally {
    await admin.from('profiles').update({ hidden_at: null }).eq('id', me.id);
  }
});

test('the 10th request in 24 hours is the last, with friendly copy', async () => {
  const omar = await createMember('Omar');
  // Earlier requests to a past Connection count toward the cap like any other.
  await admin.from('connections').insert(
    Array.from({ length: 10 }, () => ({
      requester_id: me.id,
      addressee_id: kabir.id,
      mode: 'friends' as const,
      status: 'closed' as const,
    })),
  );
  await expect(sendRequest(omar.id, 'friends')).rejects.toThrow(
    "You've sent 10 requests in the last 24 hours, the most allowed. Try again later.",
  );
});

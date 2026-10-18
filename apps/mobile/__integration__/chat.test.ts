import { signOut } from '../src/features/auth/api';
import {
  blockMember,
  cannotSendMessage,
  closeConnection,
  fetchConversations,
  fetchChatState,
  fetchMessages,
  markRead,
  newMessageId,
  sendMessage,
  setMuted,
  subscribeToChat,
  type Message,
} from '../src/features/chat/api';
import { admin } from './support/admin';
import { connect, createMember, type TestMember } from './support/members';

let me: TestMember;
let ravi: TestMember;
let connectionId: string;

beforeAll(async () => {
  me = await createMember('Asha', { app: true });
  ravi = await createMember('Ravi');
  connectionId = await connect(ravi, me);
});

afterAll(() => signOut());

test('a new Connection shows in my conversations with the other Member and nothing unread', async () => {
  const conversations = await fetchConversations();
  expect(conversations).toEqual([
    expect.objectContaining({
      connectionId,
      otherId: ravi.id,
      otherName: 'Ravi',
      status: 'accepted',
      unreadCount: 0,
      lastMessage: null,
    }),
  ]);
});

test('a sent message reaches the other side, and resending the same id after a failure adds nothing', async () => {
  const id = newMessageId();
  await sendMessage({ id, connectionId, body: 'Coffee on Saturday?' });
  await sendMessage({ id, connectionId, body: 'Coffee on Saturday?' });

  const mine = await fetchMessages(connectionId);
  expect(mine).toEqual([
    expect.objectContaining({
      id,
      senderId: me.id,
      type: 'text',
      body: 'Coffee on Saturday?',
    }),
  ]);
  const { data: theirs } = await ravi.client.rpc('my_connections');
  expect(theirs![0]).toMatchObject({
    last_message_body: 'Coffee on Saturday?',
    unread_count: 1,
  });
});

test('reading a chat clears my unread count, and the other side reading shows as a read receipt', async () => {
  await ravi.client.from('messages').insert({
    id: newMessageId(),
    connection_id: connectionId,
    type: 'text',
    body: 'Yes! 11 at Vohuman?',
  });
  expect((await fetchConversations())[0].unreadCount).toBe(1);
  const newest = (await fetchMessages(connectionId)).at(-1)!;
  await markRead(connectionId, newest.createdAt);
  expect((await fetchConversations())[0].unreadCount).toBe(0);

  const [mine] = await fetchMessages(connectionId);
  expect((await fetchChatState(connectionId)).otherLastReadAt).toBeNull();
  await ravi.client
    .from('connection_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('connection_id', connectionId)
    .eq('user_id', ravi.id);
  const { otherLastReadAt } = await fetchChatState(connectionId);
  expect(Date.parse(otherLastReadAt!)).toBeGreaterThanOrEqual(
    Date.parse(mine.createdAt),
  );
});

test('a message from the other side arrives live on the private channel', async () => {
  const received: Message[] = [];
  const subscribed = new Promise<void>(resolve => {
    const unsubscribe = subscribeToChat(connectionId, {
      onMessage: message => received.push(message),
      onRemoved: () => {},
      onStatus: status => status === 'live' && resolve(),
    });
    afterAllCleanups.push(unsubscribe);
  });
  await subscribed;

  const sendAsRavi = async (body: string) => {
    const id = newMessageId();
    await ravi.client
      .from('messages')
      .insert({ id, connection_id: connectionId, type: 'text', body });
    return id;
  };
  // A freshly started Realtime only begins streaming database broadcasts after the first
  // join, and anything sent before then is never broadcast (CI starts it fresh). Wait until
  // broadcasts flow; the app itself covers that gap by catching up when it goes live.
  for (let tries = 0; ; tries++) {
    const probe = await sendAsRavi('Are you there?');
    try {
      await waitFor(() => received.some(m => m.id === probe), 1000);
      break;
    } catch (e) {
      if (tries === 15) {
        throw e;
      }
    }
  }

  const id = await sendAsRavi('See you there');
  await waitFor(() => received.some(m => m.id === id));
  expect(received.find(m => m.id === id)).toMatchObject({
    senderId: ravi.id,
    body: 'See you there',
  });
}, 30_000);

test('a message taken down by an admin is announced live and can no longer be read', async () => {
  const removed: string[] = [];
  await new Promise<void>(resolve => {
    afterAllCleanups.push(
      subscribeToChat(connectionId, {
        onMessage: () => {},
        onRemoved: id => removed.push(id),
        onStatus: status => status === 'live' && resolve(),
      }),
    );
  });
  const id = newMessageId();
  await ravi.client.from('messages').insert({
    id,
    connection_id: connectionId,
    type: 'text',
    body: 'Something nasty',
  });
  // What admin_takedown does to a message; the service role stands in for an admin's session.
  const { error } = await admin
    .from('messages')
    .update({ removed_at: new Date().toISOString() })
    .eq('id', id);
  expect(error).toBeNull();
  await waitFor(() => removed.includes(id));
  expect((await fetchMessages(connectionId)).some(m => m.id === id)).toBe(
    false,
  );
}, 30_000);

test("each chat gets only its own Connection's messages from my one channel", async () => {
  const meera = await createMember('Meera');
  const otherChat = await connect(meera, me);
  const inRavis: Message[] = [];
  const inMeeras: Message[] = [];
  const live = (connection: string, into: Message[]) =>
    new Promise<void>(resolve => {
      afterAllCleanups.push(
        subscribeToChat(connection, {
          onMessage: message => into.push(message),
          onRemoved: () => {},
          onStatus: status => status === 'live' && resolve(),
        }),
      );
    });
  await Promise.all([live(connectionId, inRavis), live(otherChat, inMeeras)]);

  const id = newMessageId();
  await meera.client.from('messages').insert({
    id,
    connection_id: otherChat,
    type: 'text',
    body: 'Trek Sunday?',
  });
  await waitFor(() => inMeeras.some(m => m.id === id));
  expect(inRavis.some(m => m.id === id)).toBe(false);
}, 30_000);

test('catching up fetches only messages from the given time on', async () => {
  const all = await fetchMessages(connectionId);
  const since = all[1].createdAt;
  expect((await fetchMessages(connectionId, since)).map(m => m.id)).toEqual(
    all.slice(1).map(m => m.id),
  );
});

const afterAllCleanups: (() => void)[] = [];
afterAll(() => afterAllCleanups.forEach(cleanup => cleanup()));

async function waitFor(condition: () => boolean, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('timed out waiting');
    }
    await new Promise<void>(resolve => setTimeout(resolve, 100));
  }
}

test('muting is my own setting', async () => {
  await setMuted(connectionId, true);
  expect((await fetchChatState(connectionId)).muted).toBe(true);
  await setMuted(connectionId, false);
  expect((await fetchChatState(connectionId)).muted).toBe(false);
});

test('after I close the Connection it stays as history and nobody can send', async () => {
  const neha = await createMember('Neha');
  const id = await connect(neha, me);
  await closeConnection(id);
  expect(
    (await fetchConversations()).find(c => c.connectionId === id)?.status,
  ).toBe('closed');
  await expect(
    sendMessage({ id: newMessageId(), connectionId: id, body: 'Hi?' }),
  ).rejects.toThrow(cannotSendMessage);
});

test('blocking from a chat closes it and stops sending', async () => {
  const kabir = await createMember('Kabir');
  const id = await connect(kabir, me);
  await blockMember(kabir.id);
  expect(
    (await fetchConversations()).find(c => c.connectionId === id)?.status,
  ).toBe('closed');
  await expect(
    sendMessage({ id: newMessageId(), connectionId: id, body: 'Hi?' }),
  ).rejects.toThrow(cannotSendMessage);
});

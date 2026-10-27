import { assertEquals } from '@std/assert';
import { createHandler, type QueuedPush } from './handler.ts';

const KEY = 'service-key';
const RAVI = '00000000-0000-0000-0000-0000000000a2';
const PUSH: QueuedPush = {
  recipientId: RAVI,
  title: 'Asha',
  body: 'Badminton at 7?',
  data: { kind: 'message', connectionId: 'c1' },
};

function setup(opts: { tokens?: string[]; push?: QueuedPush | null; fcm?: (token: string) => Response } = {}) {
  const fcmCalls: {
    url: string;
    headers: Headers;
    body: { message: { token: string; data: Record<string, string> } & Record<string, unknown> };
  }[] = [];
  const deletedTokens: string[] = [];
  const deletedPushes: number[] = [];
  const handler = createHandler({
    callSecret: KEY,
    projectId: 'milojulo-test',
    accessToken: async () => 'oauth-token',
    db: {
      queuedPush: async () => opts.push === undefined ? PUSH : opts.push,
      deviceTokens: async () => opts.tokens ?? ['tok-1'],
      deleteTokens: async (tokens) => void deletedTokens.push(...tokens),
      deleteQueuedPush: async (id) => void deletedPushes.push(id),
    },
    fetch: async (input, init) => {
      const body = JSON.parse(String(init?.body));
      fcmCalls.push({ url: String(input), headers: new Headers(init?.headers), body });
      return opts.fcm?.(body.message.token) ?? new Response('{"name":"m"}', { status: 200 });
    },
    log: () => {},
  });
  return { handler, fcmCalls, deletedTokens, deletedPushes };
}

const call = (body: unknown, auth = `Bearer ${KEY}`) =>
  new Request('http://localhost/push', {
    method: 'POST',
    headers: { Authorization: auth },
    body: JSON.stringify(body),
  });

Deno.test('sends the queued push to each phone in the FCM v1 shape, then drops it from the queue', async () => {
  const { handler, fcmCalls, deletedPushes } = setup({ tokens: ['tok-1', 'tok-2'] });
  const res = await handler(call({ id: 7 }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 2 });
  assertEquals(fcmCalls.length, 2);
  assertEquals(fcmCalls[0].url, 'https://fcm.googleapis.com/v1/projects/milojulo-test/messages:send');
  assertEquals(fcmCalls[0].headers.get('Authorization'), 'Bearer oauth-token');
  assertEquals(fcmCalls[0].body, {
    message: {
      token: 'tok-1',
      notification: { title: 'Asha', body: 'Badminton at 7?' },
      data: { kind: 'message', connectionId: 'c1' },
      android: { priority: 'high' },
    },
  });
  assertEquals(deletedPushes, [7]);
});

Deno.test('data values are sent as strings', async () => {
  const { handler, fcmCalls } = setup({ push: { ...PUSH, data: { kind: 'x', count: 3 } } });
  await handler(call({ id: 1 }));
  assertEquals(fcmCalls[0].body.message.data, { kind: 'x', count: '3' });
});

Deno.test('deletes tokens FCM says are unregistered or invalid, and keeps the rest', async () => {
  const { handler, deletedTokens, deletedPushes } = setup({
    tokens: ['gone', 'bad', 'other-app', 'fine', 'payload'],
    fcm: (token) => {
      if (token === 'gone') {
        return Response.json({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }, {
          status: 404,
        });
      }
      if (token === 'bad') {
        return Response.json({
          error: {
            status: 'INVALID_ARGUMENT',
            message: 'The registration token is not a valid FCM registration token',
          },
        }, { status: 400 });
      }
      if (token === 'other-app') {
        return Response.json(
          { error: { status: 'PERMISSION_DENIED', details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } },
          {
            status: 403,
          },
        );
      }
      if (token === 'payload') {
        return Response.json({ error: { status: 'INVALID_ARGUMENT', message: 'Invalid value at message.data' } }, {
          status: 400,
        });
      }
      return new Response('{}', { status: 200 });
    },
  });
  const res = await handler(call({ id: 3 }));
  assertEquals(await res.json(), { sent: 1 });
  assertEquals(deletedTokens, ['gone', 'bad', 'other-app']);
  assertEquals(deletedPushes, [3]);
});

Deno.test('a push FCM could not take for now (5xx or 429) stays queued, and its tokens are kept', async () => {
  const { handler, deletedTokens, deletedPushes } = setup({
    tokens: ['busy', 'limited', 'fine'],
    fcm: (token) =>
      token === 'busy'
        ? new Response('unavailable', { status: 503 })
        : token === 'limited'
        ? new Response('slow down', { status: 429 })
        : new Response('{}', { status: 200 }),
  });
  const res = await handler(call({ id: 4 }));
  assertEquals(await res.json(), { sent: 1 });
  assertEquals(deletedTokens, []);
  assertEquals(deletedPushes, []);
});

Deno.test('a Member with no phones gets no FCM call', async () => {
  const { handler, fcmCalls, deletedPushes } = setup({ tokens: [] });
  const res = await handler(call({ id: 4 }));
  assertEquals(await res.json(), { sent: 0 });
  assertEquals(fcmCalls.length, 0);
  assertEquals(deletedPushes, [4]);
});

Deno.test('a push already sent is a no-op', async () => {
  const { handler, fcmCalls } = setup({ push: null });
  const res = await handler(call({ id: 5 }));
  assertEquals(await res.json(), { sent: 0 });
  assertEquals(fcmCalls.length, 0);
});

Deno.test('refuses anyone but the service role', async () => {
  for (const auth of ['', 'Bearer user-jwt']) {
    const { handler, fcmCalls, deletedPushes } = setup();
    const res = await handler(call({ id: 1 }, auth));
    assertEquals(res.status, 401);
    await res.body?.cancel();
    assertEquals(fcmCalls.length, 0);
    assertEquals(deletedPushes, []);
  }
});

Deno.test('refuses a body without a numeric id', async () => {
  const { handler } = setup();
  const res = await handler(call({ id: 'x' }));
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

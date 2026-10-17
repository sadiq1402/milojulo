import { assertEquals } from '@std/assert';
import { createHandler, type Db } from './handler.ts';

const key = 'service-role-key';

function fakes(opts: { failing?: string[]; failingUser?: string; clock?: () => number } = {}) {
  const events: string[] = [];
  const deleted: string[] = [];
  const users: string[] = [];
  const records: { member: string; objects: number }[] = [];
  const media: Record<string, string[]> = {
    asha: ['asha/1.jpg', 'chat/c1/a.jpg'],
    ravi: ['ravi/1.jpg'],
  };
  const db: Db = {
    queue: async () => [
      { memberId: 'asha', requestedAt: '2026-10-17T00:00:00Z' },
      { memberId: 'ravi', requestedAt: '2026-10-17T01:00:00Z' },
    ],
    mediaKeys: async (member) => media[member] ?? [],
    deleteUser: async (member) => {
      if (member === opts.failingUser) throw new Error('delete user: 500');
      events.push(`user ${member}`);
      users.push(member);
    },
    recordErasure: async (member, _requestedAt, objects) => {
      events.push(`record ${member}`);
      records.push({ member, objects });
    },
  };
  const storage = {
    delete: async (k: string) => {
      if (opts.failing?.includes(k)) throw new Error('R2 DELETE failed with 500');
      events.push(`delete ${k}`);
      deleted.push(k);
    },
  };
  const handler = createHandler({ serviceRoleKey: key, db, storage, log: () => {}, now: opts.clock });
  const call = (auth = `Bearer ${key}`) =>
    handler(new Request('http://x', { method: 'POST', headers: { Authorization: auth } }));
  return { call, events, deleted, users, records };
}

Deno.test('erases each queued Member: their media, then a record, then their account', async () => {
  const f = fakes();
  const res = await f.call();
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { erased: 2, failed: 0, deferred: 0 });
  assertEquals(f.events, [
    'delete asha/1.jpg',
    'delete chat/c1/a.jpg',
    'record asha',
    'user asha',
    'delete ravi/1.jpg',
    'record ravi',
    'user ravi',
  ]);
  assertEquals(f.records, [{ member: 'asha', objects: 2 }, { member: 'ravi', objects: 1 }]);
});

Deno.test('an account the admin API fails to delete stays queued, recorded once the retry succeeds', async () => {
  const f = fakes({ failingUser: 'asha' });
  assertEquals(await (await f.call()).json(), { erased: 1, failed: 1, deferred: 0 });
  assertEquals(f.users, ['ravi']);
});

Deno.test('a failed media delete keeps that account for the next run and goes on with the others', async () => {
  const f = fakes({ failing: ['chat/c1/a.jpg'] });
  const res = await f.call();
  assertEquals(await res.json(), { erased: 1, failed: 1, deferred: 0 });
  assertEquals(f.users, ['ravi']);
  assertEquals(f.records, [{ member: 'ravi', objects: 1 }]);
});

Deno.test('only the service role may run it', async () => {
  const f = fakes();
  assertEquals((await f.call('Bearer someone-else')).status, 401);
  assertEquals(f.deleted, []);
  assertEquals(f.users, []);
});

Deno.test('past its time budget a run leaves the remaining Members for the next one', async () => {
  let t = 0;
  const f = fakes({ clock: () => (t += 60_000) });
  assertEquals(await (await f.call()).json(), { erased: 1, failed: 0, deferred: 1 });
  assertEquals(f.users, ['asha']);
});

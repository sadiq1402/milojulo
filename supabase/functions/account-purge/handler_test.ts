import { assertEquals } from '@std/assert';
import { createHandler, type Db } from './handler.ts';

const key = 'service-role-key';

function fakes(opts: { failing?: string[] } = {}) {
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
      users.push(member);
    },
    recordErasure: async (member, _requestedAt, objects) => {
      records.push({ member, objects });
    },
  };
  const storage = {
    delete: async (k: string) => {
      if (opts.failing?.includes(k)) throw new Error('R2 DELETE failed with 500');
      deleted.push(k);
    },
  };
  const handler = createHandler({ serviceRoleKey: key, db, storage, log: () => {} });
  const call = (auth = `Bearer ${key}`) =>
    handler(new Request('http://x', { method: 'POST', headers: { Authorization: auth } }));
  return { call, deleted, users, records };
}

Deno.test('erases each queued Member: their media, then their account, then a record', async () => {
  const f = fakes();
  const res = await f.call();
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { erased: 2, failed: 0 });
  assertEquals(f.deleted, ['asha/1.jpg', 'chat/c1/a.jpg', 'ravi/1.jpg']);
  assertEquals(f.users, ['asha', 'ravi']);
  assertEquals(f.records, [{ member: 'asha', objects: 2 }, { member: 'ravi', objects: 1 }]);
});

Deno.test('a failed media delete keeps that account for the next run and goes on with the others', async () => {
  const f = fakes({ failing: ['chat/c1/a.jpg'] });
  const res = await f.call();
  assertEquals(await res.json(), { erased: 1, failed: 1 });
  assertEquals(f.users, ['ravi']);
  assertEquals(f.records, [{ member: 'ravi', objects: 1 }]);
});

Deno.test('only the service role may run it', async () => {
  const f = fakes();
  assertEquals((await f.call('Bearer someone-else')).status, 401);
  assertEquals(f.deleted, []);
  assertEquals(f.users, []);
});

import { assertEquals } from '@std/assert';
import { createHandler, type Db, type ExpiredMedia } from './handler.ts';

const key = 'service-role-key';

function fakes(opts: { expired?: ExpiredMedia[]; failing?: string[]; clock?: () => number } = {}) {
  let due = [...(opts.expired ?? [])];
  const deleted: string[] = [];
  const marked: string[] = [];
  const db: Db = {
    expired: async (batch, skip) => due.filter((m) => !skip.includes(m.messageId)).slice(0, batch),
    markDeleted: async (ids) => {
      marked.push(...ids);
      due = due.filter((m) => !ids.includes(m.messageId));
    },
  };
  const storage = {
    delete: async (k: string) => {
      if (opts.failing?.includes(k)) throw new Error('R2 DELETE failed with 500');
      deleted.push(k);
    },
  };
  const handler = createHandler({ serviceRoleKey: key, db, storage, batch: 2, log: () => {}, now: opts.clock });
  const call = (auth = `Bearer ${key}`) =>
    handler(new Request('http://x', { method: 'POST', headers: { Authorization: auth } }));
  return { call, deleted, marked };
}

const media = (id: string): ExpiredMedia => ({
  messageId: id,
  mediaKey: `chat/c/${id}.jpg`,
});

Deno.test('deletes expired files in batches and marks their messages', async () => {
  const f = fakes({ expired: [media('a'), media('b'), media('c')] });
  assertEquals(await (await f.call()).json(), { purged: 3, failed: 0 });
  assertEquals(f.deleted, ['chat/c/a.jpg', 'chat/c/b.jpg', 'chat/c/c.jpg']);
  assertEquals(f.marked, ['a', 'b', 'c']);
});

// A file whose report evidence hasn't been copied yet is held back by the database (#160), so it
// never reaches this function; it comes back on a later run, once the copy exists.

Deno.test('a file that fails to delete stays unmarked for the next run, and the run still ends', async () => {
  const f = fakes({ expired: [media('a'), media('b')], failing: ['chat/c/a.jpg'] });
  assertEquals(await (await f.call()).json(), { purged: 1, failed: 1 });
  assertEquals(f.marked, ['b']);
});

Deno.test('stops starting batches past its time budget', async () => {
  let t = 0;
  const f = fakes({ expired: [media('a'), media('b'), media('c')], clock: () => (t += 60_000) });
  assertEquals(await (await f.call()).json(), { purged: 2, failed: 0 });
});

Deno.test('only the service role may run it', async () => {
  const f = fakes({ expired: [media('a')] });
  assertEquals((await f.call('Bearer someone-else')).status, 401);
  assertEquals(f.deleted, []);
});

Deno.test('files that keep failing do not hold back the ones behind them', async () => {
  const f = fakes({ expired: [media('a'), media('b'), media('c')], failing: ['chat/c/a.jpg', 'chat/c/b.jpg'] });
  assertEquals(await (await f.call()).json(), { purged: 1, failed: 2 });
  assertEquals(f.marked, ['c']);
});

Deno.test('answers only POST', async () => {
  const f = fakes();
  const handler = createHandler({
    serviceRoleKey: key,
    db: { expired: async () => [], markDeleted: async () => {} },
    storage: { delete: async () => {} },
  });
  assertEquals((await handler(new Request('http://x', { method: 'GET' }))).status, 405);
  assertEquals(f.deleted, []);
});

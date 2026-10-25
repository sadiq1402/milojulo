import { assertEquals } from '@std/assert';
import { createHandler, type Db, type PendingCopy } from './handler.ts';

const key = 'service-role-key';

function fakes(
  opts: { pending?: PendingCopy[]; failing?: string[]; missing?: string[]; orphaned?: string[] } = {},
) {
  let waiting = [...(opts.pending ?? [])];
  const copied: string[] = [];
  const marked: string[] = [];
  const deleted: string[] = [];
  const db: Db = {
    pending: async (batch, skip) => waiting.filter((c) => !skip.includes(c.reportId)).slice(0, batch),
    markCopied: async (ids) => {
      marked.push(...ids);
      const sources = waiting.filter((c) => ids.includes(c.reportId)).map((c) => c.sourceKey);
      waiting = waiting.filter((c) => !ids.includes(c.reportId));
      return sources.filter((k) => opts.orphaned?.includes(k));
    },
  };
  const storage = {
    head: async (k: string) => (opts.missing?.includes(k) ? null : { size: 1, contentType: 'image/jpeg' }),
    copy: async (source: string, destination: string) => {
      if (opts.failing?.includes(source)) throw new Error('R2 copy failed with 500');
      copied.push(`${source} -> ${destination}`);
    },
    delete: async (k: string) => {
      deleted.push(k);
    },
  };
  const handler = createHandler({ serviceRoleKey: key, db, storage, batch: 2, log: () => {} });
  const call = (auth = `Bearer ${key}`) =>
    handler(new Request('http://x', { method: 'POST', headers: { Authorization: auth } }));
  return { call, copied, marked, deleted };
}

const report = (id: string): PendingCopy => ({
  reportId: id,
  sourceKey: `member/${id}.jpg`,
  evidenceKey: `evidence/${id}.jpg`,
});

Deno.test("copies each report's media to its evidence key and marks it copied", async () => {
  const f = fakes({ pending: [report('a'), report('b'), report('c')] });
  assertEquals(await (await f.call()).json(), { copied: 3, gone: 0, failed: 0 });
  assertEquals(f.copied, [
    'member/a.jpg -> evidence/a.jpg',
    'member/b.jpg -> evidence/b.jpg',
    'member/c.jpg -> evidence/c.jpg',
  ]);
  assertEquals(f.marked, ['a', 'b', 'c']);
});

Deno.test('a source that is already gone is marked, not retried for ever', async () => {
  const f = fakes({ pending: [report('a'), report('b')], missing: ['member/a.jpg'] });
  assertEquals(await (await f.call()).json(), { copied: 1, gone: 1, failed: 0 });
  assertEquals(f.copied, ['member/b.jpg -> evidence/b.jpg']);
  assertEquals(f.marked, ['a', 'b']);
});

Deno.test('a copy that fails is left for the next run, and does not hold back the rest', async () => {
  const f = fakes({ pending: [report('a'), report('b')], failing: ['member/a.jpg'] });
  assertEquals(await (await f.call()).json(), { copied: 1, gone: 0, failed: 1 });
  assertEquals(f.marked, ['b']);
});

Deno.test('an original nothing points at any more goes once its copy is safe', async () => {
  const f = fakes({ pending: [report('a'), report('b')], orphaned: ['member/a.jpg'] });
  assertEquals(await (await f.call()).json(), { copied: 2, gone: 0, failed: 0 });
  assertEquals(f.deleted, ['member/a.jpg']);
});

Deno.test('only the service role, only POST', async () => {
  const f = fakes({ pending: [report('a')] });
  assertEquals((await f.call('Bearer wrong')).status, 401);
  assertEquals(f.copied, []);
  const handler = createHandler({
    serviceRoleKey: key,
    db: { pending: async () => [], markCopied: async () => [] },
    storage: { head: async () => null, copy: async () => {}, delete: async () => {} },
  });
  assertEquals((await handler(new Request('http://x', { method: 'GET' }))).status, 405);
});

export interface QueuedErasure {
  memberId: string;
  requestedAt: string;
}

export interface Db {
  queue(): Promise<QueuedErasure[]>;
  mediaKeys(memberId: string): Promise<string[]>;
  deleteUser(memberId: string): Promise<void>;
  recordErasure(memberId: string, requestedAt: string, objectsDeleted: number): Promise<void>;
}

export interface Deps {
  // The shared secret the database sends when it calls this function (DISPATCH_SECRET; Vault holds the same).
  callSecret: string;
  db: Db;
  storage: { delete(key: string): Promise<void> };
  log?: (message: string) => void;
  now?: () => number;
}

// Edge Functions stop at 150 s; no new Member is started after this, the rest wait for the next run.
const budgetMs = 100_000;
const parallelDeletes = 8;

async function deleteAll(keys: string[], remove: (key: string) => Promise<void>) {
  for (let i = 0; i < keys.length; i += parallelDeletes) {
    await Promise.all(keys.slice(i, i + parallelDeletes).map(remove));
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function createHandler(deps: Deps) {
  const log = deps.log ?? console.error;
  const now = deps.now ?? Date.now;
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'use POST' });
    if (req.headers.get('Authorization') !== `Bearer ${deps.callSecret}`) {
      return json(401, { error: 'service role only' });
    }
    const started = now();
    let erased = 0;
    let failed = 0;
    let deferred = 0;
    for (const { memberId, requestedAt } of await deps.db.queue()) {
      if (now() - started > budgetMs) {
        deferred++;
        continue;
      }
      try {
        // Media first: once the account is gone, nothing points at these keys any more. The record goes in
        // before the account, whose cascade takes the queue row with it; a retry re-records harmlessly.
        const keys = await deps.db.mediaKeys(memberId);
        await deleteAll(keys, (key) => deps.storage.delete(key));
        await deps.db.recordErasure(memberId, requestedAt, keys.length);
        await deps.db.deleteUser(memberId);
        erased++;
      } catch (error) {
        // Left queued: R2 deletes are idempotent, so the next run starts over safely.
        log(`account-purge: ${memberId}: ${(error as Error).message}`);
        failed++;
      }
    }
    return json(200, { erased, failed, deferred });
  };
}

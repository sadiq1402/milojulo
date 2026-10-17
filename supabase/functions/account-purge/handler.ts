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
  serviceRoleKey: string;
  db: Db;
  storage: { delete(key: string): Promise<void> };
  log?: (message: string) => void;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function createHandler(deps: Deps) {
  const log = deps.log ?? console.error;
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'use POST' });
    if (req.headers.get('Authorization') !== `Bearer ${deps.serviceRoleKey}`) {
      return json(401, { error: 'service role only' });
    }
    let erased = 0;
    let failed = 0;
    for (const { memberId, requestedAt } of await deps.db.queue()) {
      try {
        // Media first: once the account is gone, nothing points at these keys any more.
        const keys = await deps.db.mediaKeys(memberId);
        for (const key of keys) await deps.storage.delete(key);
        await deps.db.deleteUser(memberId);
        await deps.db.recordErasure(memberId, requestedAt, keys.length);
        erased++;
      } catch (error) {
        // Left queued: R2 deletes are idempotent, so the next run starts over safely.
        log(`account-purge: ${memberId}: ${(error as Error).message}`);
        failed++;
      }
    }
    return json(200, { erased, failed });
  };
}

export interface ExpiredMedia {
  messageId: string;
  mediaKey: string;
  keepFile: boolean;
}

export interface Db {
  expired(batch: number, skip: string[]): Promise<ExpiredMedia[]>;
  markDeleted(messageIds: string[]): Promise<void>;
}

export interface Deps {
  serviceRoleKey: string;
  db: Db;
  storage: { delete(key: string): Promise<void> };
  batch?: number;
  log?: (message: string) => void;
  now?: () => number;
}

// Edge Functions stop at 150 s; no batch is started after this, the rest wait for tomorrow's run.
const budgetMs = 100_000;
const parallelDeletes = 8;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function createHandler(deps: Deps) {
  const log = deps.log ?? console.error;
  const now = deps.now ?? Date.now;
  const batch = deps.batch ?? 500;
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'use POST' });
    if (req.headers.get('Authorization') !== `Bearer ${deps.serviceRoleKey}`) {
      return json(401, { error: 'service role only' });
    }
    const started = now();
    let purged = 0;
    let kept = 0;
    const failed = new Set<string>();
    while (now() - started <= budgetMs) {
      const due = await deps.db.expired(batch, [...failed]);
      if (due.length === 0) break;
      const done: string[] = [];
      for (let i = 0; i < due.length; i += parallelDeletes) {
        await Promise.all(
          due.slice(i, i + parallelDeletes).map(async (m) => {
            if (m.keepFile) {
              kept++;
              done.push(m.messageId);
              return;
            }
            try {
              await deps.storage.delete(m.mediaKey);
              purged++;
              done.push(m.messageId);
            } catch (error) {
              // Left unmarked, so tomorrow's run tries again; deletes are idempotent.
              log(`purge-chat-media: ${m.mediaKey}: ${(error as Error).message}`);
              failed.add(m.messageId);
            }
          }),
        );
      }
      if (done.length > 0) await deps.db.markDeleted(done);
    }
    return json(200, { purged, kept, failed: failed.size });
  };
}

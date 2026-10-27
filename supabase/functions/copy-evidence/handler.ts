export interface PendingCopy {
  reportId: string;
  sourceKey: string;
  evidenceKey: string;
}

export interface Db {
  pending(batch: number, skip: string[]): Promise<PendingCopy[]>;
  // Stamps the copies and answers with the originals nothing points at any more.
  markCopied(reportIds: string[]): Promise<string[]>;
}

export interface Deps {
  // The shared secret the database sends when it calls this function (DISPATCH_SECRET; Vault holds the same).
  callSecret: string;
  db: Db;
  storage: {
    head(key: string): Promise<unknown | null>;
    copy(sourceKey: string, destinationKey: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
  batch?: number;
  log?: (message: string) => void;
  now?: () => number;
}

// Edge Functions stop at 150 s; no batch is started after this, the rest wait for the next run.
const budgetMs = 100_000;
const parallelCopies = 8;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function createHandler(deps: Deps) {
  const log = deps.log ?? console.error;
  const now = deps.now ?? Date.now;
  const batch = deps.batch ?? 200;
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'use POST' });
    if (req.headers.get('Authorization') !== `Bearer ${deps.callSecret}`) {
      return json(401, { error: 'service role only' });
    }
    const started = now();
    let copied = 0;
    let gone = 0;
    const failed = new Set<string>();
    while (now() - started <= budgetMs) {
      const waiting = await deps.db.pending(batch, [...failed]);
      if (waiting.length === 0) break;
      const done: string[] = [];
      for (let i = 0; i < waiting.length; i += parallelCopies) {
        await Promise.all(
          waiting.slice(i, i + parallelCopies).map(async (c) => {
            try {
              // The file can be gone already: a photo its owner replaced before this ran. There is
              // nothing left to copy, so the report is marked rather than retried for ever.
              if (await deps.storage.head(c.sourceKey) === null) {
                log(`copy-evidence: ${c.sourceKey} is gone, report ${c.reportId} keeps no media`);
                gone++;
                done.push(c.reportId);
                return;
              }
              await deps.storage.copy(c.sourceKey, c.evidenceKey);
              copied++;
              done.push(c.reportId);
            } catch (error) {
              // Left unmarked, so the next run tries again; copying the same key twice is harmless.
              log(`copy-evidence: ${c.sourceKey}: ${(error as Error).message}`);
              failed.add(c.reportId);
            }
          }),
        );
      }
      if (done.length > 0) {
        // A photo deleted or replaced while its copy was pending, or media an account purge waited
        // on, leaves the original with nothing pointing at it. It goes now the copy is safe.
        for (const key of await deps.db.markCopied(done)) {
          try {
            await deps.storage.delete(key);
          } catch (error) {
            // Harmless: the file stays until the R2 lifecycle rule or a later report's copy clears it.
            log(`copy-evidence: deleting spent original ${key}: ${(error as Error).message}`);
          }
        }
      }
    }
    return json(200, { copied, gone, failed: failed.size });
  };
}

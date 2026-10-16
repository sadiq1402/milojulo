export interface QueuedPush {
  recipientId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export interface Db {
  queuedPush(id: number): Promise<QueuedPush | null>;
  deviceTokens(memberId: string): Promise<string[]>;
  deleteTokens(tokens: string[]): Promise<void>;
  deleteQueuedPush(id: number): Promise<void>;
}

export interface Deps {
  serviceRoleKey: string;
  projectId: string;
  accessToken(): Promise<string>;
  db: Db;
  fetch: typeof fetch;
  log?: (message: string) => void;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// FCM's answer for a token that will never work again: 404 UNREGISTERED, 403 SENDER_ID_MISMATCH (another
// app's token), or a 400 that blames the token (a 400 about the rest of the message must not cost the token).
async function isDeadToken(res: Response): Promise<boolean> {
  if (![400, 403, 404].includes(res.status)) {
    await res.body?.cancel();
    return false;
  }
  const error = (await res.json().catch(() => null))?.error;
  const codes: string[] = (error?.details ?? []).map((d: { errorCode?: string }) => d.errorCode);
  if (res.status === 404 || codes.includes('UNREGISTERED')) return true;
  if (res.status === 403) return codes.includes('SENDER_ID_MISMATCH');
  return error?.status === 'INVALID_ARGUMENT' && /registration token/i.test(error?.message ?? '');
}

const isTransient = (status: number) => status === 429 || status >= 500;

export function createHandler(deps: Deps) {
  const log = deps.log ?? console.error;
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'use POST' });
    if (req.headers.get('Authorization') !== `Bearer ${deps.serviceRoleKey}`) {
      return json(401, { error: 'service role only' });
    }
    const id = (await req.json().catch(() => null))?.id;
    if (!Number.isInteger(id)) return json(400, { error: 'id must be a number' });

    const push = await deps.db.queuedPush(id);
    if (!push) return json(200, { sent: 0 });
    const tokens = await deps.db.deviceTokens(push.recipientId);

    let sent = 0;
    let retryable = false;
    if (tokens.length > 0) {
      const accessToken = await deps.accessToken();
      const data = Object.fromEntries(Object.entries(push.data).map(([k, v]) => [k, String(v)]));
      const dead: string[] = [];
      for (const token of tokens) {
        const res = await deps.fetch(`https://fcm.googleapis.com/v1/projects/${deps.projectId}/messages:send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: push.title, body: push.body },
              data,
              android: { priority: 'high' },
            },
          }),
        });
        if (res.ok) {
          sent++;
          await res.body?.cancel();
        } else if (isTransient(res.status)) {
          retryable = true;
          await res.body?.cancel();
          log(`push: FCM answered ${res.status} for push ${id}; kept in the queue`);
        } else if (await isDeadToken(res)) {
          dead.push(token);
        } else {
          log(`push: FCM answered ${res.status} for push ${id}`);
        }
      }
      if (dead.length > 0) await deps.db.deleteTokens(dead);
    }
    // A push FCM couldn't take for now stays queued for a later retry.
    if (!retryable) await deps.db.deleteQueuedPush(id);
    return json(200, { sent });
  };
}

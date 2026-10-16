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

// FCM's answer for a token that will never work again: 404 UNREGISTERED, or a 400 that blames the token
// (a 400 about the rest of the message must not cost the Member their token).
async function isDeadToken(res: Response): Promise<boolean> {
  if (res.status !== 404 && res.status !== 400) {
    await res.body?.cancel();
    return false;
  }
  const error = (await res.json().catch(() => null))?.error;
  if (res.status === 404) return true;
  return error?.status === 'INVALID_ARGUMENT' && /registration token/i.test(error?.message ?? '');
}

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
        } else if (await isDeadToken(res)) {
          dead.push(token);
        } else {
          log(`push: FCM answered ${res.status} for push ${id}`);
        }
      }
      if (dead.length > 0) await deps.db.deleteTokens(dead);
    }
    await deps.db.deleteQueuedPush(id);
    return json(200, { sent });
  };
}

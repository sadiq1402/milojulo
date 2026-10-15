import { supabase } from '../../lib/supabase';

// Shared by profile photos (#35) and chat media (#45): calls to the `media` Edge Function.

export const fallback =
  "That didn't work. Check your connection and try again.";

export type Refusals = Record<string, string>;

// Keys are the function's or the database's exact messages; anything else reads as `fallback`.
export const refusalFrom = (refusals: Refusals) => (message?: string) =>
  new Error((message && refusals[message]) || fallback);

// The function answers refusals as { error: '<message>' }; supabase-js hands back the Response.
async function refusalMessage(error: unknown): Promise<string | undefined> {
  const context = (error as { context?: { json?: () => Promise<unknown> } })
    .context;
  if (typeof context?.json !== 'function') {
    return undefined;
  }
  try {
    const body = (await context.json()) as { error?: unknown };
    return typeof body?.error === 'string' ? body.error : undefined;
  } catch {
    return undefined;
  }
}

export async function invokeMedia<T>(
  body: Record<string, unknown>,
  refusals: Refusals,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('media', { body });
  if (error) {
    throw refusalFrom(refusals)(await refusalMessage(error));
  }
  return data as T;
}

// The function signs at most this many links per call; larger lists go in batches.
export async function fetchSignedUrls(
  action: 'photo-urls' | 'chat-urls',
  idsField: 'photoIds' | 'messageIds',
  ids: string[],
  refusals: Refusals,
): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += 60) {
    batches.push(unique.slice(i, i + 60));
  }
  const results = await Promise.all(
    batches.map(batch =>
      invokeMedia<{ urls: Record<string, string> }>(
        { action, [idsField]: batch },
        refusals,
      ),
    ),
  );
  return Object.assign({}, ...results.map(result => result.urls));
}

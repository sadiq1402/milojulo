// Push (#36): sends one push_queue row to the recipient's phones through FCM. The database decides who is
// told what (decision 47); this file only wires in Supabase, FCM and the service account.
import { createClient } from '@supabase/supabase-js';
import { createHandler, type Db } from './handler.ts';
import { createAccessToken, type ServiceAccount } from './fcm_auth.ts';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`push: ${name} is not set`);
  return value;
}

const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(env('SUPABASE_URL'), serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const account: ServiceAccount = JSON.parse(env('FCM_SERVICE_ACCOUNT'));

function check<T>({ data, error }: { data: T; error: { message: string } | null }, what: string): T {
  if (error) throw new Error(`push: ${what}: ${error.message}`);
  return data;
}

const db: Db = {
  async queuedPush(id) {
    const row = check(
      await supabase.from('push_queue').select('recipient_id, title, body, data').eq('id', id).maybeSingle(),
      'load push',
    );
    return row ? { recipientId: row.recipient_id, title: row.title, body: row.body, data: row.data } : null;
  },
  async deviceTokens(memberId) {
    const rows = check(await supabase.from('device_tokens').select('token').eq('user_id', memberId), 'load tokens');
    return (rows ?? []).map((r) => r.token);
  },
  async deleteTokens(tokens) {
    check(await supabase.from('device_tokens').delete().in('token', tokens), 'delete tokens');
  },
  async deleteQueuedPush(id) {
    check(await supabase.from('push_queue').delete().eq('id', id), 'delete push');
  },
};

Deno.serve(createHandler({
  serviceRoleKey,
  projectId: account.project_id,
  accessToken: createAccessToken(account, fetch),
  db,
  fetch,
}));

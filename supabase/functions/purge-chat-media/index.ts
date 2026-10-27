// Chat media purge (#97, Media Expiry): deletes chat media older than 90 days. The database decides
// what is due (expired_chat_media, which holds back a file whose report evidence is still being
// copied, #160); this file only wires in Supabase and R2.
import { createClient } from '@supabase/supabase-js';
import { createR2 } from '../_shared/r2.ts';
import { createHandler, type Db } from './handler.ts';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`purge-chat-media: ${name} is not set`);
  return value;
}

const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(env('SUPABASE_URL'), serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function check<T>({ data, error }: { data: T; error: { message: string } | null }, what: string): T {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

const db: Db = {
  async expired(batch, skip) {
    const rows = check(await supabase.rpc('expired_chat_media', { batch, skip }), 'load expired media');
    return (rows ?? []).map((r: { message_id: string; media_key: string }) => ({
      messageId: r.message_id,
      mediaKey: r.media_key,
    }));
  },
  async markDeleted(messageIds) {
    check(await supabase.rpc('mark_chat_media_deleted', { message_ids: messageIds }), 'mark deleted');
  },
};

const storage = createR2({
  accountId: env('R2_ACCOUNT_ID'),
  accessKeyId: env('R2_ACCESS_KEY_ID'),
  secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  bucket: env('R2_BUCKET'),
  now: () => new Date(),
});

Deno.serve(createHandler({ callSecret: env('DISPATCH_SECRET'), db, storage }));

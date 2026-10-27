// Account purge (#96): finishes delete_account() for each queued erasure. The database decides which media
// goes (erasure_media_keys); this file only wires in Supabase and R2.
import { createClient } from '@supabase/supabase-js';
import { createR2 } from '../_shared/r2.ts';
import { createHandler, type Db } from './handler.ts';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`account-purge: ${name} is not set`);
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
  async queue() {
    const rows = check(await supabase.rpc('erasure_queue'), 'load queue');
    return (rows ?? []).map((r: { member_id: string; requested_at: string }) => ({
      memberId: r.member_id,
      requestedAt: r.requested_at,
    }));
  },
  async mediaKeys(memberId) {
    return check(await supabase.rpc('erasure_media_keys', { member: memberId }), 'load media keys') ?? [];
  },
  async deleteUser(memberId) {
    const { error } = await supabase.auth.admin.deleteUser(memberId);
    if (error) throw new Error(`delete user: ${error.message}`);
  },
  async recordErasure(memberId, requestedAt, objectsDeleted) {
    check(
      await supabase.rpc('record_erasure', {
        member: memberId,
        requested_at: requestedAt,
        objects_deleted: objectsDeleted,
      }),
      'record erasure',
    );
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

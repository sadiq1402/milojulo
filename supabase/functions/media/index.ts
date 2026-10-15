// Media links (#35, #12): signs R2 upload and download URLs for profile photos and chat media. The rules live in the
// database functions and handler.ts; this file only wires in Supabase, R2 and the clock.
import { createClient } from '@supabase/supabase-js';
import { createHandler, type Db, Refusal } from './handler.ts';
import { createR2 } from './r2.ts';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`media: ${name} is not set`);
  return value;
}

const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Raised database messages (P0001) are refusals; anything else is unexpected.
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error.code === 'P0001' ? new Refusal(error.message) : new Error(`${fn}: ${error.message}`);
  return data as T;
}

const db: Db = {
  async startPhotoUpload(memberId, position) {
    const rows = await rpc<{ photo_id: string; upload_key: string; discarded_keys: string[] }[]>(
      'start_photo_upload',
      { member_id: memberId, photo_position: position },
    );
    return { photoId: rows[0].photo_id, uploadKey: rows[0].upload_key, discardedKeys: rows[0].discarded_keys };
  },
  async pendingPhotoUpload(memberId, uploadId) {
    const rows = await rpc<{ upload_key: string; object_key: string }[]>(
      'pending_photo_upload',
      { member_id: memberId, upload_id: uploadId },
    );
    return rows[0] ? { uploadKey: rows[0].upload_key, objectKey: rows[0].object_key } : null;
  },
  confirmPhotoUpload: (memberId, uploadId) =>
    rpc<string | null>('confirm_photo_upload', { member_id: memberId, upload_id: uploadId }),
  deletePhoto: (memberId, photoId) => rpc<string | null>('delete_photo', { member_id: memberId, photo_id: photoId }),
  async photoLinks(viewerId, photoIds) {
    const rows = await rpc<{ photo_id: string; object_key: string }[]>(
      'photo_links',
      { viewer: viewerId, photo_ids: photoIds },
    );
    return rows.map((r) => ({ photoId: r.photo_id, objectKey: r.object_key }));
  },
  async startChatUpload(memberId, connectionId, kind, size) {
    const rows = await rpc<{ upload_id: string; upload_key: string }[]>(
      'start_chat_upload',
      { member_id: memberId, connection_id: connectionId, kind, size },
    );
    return { uploadId: rows[0].upload_id, uploadKey: rows[0].upload_key };
  },
  async pendingChatUpload(memberId, uploadId) {
    const rows = await rpc<{ upload_key: string; media_key: string; mime: string; size: number }[]>(
      'pending_chat_upload',
      { member_id: memberId, upload_id: uploadId },
    );
    return rows[0]
      ? { uploadKey: rows[0].upload_key, mediaKey: rows[0].media_key, mime: rows[0].mime, size: rows[0].size }
      : null;
  },
  confirmChatUpload: (memberId, uploadId) =>
    rpc<string>('confirm_chat_upload', { member_id: memberId, upload_id: uploadId }),
  async chatMediaLinks(viewerId, messageIds) {
    const rows = await rpc<{ message_id: string; media_key: string }[]>(
      'chat_media_links',
      { viewer: viewerId, message_ids: messageIds },
    );
    return rows.map((r) => ({ messageId: r.message_id, mediaKey: r.media_key }));
  },
};

const handler = createHandler({
  async userIdFor(token) {
    const { data, error } = await supabase.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  db,
  storage: createR2({
    accountId: env('R2_ACCOUNT_ID'),
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    bucket: env('R2_BUCKET'),
    now: () => new Date(),
  }),
});

Deno.serve(handler);

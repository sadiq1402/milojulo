import type { Storage } from './r2.ts';

// A refusal raised by a database function (its exact message); anything else is unexpected.
export class Refusal extends Error {}

export interface Db {
  // Upload keys are staging keys (uploads/...); object keys are live keys.
  startPhotoUpload(
    memberId: string,
    position: number,
  ): Promise<{ photoId: string; uploadKey: string; discardedKeys: string[] }>;
  pendingPhotoUpload(memberId: string, uploadId: string): Promise<{ uploadKey: string; objectKey: string } | null>;
  confirmPhotoUpload(memberId: string, uploadId: string): Promise<string | null>;
  deletePhoto(memberId: string, photoId: string): Promise<string | null>;
  photoLinks(viewerId: string, photoIds: string[]): Promise<{ photoId: string; objectKey: string }[]>;
  // A chat upload slot; the media key is where the file goes and what the message carries.
  startChatUpload(memberId: string, connectionId: string, kind: ChatKind, mime: string, size: number): Promise<string>;
  chatMediaLinks(viewerId: string, messageIds: string[]): Promise<{ messageId: string; mediaKey: string }[]>;
}

export type ChatKind = 'image' | 'video' | 'voice';

export interface Deps {
  // The signed-in Member's id for a user JWT, or null.
  userIdFor(token: string): Promise<string | null>;
  db: Db;
  storage: Storage;
  log?: (message: string) => void;
}

export const UPLOAD_EXPIRES_IN = 300;
export const DOWNLOAD_EXPIRES_IN = 600;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_IDS = 60;
export const MAX_MESSAGE_IDS = 60;

// What each chat media kind accepts.
const CHAT_MEDIA: Record<ChatKind, { mime: string; maxBytes: number; refusal: string }> = {
  image: { mime: 'image/jpeg', maxBytes: 5 * 1024 * 1024, refusal: 'image must be a JPEG of at most 5 MB' },
  video: { mime: 'video/mp4', maxBytes: 20 * 1024 * 1024, refusal: 'video must be an MP4 of at most 20 MB' },
  voice: { mime: 'audio/mp4', maxBytes: 5 * 1024 * 1024, refusal: 'voice note must be an M4A of at most 5 MB' },
};
const JPEG = 'image/jpeg';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Database refusals and the status each gets; any other database error is a 500.
const REFUSAL_STATUS: Record<string, number> = {
  'accept the terms first': 403,
  'your account cannot add photos': 403,
  'choose a photo position from 1 to 4': 400,
  'no photo upload to confirm': 404,
  'no photo to delete': 404,
  'add at least 2 photos': 400,
  'no connection': 404,
  'media is off in this chat': 403,
  'choose image, video or voice': 400,
};

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export function createHandler(deps: Deps): (req: Request) => Promise<Response> {
  const log = deps.log ?? ((m: string) => console.error(m));

  // Files left behind are harmless to the Member, so a failed delete is logged, never surfaced.
  async function deleteQuietly(keys: (string | null)[]) {
    const results = await Promise.allSettled(keys.filter((k): k is string => !!k).map((k) => deps.storage.delete(k)));
    for (const r of results) if (r.status === 'rejected') log(`media: R2 delete failed: ${r.reason}`);
  }

  async function db<T>(call: Promise<T>): Promise<T> {
    try {
      return await call;
    } catch (e) {
      if (e instanceof Refusal && e.message in REFUSAL_STATUS) {
        throw new HttpError(REFUSAL_STATUS[e.message], e.message);
      }
      throw e;
    }
  }

  async function photoUpload(me: string, body: Record<string, unknown>) {
    const { position, contentType, size } = body;
    if (!Number.isInteger(position) || (position as number) < 1 || (position as number) > 4) {
      throw new HttpError(400, 'choose a photo position from 1 to 4');
    }
    if (contentType !== JPEG || !Number.isInteger(size) || (size as number) < 1 || (size as number) > MAX_PHOTO_BYTES) {
      throw new HttpError(400, 'photo must be a JPEG of at most 5 MB');
    }
    const slot = await db(deps.db.startPhotoUpload(me, position as number));
    await deleteQuietly(slot.discardedKeys);
    const uploadUrl = await deps.storage.uploadUrl(slot.uploadKey, JPEG, size as number, UPLOAD_EXPIRES_IN);
    return { photoId: slot.photoId, uploadUrl, expiresIn: UPLOAD_EXPIRES_IN };
  }

  async function photoConfirm(me: string, body: Record<string, unknown>) {
    const { photoId } = body;
    if (typeof photoId !== 'string' || !UUID.test(photoId)) throw new HttpError(404, 'no photo upload to confirm');
    const slot = await db(deps.db.pendingPhotoUpload(me, photoId));
    if (!slot) throw new HttpError(404, 'no photo upload to confirm');

    const staged = await deps.storage.head(slot.uploadKey);
    if (!staged || staged.size < 1 || staged.size > MAX_PHOTO_BYTES || staged.contentType !== JPEG) {
      if (staged) await deleteQuietly([slot.uploadKey]);
      throw new HttpError(400, "the photo didn't arrive; try again");
    }
    // The live file is a server-side copy, out of reach of the upload link.
    await deps.storage.copy(slot.uploadKey, slot.objectKey);
    let replacedKey: string | null;
    try {
      replacedKey = await db(deps.db.confirmPhotoUpload(me, photoId));
    } catch (e) {
      await deleteQuietly([slot.objectKey]);
      throw e;
    }
    await deleteQuietly([slot.uploadKey, replacedKey]);
    return { ok: true };
  }

  async function photoDelete(me: string, body: Record<string, unknown>) {
    const { photoId } = body;
    if (typeof photoId !== 'string' || !UUID.test(photoId)) throw new HttpError(404, 'no photo to delete');
    await deleteQuietly([await db(deps.db.deletePhoto(me, photoId))]);
    return { ok: true };
  }

  async function photoUrls(me: string, body: Record<string, unknown>) {
    const { photoIds } = body;
    if (!Array.isArray(photoIds)) throw new HttpError(400, 'photoIds must be a list of photo ids');
    if (photoIds.length > MAX_PHOTO_IDS) throw new HttpError(400, `ask for at most ${MAX_PHOTO_IDS} photos at a time`);
    // Anything that isn't a photo id is left out, like any photo the caller may not see.
    const ids = [...new Set(photoIds.filter((id): id is string => typeof id === 'string' && UUID.test(id)))];
    const urls: Record<string, string> = {};
    if (ids.length > 0) {
      const links = await db(deps.db.photoLinks(me, ids));
      const signed = await Promise.all(links.map((l) => deps.storage.downloadUrl(l.objectKey, DOWNLOAD_EXPIRES_IN)));
      links.forEach((l, i) => (urls[l.photoId] = signed[i]));
    }
    return { urls, expiresIn: DOWNLOAD_EXPIRES_IN };
  }

  async function chatUpload(me: string, body: Record<string, unknown>) {
    const { connectionId, kind, contentType, size } = body;
    if (typeof kind !== 'string' || !Object.hasOwn(CHAT_MEDIA, kind)) {
      throw new HttpError(400, 'choose image, video or voice');
    }
    const rule = CHAT_MEDIA[kind as ChatKind];
    if (
      contentType !== rule.mime || !Number.isInteger(size) || (size as number) < 1 || (size as number) > rule.maxBytes
    ) {
      throw new HttpError(400, rule.refusal);
    }
    if (typeof connectionId !== 'string' || !UUID.test(connectionId)) throw new HttpError(404, 'no connection');
    const mediaKey = await db(deps.db.startChatUpload(me, connectionId, kind as ChatKind, rule.mime, size as number));
    const uploadUrl = await deps.storage.uploadUrl(mediaKey, rule.mime, size as number, UPLOAD_EXPIRES_IN);
    return { mediaKey, uploadUrl, expiresIn: UPLOAD_EXPIRES_IN };
  }

  async function chatUrls(me: string, body: Record<string, unknown>) {
    const { messageIds } = body;
    if (!Array.isArray(messageIds)) throw new HttpError(400, 'messageIds must be a list of message ids');
    if (messageIds.length > MAX_MESSAGE_IDS) {
      throw new HttpError(400, `ask for at most ${MAX_MESSAGE_IDS} messages at a time`);
    }
    const ids = [...new Set(messageIds.filter((id): id is string => typeof id === 'string' && UUID.test(id)))];
    const urls: Record<string, string> = {};
    if (ids.length > 0) {
      const links = await db(deps.db.chatMediaLinks(me, ids));
      const signed = await Promise.all(links.map((l) => deps.storage.downloadUrl(l.mediaKey, DOWNLOAD_EXPIRES_IN)));
      links.forEach((l, i) => (urls[l.messageId] = signed[i]));
    }
    return { urls, expiresIn: DOWNLOAD_EXPIRES_IN };
  }

  const actions: Record<string, (me: string, body: Record<string, unknown>) => Promise<unknown>> = {
    'photo-upload': photoUpload,
    'photo-confirm': photoConfirm,
    'photo-urls': photoUrls,
    'photo-delete': photoDelete,
    'chat-upload': chatUpload,
    'chat-urls': chatUrls,
  };

  return async (req) => {
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'use POST');
      const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
      const me = token ? await deps.userIdFor(token) : null;
      if (!me) throw new HttpError(401, 'sign in first');

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        throw new HttpError(400, 'send a JSON body');
      }
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw new HttpError(400, 'send a JSON body');
      }
      const fields = body as Record<string, unknown>;
      if (typeof fields.action !== 'string' || !Object.hasOwn(actions, fields.action)) {
        throw new HttpError(400, 'unknown action');
      }
      return json(200, await actions[fields.action](me, fields));
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      log(`media: unexpected error: ${e instanceof Error ? e.stack ?? e.message : e}`);
      return json(500, { error: 'something went wrong; try again' });
    }
  };
}

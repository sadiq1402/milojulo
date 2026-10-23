import type { Storage, StoredObject } from '../_shared/r2.ts';

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
  // Chat media: the slot's file is staged at the upload key; the media key is the live key a message carries.
  startChatUpload(
    memberId: string,
    connectionId: string,
    kind: ChatKind,
    size: number,
  ): Promise<{ uploadId: string; uploadKey: string }>;
  pendingChatUpload(
    memberId: string,
    uploadId: string,
  ): Promise<{ uploadKey: string; mediaKey: string; mime: string; size: number } | null>;
  confirmChatUpload(memberId: string, uploadId: string): Promise<string>;
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

// What each chat media kind accepts. maxBytes are fixed maximums; the database's settings row
// can only tighten them. Refusals carry no numbers, since the app matches them by text.
const CHAT_MEDIA: Record<ChatKind, { mime: string; maxBytes: number; wrongType: string; tooLarge: string }> = {
  image: {
    mime: 'image/jpeg',
    maxBytes: 5 * 1024 * 1024,
    wrongType: 'image must be a JPEG',
    tooLarge: 'image is too large',
  },
  video: {
    mime: 'video/mp4',
    maxBytes: 20 * 1024 * 1024,
    wrongType: 'video must be an MP4',
    tooLarge: 'video is too large',
  },
  voice: {
    mime: 'audio/mp4',
    maxBytes: 5 * 1024 * 1024,
    wrongType: 'voice note must be an M4A',
    tooLarge: 'voice note is too large',
  },
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
  'image is too large': 400,
  'choose image, video or voice': 400,
  'no upload to confirm': 404,
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

  // Checks a staged upload, copies it server side to its live key (out of reach of the upload
  // link), then confirms in the database; a refused confirm removes the live copy. A staged file
  // that fails the check is deleted. The caller deletes the staged file after.
  async function promote<T>(
    uploadKey: string,
    liveKey: string,
    accepts: (staged: StoredObject) => boolean,
    refusal: string,
    confirm: () => Promise<T>,
  ): Promise<T> {
    const staged = await deps.storage.head(uploadKey);
    if (!staged || !accepts(staged)) {
      if (staged) await deleteQuietly([uploadKey]);
      throw new HttpError(400, refusal);
    }
    await deps.storage.copy(uploadKey, liveKey);
    try {
      return await confirm();
    } catch (e) {
      await deleteQuietly([liveKey]);
      throw e;
    }
  }

  // Signs download links for the keys the database allowed, under the ids the app asked by.
  async function signLinks(links: { id: string; key: string }[]) {
    const signed = await Promise.all(links.map((l) => deps.storage.downloadUrl(l.key, DOWNLOAD_EXPIRES_IN)));
    const urls: Record<string, string> = {};
    links.forEach((l, i) => (urls[l.id] = signed[i]));
    return { urls, expiresIn: DOWNLOAD_EXPIRES_IN };
  }

  // Up to max distinct well-formed ids from the body's list; anything else is left out silently.
  function idList(value: unknown, max: number, noun: string): string[] {
    if (!Array.isArray(value)) throw new HttpError(400, `${noun}Ids must be a list of ${noun} ids`);
    if (value.length > max) throw new HttpError(400, `ask for at most ${max} ${noun}s at a time`);
    return [...new Set(value.filter((id): id is string => typeof id === 'string' && UUID.test(id)))];
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

    const replacedKey = await promote(
      slot.uploadKey,
      slot.objectKey,
      (staged) => staged.size >= 1 && staged.size <= MAX_PHOTO_BYTES && staged.contentType === JPEG,
      "the photo didn't arrive; try again",
      () => db(deps.db.confirmPhotoUpload(me, photoId)),
    );
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
    const ids = idList(body.photoIds, MAX_PHOTO_IDS, 'photo');
    const links = ids.length > 0 ? await db(deps.db.photoLinks(me, ids)) : [];
    return signLinks(links.map((l) => ({ id: l.photoId, key: l.objectKey })));
  }

  async function chatUpload(me: string, body: Record<string, unknown>) {
    const { connectionId, kind, contentType, size } = body;
    if (typeof kind !== 'string' || !Object.hasOwn(CHAT_MEDIA, kind)) {
      throw new HttpError(400, 'choose image, video or voice');
    }
    const rule = CHAT_MEDIA[kind as ChatKind];
    if (contentType !== rule.mime) throw new HttpError(400, rule.wrongType);
    if (!Number.isInteger(size) || (size as number) < 1) {
      throw new HttpError(400, 'size must be a whole number of bytes');
    }
    if ((size as number) > rule.maxBytes) throw new HttpError(400, rule.tooLarge);
    if (typeof connectionId !== 'string' || !UUID.test(connectionId)) throw new HttpError(404, 'no connection');
    const slot = await db(deps.db.startChatUpload(me, connectionId, kind as ChatKind, size as number));
    const uploadUrl = await deps.storage.uploadUrl(slot.uploadKey, rule.mime, size as number, UPLOAD_EXPIRES_IN);
    return { uploadId: slot.uploadId, uploadUrl, expiresIn: UPLOAD_EXPIRES_IN };
  }

  async function chatConfirm(me: string, body: Record<string, unknown>) {
    const { uploadId } = body;
    if (typeof uploadId !== 'string' || !UUID.test(uploadId)) throw new HttpError(404, 'no upload to confirm');
    const slot = await db(deps.db.pendingChatUpload(me, uploadId));
    if (!slot) throw new HttpError(404, 'no upload to confirm');
    const mediaKey = await promote(
      slot.uploadKey,
      slot.mediaKey,
      (staged) => staged.size === slot.size && staged.contentType === slot.mime,
      "the media didn't arrive; try again",
      () => db(deps.db.confirmChatUpload(me, uploadId)),
    );
    await deleteQuietly([slot.uploadKey]);
    return { mediaKey };
  }

  async function chatUrls(me: string, body: Record<string, unknown>) {
    const ids = idList(body.messageIds, MAX_MESSAGE_IDS, 'message');
    const links = ids.length > 0 ? await db(deps.db.chatMediaLinks(me, ids)) : [];
    return signLinks(links.map((l) => ({ id: l.messageId, key: l.mediaKey })));
  }

  const actions: Record<string, (me: string, body: Record<string, unknown>) => Promise<unknown>> = {
    'photo-upload': photoUpload,
    'photo-confirm': photoConfirm,
    'photo-urls': photoUrls,
    'photo-delete': photoDelete,
    'chat-upload': chatUpload,
    'chat-confirm': chatConfirm,
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

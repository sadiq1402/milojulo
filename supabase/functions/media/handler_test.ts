import { assert, assertEquals, assertMatch } from '@std/assert';
import { createHandler, type Db, Refusal } from './handler.ts';
import { createR2, type StoredObject } from '../_shared/r2.ts';

const ASHA = '00000000-0000-0000-0000-0000000000a1';
const PHOTO = '00000000-0000-0000-0000-0000000000f1';
const OTHER_PHOTO = '00000000-0000-0000-0000-0000000000f2';
const KEY = `${ASHA}/${PHOTO}.jpg`;
const STAGED = `uploads/${KEY}`;
const NOW = new Date('2026-10-14T06:30:00Z');
const MB = 1024 * 1024;
const CONN = '00000000-0000-0000-0000-0000000000c1';
const MEDIA = '00000000-0000-0000-0000-0000000000e1';
const MSG = '00000000-0000-0000-0000-0000000000d1';
const OTHER_MSG = '00000000-0000-0000-0000-0000000000d2';
const CHAT_KEY = `chat/${CONN}/${MEDIA}.jpg`;
const CHAT_STAGED = `uploads/${CHAT_KEY}`;
const CHAT_PENDING = { uploadKey: CHAT_STAGED, mediaKey: CHAT_KEY, mime: 'image/jpeg', size: 2 * MB };

// An in-memory stand-in for the database functions, plus a fake R2 behind the real signer.
function setup(opts: {
  objects?: Record<string, StoredObject>;
  refuse?: Partial<Record<keyof Db, string>>;
  pending?: Record<string, { uploadKey: string; objectKey: string }>;
  replaced?: string | null;
  deleted?: string | null;
  failHead?: boolean;
  failCopy?: boolean;
  discarded?: string[];
  visible?: Record<string, string>;
  failDelete?: boolean;
  chatVisible?: Record<string, string>;
  chatPending?: { uploadKey: string; mediaKey: string; mime: string; size: number };
} = {}) {
  const objects = { ...opts.objects };
  const r2Calls: { method: string; url: string; headers: Headers }[] = [];
  const dbCalls: string[] = [];
  const logs: string[] = [];
  const pending = { ...(opts.pending ?? { [PHOTO]: { uploadKey: STAGED, objectKey: KEY } }) };
  const refuse = async (name: keyof Db) => {
    dbCalls.push(name);
    const message = opts.refuse?.[name];
    if (message) throw new Refusal(message);
  };
  const db: Db = {
    async startPhotoUpload(memberId) {
      await refuse('startPhotoUpload');
      return { photoId: PHOTO, uploadKey: `uploads/${memberId}/${PHOTO}.jpg`, discardedKeys: opts.discarded ?? [] };
    },
    async pendingPhotoUpload(memberId, uploadId) {
      await refuse('pendingPhotoUpload');
      return memberId === ASHA ? pending[uploadId] ?? null : null;
    },
    async confirmPhotoUpload() {
      await refuse('confirmPhotoUpload');
      return opts.replaced ?? null;
    },
    async deletePhoto() {
      await refuse('deletePhoto');
      return opts.deleted === undefined ? KEY : opts.deleted;
    },
    async photoLinks(_viewer, ids) {
      await refuse('photoLinks');
      dbCalls.push(`photoLinks:${ids.length}`);
      return ids.filter((id) => opts.visible?.[id]).map((id) => ({ photoId: id, objectKey: opts.visible![id] }));
    },
    async startChatUpload(memberId, connectionId, kind, size) {
      await refuse('startChatUpload');
      dbCalls.push(`startChatUpload:${memberId}:${connectionId}:${kind}:${size}`);
      const ext = kind === 'image' ? 'jpg' : kind === 'video' ? 'mp4' : 'm4a';
      return { uploadId: MEDIA, uploadKey: `uploads/chat/${connectionId}/${MEDIA}.${ext}` };
    },
    async pendingChatUpload(memberId, uploadId) {
      await refuse('pendingChatUpload');
      return memberId === ASHA && uploadId === MEDIA ? opts.chatPending ?? CHAT_PENDING : null;
    },
    async confirmChatUpload() {
      await refuse('confirmChatUpload');
      return (opts.chatPending ?? CHAT_PENDING).mediaKey;
    },
    async chatMediaLinks(_viewer, ids) {
      await refuse('chatMediaLinks');
      dbCalls.push(`chatMediaLinks:${ids.length}`);
      return ids.filter((id) => opts.chatVisible?.[id]).map((id) => ({
        messageId: id,
        mediaKey: opts.chatVisible![id],
      }));
    },
  };
  const storage = createR2({
    accountId: 'acct',
    accessKeyId: 'AKID',
    secretAccessKey: 'secret',
    bucket: 'milojulo-media',
    now: () => NOW,
    fetch: async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      r2Calls.push({ method, url, headers: new Headers(init?.headers) });
      const key = decodeURIComponent(new URL(url).pathname.replace('/milojulo-media/', ''));
      const copySource = new Headers(init?.headers).get('x-amz-copy-source');
      if (method === 'PUT' && copySource) {
        if (opts.failCopy) return new Response(null, { status: 500 });
        const from = objects[decodeURIComponent(copySource.replace('/milojulo-media/', ''))];
        if (!from) return new Response(null, { status: 404 });
        objects[key] = { ...from };
        return new Response('<CopyObjectResult/>', { status: 200 });
      }
      if (method === 'HEAD' && opts.failHead) return new Response(null, { status: 503 });
      if (method === 'DELETE') {
        if (opts.failDelete) return new Response(null, { status: 500 });
        delete objects[key];
        return new Response(null, { status: 204 });
      }
      const o = objects[key];
      if (!o) return new Response(null, { status: 404 });
      return new Response(null, {
        status: 200,
        headers: { 'content-length': String(o.size), ...(o.contentType ? { 'content-type': o.contentType } : {}) },
      });
    },
  });
  const handler = createHandler({
    userIdFor: async (token) => (token === 'asha-jwt' ? ASHA : null),
    db,
    storage,
    log: (m) => logs.push(m),
  });
  const call = async (body: unknown, init: { token?: string | null; method?: string; raw?: string } = {}) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const token = init.token === undefined ? 'asha-jwt' : init.token;
    if (token) headers.authorization = `Bearer ${token}`;
    const method = init.method ?? 'POST';
    const res = await handler(
      new Request('http://localhost/media', {
        method,
        headers,
        body: method === 'GET' ? undefined : init.raw ?? JSON.stringify(body),
      }),
    );
    return { status: res.status, body: await res.json() };
  };
  return { call, r2Calls, dbCalls, logs, objects };
}

const upload = { action: 'photo-upload', position: 1, contentType: 'image/jpeg', size: 2 * MB };

// Every request

Deno.test('no Authorization header: 401 sign in first', async () => {
  const { call, dbCalls } = setup();
  assertEquals(await call(upload, { token: null }), { status: 401, body: { error: 'sign in first' } });
  assertEquals(dbCalls, []);
});

Deno.test('a token that is not a signed-in Member: 401 sign in first', async () => {
  const { call } = setup();
  assertEquals(await call(upload, { token: 'stale' }), { status: 401, body: { error: 'sign in first' } });
});

Deno.test('only POST is accepted', async () => {
  const { call } = setup();
  assertEquals(await call(null, { method: 'GET' }), { status: 405, body: { error: 'use POST' } });
});

Deno.test('a body that is not a JSON object is refused', async () => {
  const { call } = setup();
  assertEquals(await call(null, { raw: 'not json' }), { status: 400, body: { error: 'send a JSON body' } });
  assertEquals(await call([1]), { status: 400, body: { error: 'send a JSON body' } });
});

Deno.test('an unknown action is refused', async () => {
  const { call } = setup();
  assertEquals(await call({ action: 'toString' }), { status: 400, body: { error: 'unknown action' } });
  assertEquals(await call({}), { status: 400, body: { error: 'unknown action' } });
});

Deno.test('an unexpected database error is a 500 that hides the details', async () => {
  const logs: string[] = [];
  const handler = createHandler({
    userIdFor: async () => ASHA,
    db: { startPhotoUpload: () => Promise.reject(new Error('connection reset')) } as unknown as Db,
    storage: {} as never,
    log: (m) => logs.push(m),
  });
  const res = await handler(
    new Request('http://localhost/media', {
      method: 'POST',
      headers: { authorization: 'Bearer asha-jwt' },
      body: JSON.stringify(upload),
    }),
  );
  assertEquals({ status: res.status, body: await res.json() }, {
    status: 500,
    body: { error: 'something went wrong; try again' },
  });
  assert(logs.some((l) => l.includes('connection reset')));
});

// photo-upload

Deno.test('photo-upload gives the photo id and a PUT link for <member>/<photo>.jpg, valid 300 s', async () => {
  const { call, r2Calls } = setup();
  const res = await call(upload);
  assertEquals(res.status, 200);
  assertEquals(res.body.photoId, PHOTO);
  assertEquals(res.body.expiresIn, 300);
  const url = new URL(res.body.uploadUrl);
  assertEquals(url.origin, 'https://acct.r2.cloudflarestorage.com');
  assertEquals(url.pathname, `/milojulo-media/${STAGED}`);
  assertEquals(url.searchParams.get('X-Amz-Expires'), '300');
  assertEquals(url.searchParams.get('X-Amz-Date'), '20261014T063000Z');
  assertEquals(url.searchParams.get('X-Amz-Credential'), 'AKID/20261014/auto/s3/aws4_request');
  assertEquals(url.searchParams.get('X-Amz-SignedHeaders'), 'content-length;content-type;host');
  assertMatch(url.searchParams.get('X-Amz-Signature')!, /^[0-9a-f]{64}$/);
  assertEquals(r2Calls, []);
});

Deno.test('photo-upload refuses anything but a JPEG of 1 byte to 5 MB', async () => {
  const { call, dbCalls } = setup();
  const refused = { status: 400, body: { error: 'photo must be a JPEG of at most 5 MB' } };
  assertEquals(await call({ ...upload, contentType: 'image/png' }), refused);
  assertEquals(await call({ ...upload, contentType: undefined }), refused);
  assertEquals(await call({ ...upload, size: 5 * MB + 1 }), refused);
  assertEquals(await call({ ...upload, size: 0 }), refused);
  assertEquals(await call({ ...upload, size: '100' }), refused);
  assertEquals(await call({ ...upload, size: 1.5 }), refused);
  assertEquals(dbCalls, []);
  assertEquals((await call({ ...upload, size: 5 * MB })).status, 200);
});

Deno.test('photo-upload refuses a position outside 1 to 4', async () => {
  const { call, dbCalls } = setup();
  const refused = { status: 400, body: { error: 'choose a photo position from 1 to 4' } };
  for (const position of [0, 5, 2.5, '1', null]) assertEquals(await call({ ...upload, position }), refused);
  assertEquals(dbCalls, []);
  assertEquals((await call({ ...upload, position: 4 })).status, 200);
});

Deno.test('photo-upload passes on the database refusals as 403', async () => {
  for (const message of ['accept the terms first', 'your account cannot add photos']) {
    const { call } = setup({ refuse: { startPhotoUpload: message } });
    assertEquals(await call(upload), { status: 403, body: { error: message } });
  }
});

Deno.test('photo-upload deletes the files of discarded slots, and a failed delete does not refuse', async () => {
  const old = `${ASHA}/old.jpg`;
  const ok = setup({ discarded: [old], objects: { [old]: { size: 10, contentType: 'image/jpeg' } } });
  assertEquals((await ok.call(upload)).status, 200);
  assertEquals(ok.r2Calls.map((c) => c.method), ['DELETE']);
  assertEquals(ok.objects[old], undefined);

  const failing = setup({ discarded: [old], failDelete: true });
  assertEquals((await failing.call(upload)).status, 200);
  assert(failing.logs.some((l) => l.includes('R2 delete failed')));
});

Deno.test('upload links never point at a live key, only at uploads/', async () => {
  for (const position of [1, 2, 3, 4]) {
    const { call } = setup();
    const res = await call({ ...upload, position });
    const path = new URL(res.body.uploadUrl).pathname;
    assert(path.startsWith('/milojulo-media/uploads/'), path);
    assert(path !== `/milojulo-media/${KEY}`);
  }
});

Deno.test('the declared size is signed, so a different Content-Length breaks the signature', async () => {
  const a = new URL((await setup().call({ ...upload, size: 1000 })).body.uploadUrl);
  const b = new URL((await setup().call({ ...upload, size: 1001 })).body.uploadUrl);
  assert(a.searchParams.get('X-Amz-Signature') !== b.searchParams.get('X-Amz-Signature'));
});

// photo-confirm

Deno.test('photo-confirm checks the staged file, copies it to the live key, confirms, and cleans up', async () => {
  const replaced = `${ASHA}/replaced.jpg`;
  const { call, r2Calls, dbCalls, objects } = setup({
    objects: {
      [STAGED]: { size: 2 * MB, contentType: 'image/jpeg' },
      [replaced]: { size: 1, contentType: 'image/jpeg' },
    },
    replaced,
  });
  assertEquals(await call({ action: 'photo-confirm', photoId: PHOTO }), { status: 200, body: { ok: true } });
  assertEquals(dbCalls, ['pendingPhotoUpload', 'confirmPhotoUpload']);
  const calls = r2Calls.map((c) => `${c.method} ${new URL(c.url).pathname}`);
  assertEquals(calls.slice(0, 2), [`HEAD /milojulo-media/${STAGED}`, `PUT /milojulo-media/${KEY}`]);
  // The two deletes run concurrently, so they may finish in either order.
  assertEquals(
    calls.slice(2).sort(),
    [`DELETE /milojulo-media/${STAGED}`, `DELETE /milojulo-media/${replaced}`].sort(),
  );
  assertMatch(
    r2Calls[0].headers.get('authorization')!,
    /^AWS4-HMAC-SHA256 Credential=AKID\/20261014\/auto\/s3\/aws4_request,SignedHeaders=host;x-amz-content-sha256;x-amz-date,Signature=[0-9a-f]{64}$/,
  );
  assertEquals(r2Calls[1].headers.get('x-amz-copy-source'), `/milojulo-media/${STAGED}`);
  assertMatch(
    r2Calls[1].headers.get('authorization')!,
    /SignedHeaders=host;x-amz-content-sha256;x-amz-copy-source;x-amz-date,Signature=[0-9a-f]{64}$/,
  );
  assertEquals(objects[KEY].size, 2 * MB);
  assertEquals(objects[STAGED], undefined);
  assertEquals(objects[replaced], undefined);
});

Deno.test('photo-confirm with nothing to replace (or a taken-down photo, kept) deletes only the staged file', async () => {
  const { call, r2Calls } = setup({ objects: { [STAGED]: { size: 10, contentType: 'image/jpeg' } } });
  assertEquals((await call({ action: 'photo-confirm', photoId: PHOTO })).status, 200);
  assertEquals(r2Calls.map((c) => `${c.method} ${new URL(c.url).pathname}`), [
    `HEAD /milojulo-media/${STAGED}`,
    `PUT /milojulo-media/${KEY}`,
    `DELETE /milojulo-media/${STAGED}`,
  ]);
});

Deno.test('photo-confirm refused by the database after the copy deletes the live copy', async () => {
  const { call, objects, r2Calls } = setup({
    objects: { [STAGED]: { size: 10, contentType: 'image/jpeg' } },
    refuse: { confirmPhotoUpload: 'your account cannot add photos' },
  });
  assertEquals((await call({ action: 'photo-confirm', photoId: PHOTO })).status, 403);
  assertEquals(objects[KEY], undefined);
  assertEquals(r2Calls.at(-1)!.method, 'DELETE');
});

Deno.test('a failed R2 copy is a 500 and confirms nothing', async () => {
  const { call, dbCalls } = setup({ objects: { [STAGED]: { size: 10, contentType: 'image/jpeg' } }, failCopy: true });
  assertEquals(await call({ action: 'photo-confirm', photoId: PHOTO }), {
    status: 500,
    body: { error: 'something went wrong; try again' },
  });
  assertEquals(dbCalls, ['pendingPhotoUpload']);
});

Deno.test('a non-404 R2 HEAD failure is the generic 500, not "did not arrive"', async () => {
  const { call, dbCalls, logs } = setup({
    objects: { [STAGED]: { size: 10, contentType: 'image/jpeg' } },
    failHead: true,
  });
  assertEquals(await call({ action: 'photo-confirm', photoId: PHOTO }), {
    status: 500,
    body: { error: 'something went wrong; try again' },
  });
  assertEquals(dbCalls, ['pendingPhotoUpload']);
  assert(logs.some((l) => l.includes('R2 HEAD failed with 503')));
});

Deno.test('photo-confirm without a pending upload of the caller: 404 no photo upload to confirm', async () => {
  const { call, r2Calls } = setup();
  const refused = { status: 404, body: { error: 'no photo upload to confirm' } };
  assertEquals(await call({ action: 'photo-confirm', photoId: OTHER_PHOTO }), refused);
  assertEquals(await call({ action: 'photo-confirm', photoId: 'not-a-uuid' }), refused);
  assertEquals(await call({ action: 'photo-confirm' }), refused);
  assertEquals(r2Calls, []);
});

Deno.test('photo-confirm when the file is missing: the photo did not arrive', async () => {
  const { call, dbCalls } = setup();
  assertEquals(await call({ action: 'photo-confirm', photoId: PHOTO }), {
    status: 400,
    body: { error: "the photo didn't arrive; try again" },
  });
  assertEquals(dbCalls, ['pendingPhotoUpload']);
});

Deno.test('photo-confirm refuses and deletes a file over 5 MB, empty, or not a JPEG', async () => {
  for (
    const o of [{ size: 5 * MB + 1, contentType: 'image/jpeg' }, { size: 0, contentType: 'image/jpeg' }, {
      size: 10,
      contentType: 'image/png',
    }, { size: 10, contentType: null }]
  ) {
    const { call, dbCalls, r2Calls } = setup({ objects: { [STAGED]: o } });
    assertEquals(await call({ action: 'photo-confirm', photoId: PHOTO }), {
      status: 400,
      body: { error: "the photo didn't arrive; try again" },
    });
    assertEquals(dbCalls, ['pendingPhotoUpload']);
    assertEquals(r2Calls.map((c) => c.method), ['HEAD', 'DELETE']);
  }
});

Deno.test('photo-confirm passes on database refusals', async () => {
  const objects = { [STAGED]: { size: 10, contentType: 'image/jpeg' } };
  const banned = setup({ objects, refuse: { confirmPhotoUpload: 'your account cannot add photos' } });
  assertEquals(await banned.call({ action: 'photo-confirm', photoId: PHOTO }), {
    status: 403,
    body: { error: 'your account cannot add photos' },
  });
  const raced = setup({ objects, refuse: { confirmPhotoUpload: 'no photo upload to confirm' } });
  assertEquals(await raced.call({ action: 'photo-confirm', photoId: PHOTO }), {
    status: 404,
    body: { error: 'no photo upload to confirm' },
  });
});

// photo-delete

Deno.test('photo-delete deletes the photo through the database, then its file', async () => {
  const { call, dbCalls, r2Calls, objects } = setup({ objects: { [KEY]: { size: 10, contentType: 'image/jpeg' } } });
  assertEquals(await call({ action: 'photo-delete', photoId: PHOTO }), { status: 200, body: { ok: true } });
  assertEquals(dbCalls, ['deletePhoto']);
  assertEquals(r2Calls.map((c) => `${c.method} ${new URL(c.url).pathname}`), [`DELETE /milojulo-media/${KEY}`]);
  assertEquals(objects[KEY], undefined);
});

Deno.test('photo-delete of a taken-down photo keeps its file', async () => {
  const { call, r2Calls } = setup({ deleted: null });
  assertEquals(await call({ action: 'photo-delete', photoId: PHOTO }), { status: 200, body: { ok: true } });
  assertEquals(r2Calls, []);
});

Deno.test('photo-delete refusals: not mine or unknown, and the profile minimum', async () => {
  const notMine = setup({ refuse: { deletePhoto: 'no photo to delete' } });
  const refused = { status: 404, body: { error: 'no photo to delete' } };
  assertEquals(await notMine.call({ action: 'photo-delete', photoId: OTHER_PHOTO }), refused);
  assertEquals(await notMine.call({ action: 'photo-delete', photoId: 'nope' }), refused);
  const minimum = setup({ refuse: { deletePhoto: 'add at least 2 photos' } });
  assertEquals(await minimum.call({ action: 'photo-delete', photoId: PHOTO }), {
    status: 400,
    body: { error: 'add at least 2 photos' },
  });
  assertEquals(minimum.r2Calls, []);
});

Deno.test('a failed R2 DELETE throws in the client; photo-delete logs it and still answers ok', async () => {
  const { call, logs } = setup({ failDelete: true });
  assertEquals(await call({ action: 'photo-delete', photoId: PHOTO }), { status: 200, body: { ok: true } });
  assert(logs.some((l) => l.includes('R2 DELETE failed with 500')));
});

// photo-urls

Deno.test('photo-urls signs GET links, valid 600 s, only for the photos the caller may see', async () => {
  const { call, r2Calls } = setup({ visible: { [PHOTO]: KEY } });
  const res = await call({ action: 'photo-urls', photoIds: [PHOTO, OTHER_PHOTO] });
  assertEquals(res.status, 200);
  assertEquals(res.body.expiresIn, 600);
  assertEquals(Object.keys(res.body.urls), [PHOTO]);
  const url = new URL(res.body.urls[PHOTO]);
  assertEquals(url.pathname, `/milojulo-media/${KEY}`);
  assertEquals(url.searchParams.get('X-Amz-Expires'), '600');
  assertEquals(url.searchParams.get('X-Amz-SignedHeaders'), 'host');
  assertEquals(r2Calls, []);
});

Deno.test('photo-urls never sends object keys, only links under photo ids', async () => {
  const { call } = setup({ visible: { [PHOTO]: KEY } });
  const res = await call({ action: 'photo-urls', photoIds: [PHOTO] });
  assertEquals(Object.keys(res.body).sort(), ['expiresIn', 'urls']);
});

Deno.test('photo-urls leaves out ids that are not photo ids and asks once for duplicates', async () => {
  const { call, dbCalls } = setup({ visible: { [PHOTO]: KEY } });
  const res = await call({ action: 'photo-urls', photoIds: [PHOTO, PHOTO, 'nope', 7] });
  assertEquals(Object.keys(res.body.urls), [PHOTO]);
  assertEquals(dbCalls, ['photoLinks', 'photoLinks:1']);
});

Deno.test('photo-urls with no ids answers without asking the database', async () => {
  const { call, dbCalls } = setup();
  assertEquals(await call({ action: 'photo-urls', photoIds: [] }), { status: 200, body: { urls: {}, expiresIn: 600 } });
  assertEquals(dbCalls, []);
});

Deno.test('photo-urls takes at most 60 ids', async () => {
  const ids = (n: number) =>
    Array.from({ length: n }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
  const { call } = setup();
  assertEquals((await call({ action: 'photo-urls', photoIds: ids(60) })).status, 200);
  assertEquals(await call({ action: 'photo-urls', photoIds: ids(61) }), {
    status: 400,
    body: { error: 'ask for at most 60 photos at a time' },
  });
  assertEquals(await call({ action: 'photo-urls', photoIds: PHOTO }), {
    status: 400,
    body: { error: 'photoIds must be a list of photo ids' },
  });
});

// chat-upload

const chatUpload = {
  action: 'chat-upload',
  connectionId: CONN,
  kind: 'image',
  contentType: 'image/jpeg',
  size: 2 * MB,
};

Deno.test('chat-upload makes a slot and gives its id and a PUT link to the staging key, valid 300 s', async () => {
  const { call, dbCalls, r2Calls } = setup();
  const res = await call(chatUpload);
  assertEquals(res.status, 200);
  assertEquals(Object.keys(res.body).sort(), ['expiresIn', 'uploadId', 'uploadUrl']);
  assertEquals(res.body.uploadId, MEDIA);
  assertEquals(res.body.expiresIn, 300);
  const url = new URL(res.body.uploadUrl);
  assertEquals(url.pathname, `/milojulo-media/${CHAT_STAGED}`);
  assertEquals(url.searchParams.get('X-Amz-Expires'), '300');
  assertEquals(url.searchParams.get('X-Amz-SignedHeaders'), 'content-length;content-type;host');
  assertEquals(dbCalls, ['startChatUpload', `startChatUpload:${ASHA}:${CONN}:image:${2 * MB}`]);
  assertEquals(r2Calls, []);
});

Deno.test('chat upload links never point at a live key, only at uploads/', async () => {
  for (const kind of ['image', 'video', 'voice']) {
    const contentType = { image: 'image/jpeg', video: 'video/mp4', voice: 'audio/mp4' }[kind];
    const res = await setup().call({ ...chatUpload, kind, contentType });
    const path = new URL(res.body.uploadUrl).pathname;
    assert(path.startsWith(`/milojulo-media/uploads/chat/${CONN}/`), path);
  }
});

Deno.test('chat-upload takes video as MP4 up to 20 MB and voice as M4A up to 5 MB', async () => {
  const { call } = setup();
  const video = await call({ ...chatUpload, kind: 'video', contentType: 'video/mp4', size: 20 * MB });
  assertEquals(video.status, 200);
  assertEquals(new URL(video.body.uploadUrl).pathname, `/milojulo-media/uploads/chat/${CONN}/${MEDIA}.mp4`);
  const voice = await call({ ...chatUpload, kind: 'voice', contentType: 'audio/mp4', size: 5 * MB });
  assertEquals(voice.status, 200);
  assertEquals(new URL(voice.body.uploadUrl).pathname, `/milojulo-media/uploads/chat/${CONN}/${MEDIA}.m4a`);
});

Deno.test('chat-upload refuses the wrong type or size per kind with texts free of numbers, without asking the database', async () => {
  const { call, dbCalls } = setup();
  const refused = (error: string) => ({ status: 400, body: { error } });
  assertEquals(await call({ ...chatUpload, contentType: 'image/png' }), refused('image must be a JPEG'));
  assertEquals(await call({ ...chatUpload, size: 5 * MB + 1 }), refused('image is too large'));
  assertEquals(await call({ ...chatUpload, size: 0 }), refused('size must be a whole number of bytes'));
  assertEquals(await call({ ...chatUpload, size: 1.5 }), refused('size must be a whole number of bytes'));
  assertEquals(
    await call({ ...chatUpload, kind: 'video', contentType: 'video/mp4', size: 20 * MB + 1 }),
    refused('video is too large'),
  );
  assertEquals(
    await call({ ...chatUpload, kind: 'video', contentType: 'image/jpeg' }),
    refused('video must be an MP4'),
  );
  assertEquals(
    await call({ ...chatUpload, kind: 'voice', contentType: 'audio/mp4', size: 5 * MB + 1 }),
    refused('voice note is too large'),
  );
  assertEquals(
    await call({ ...chatUpload, kind: 'voice', contentType: 'audio/mpeg' }),
    refused('voice note must be an M4A'),
  );
  assertEquals(await call({ ...chatUpload, kind: 'text' }), {
    status: 400,
    body: { error: 'choose image, video or voice' },
  });
  assertEquals(await call({ ...chatUpload, connectionId: 'nope' }), { status: 404, body: { error: 'no connection' } });
  assertEquals(dbCalls, []);
});

Deno.test('chat-upload passes on the database refusals', async () => {
  assertEquals(await setup({ refuse: { startChatUpload: 'no connection' } }).call(chatUpload), {
    status: 404,
    body: { error: 'no connection' },
  });
  assertEquals(await setup({ refuse: { startChatUpload: 'media is off in this chat' } }).call(chatUpload), {
    status: 403,
    body: { error: 'media is off in this chat' },
  });
  assertEquals(await setup({ refuse: { startChatUpload: 'image is too large' } }).call(chatUpload), {
    status: 400,
    body: { error: 'image is too large' },
  });
});

// chat-confirm

const chatConfirm = { action: 'chat-confirm', uploadId: MEDIA };

Deno.test('chat-confirm checks the staged file, copies it to the live key, confirms, and deletes the staged file', async () => {
  const { call, r2Calls, dbCalls, objects } = setup({
    objects: { [CHAT_STAGED]: { size: 2 * MB, contentType: 'image/jpeg' } },
  });
  assertEquals(await call(chatConfirm), { status: 200, body: { mediaKey: CHAT_KEY } });
  assertEquals(dbCalls, ['pendingChatUpload', 'confirmChatUpload']);
  assertEquals(r2Calls.map((c) => `${c.method} ${new URL(c.url).pathname}`), [
    `HEAD /milojulo-media/${CHAT_STAGED}`,
    `PUT /milojulo-media/${CHAT_KEY}`,
    `DELETE /milojulo-media/${CHAT_STAGED}`,
  ]);
  assertEquals(r2Calls[1].headers.get('x-amz-copy-source'), `/milojulo-media/${CHAT_STAGED}`);
  assertEquals(objects[CHAT_KEY].size, 2 * MB);
  assertEquals(objects[CHAT_STAGED], undefined);
});

Deno.test('chat-confirm without a pending upload of the caller: 404 no upload to confirm', async () => {
  const notFound = { status: 404, body: { error: 'no upload to confirm' } };
  assertEquals(await setup().call({ action: 'chat-confirm', uploadId: PHOTO }), notFound);
  assertEquals(await setup().call({ action: 'chat-confirm', uploadId: 'nope' }), notFound);
  assertEquals(await setup().call({ action: 'chat-confirm' }), notFound);
});

Deno.test('chat-confirm when the file is missing: the media did not arrive, nothing confirmed', async () => {
  const { call, dbCalls } = setup();
  assertEquals(await call(chatConfirm), { status: 400, body: { error: "the media didn't arrive; try again" } });
  assertEquals(dbCalls, ['pendingChatUpload']);
});

Deno.test('chat-confirm refuses and deletes a staged file of another size or type than the slot', async () => {
  for (
    const staged of [
      { size: 2 * MB + 1, contentType: 'image/jpeg' },
      { size: 2 * MB - 1, contentType: 'image/jpeg' },
      { size: 2 * MB, contentType: 'image/png' },
      { size: 2 * MB, contentType: null },
    ]
  ) {
    const { call, dbCalls, objects } = setup({ objects: { [CHAT_STAGED]: staged } });
    assertEquals(await call(chatConfirm), { status: 400, body: { error: "the media didn't arrive; try again" } });
    assertEquals(dbCalls, ['pendingChatUpload']);
    assertEquals(objects[CHAT_STAGED], undefined);
    assertEquals(objects[CHAT_KEY], undefined);
  }
});

Deno.test('chat-confirm refused by the database after the copy deletes the live copy', async () => {
  const { call, objects } = setup({
    objects: { [CHAT_STAGED]: { size: 2 * MB, contentType: 'image/jpeg' } },
    refuse: { confirmChatUpload: 'no upload to confirm' },
  });
  assertEquals(await call(chatConfirm), { status: 404, body: { error: 'no upload to confirm' } });
  assertEquals(objects[CHAT_KEY], undefined);
});

Deno.test('chat-confirm: a failed R2 copy is a 500 and confirms nothing', async () => {
  const { call, dbCalls } = setup({
    objects: { [CHAT_STAGED]: { size: 2 * MB, contentType: 'image/jpeg' } },
    failCopy: true,
  });
  assertEquals((await call(chatConfirm)).status, 500);
  assertEquals(dbCalls, ['pendingChatUpload']);
});

// chat-urls

Deno.test('chat-urls signs GET links, valid 600 s, only for the media messages the caller may open', async () => {
  const key = `chat/${CONN}/${MEDIA}.jpg`;
  const { call, r2Calls } = setup({ chatVisible: { [MSG]: key } });
  const res = await call({ action: 'chat-urls', messageIds: [MSG, OTHER_MSG] });
  assertEquals(res.status, 200);
  assertEquals(Object.keys(res.body).sort(), ['expiresIn', 'urls']);
  assertEquals(res.body.expiresIn, 600);
  assertEquals(Object.keys(res.body.urls), [MSG]);
  const url = new URL(res.body.urls[MSG]);
  assertEquals(url.pathname, `/milojulo-media/${key}`);
  assertEquals(url.searchParams.get('X-Amz-Expires'), '600');
  assertEquals(r2Calls, []);
});

Deno.test('chat-urls leaves out non-ids, asks once for duplicates, and skips the database for none', async () => {
  const { call, dbCalls } = setup({ chatVisible: { [MSG]: 'chat/x/y.jpg' } });
  const res = await call({ action: 'chat-urls', messageIds: [MSG, MSG, 'nope', 7] });
  assertEquals(Object.keys(res.body.urls), [MSG]);
  assertEquals(dbCalls, ['chatMediaLinks', 'chatMediaLinks:1']);
  const empty = setup();
  assertEquals(await empty.call({ action: 'chat-urls', messageIds: [] }), {
    status: 200,
    body: { urls: {}, expiresIn: 600 },
  });
  assertEquals(empty.dbCalls, []);
});

Deno.test('chat-urls takes at most 60 ids', async () => {
  const ids = (n: number) =>
    Array.from({ length: n }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
  const { call } = setup();
  assertEquals((await call({ action: 'chat-urls', messageIds: ids(60) })).status, 200);
  assertEquals(await call({ action: 'chat-urls', messageIds: ids(61) }), {
    status: 400,
    body: { error: 'ask for at most 60 messages at a time' },
  });
  assertEquals(await call({ action: 'chat-urls', messageIds: MSG }), {
    status: 400,
    body: { error: 'messageIds must be a list of message ids' },
  });
});

import { assert, assertEquals, assertMatch } from '@std/assert';
import { createHandler, type Db, Refusal } from './handler.ts';
import { createR2, type StoredObject } from './r2.ts';

const ASHA = '00000000-0000-0000-0000-0000000000a1';
const PHOTO = '00000000-0000-0000-0000-0000000000f1';
const OTHER_PHOTO = '00000000-0000-0000-0000-0000000000f2';
const KEY = `${ASHA}/${PHOTO}.jpg`;
const NOW = new Date('2026-10-14T06:30:00Z');
const MB = 1024 * 1024;

// An in-memory stand-in for the database functions, plus a fake R2 behind the real signer.
function setup(opts: {
  objects?: Record<string, StoredObject>;
  refuse?: Partial<Record<keyof Db, string>>;
  pending?: Record<string, string>;
  replaced?: string | null;
  discarded?: string[];
  visible?: Record<string, string>;
  failDelete?: boolean;
} = {}) {
  const objects = { ...opts.objects };
  const r2Calls: { method: string; url: string; headers: Headers }[] = [];
  const dbCalls: string[] = [];
  const logs: string[] = [];
  const pending = { ...(opts.pending ?? { [PHOTO]: KEY }) };
  const refuse = async (name: keyof Db) => {
    dbCalls.push(name);
    const message = opts.refuse?.[name];
    if (message) throw new Refusal(message);
  };
  const db: Db = {
    async startPhotoUpload(memberId) {
      await refuse('startPhotoUpload');
      return { photoId: PHOTO, objectKey: `${memberId}/${PHOTO}.jpg`, discardedKeys: opts.discarded ?? [] };
    },
    async pendingPhotoUpload(memberId, uploadId) {
      await refuse('pendingPhotoUpload');
      return memberId === ASHA ? pending[uploadId] ?? null : null;
    },
    async confirmPhotoUpload() {
      await refuse('confirmPhotoUpload');
      return opts.replaced ?? null;
    },
    async photoLinks(_viewer, ids) {
      await refuse('photoLinks');
      dbCalls.push(`photoLinks:${ids.length}`);
      return ids.filter((id) => opts.visible?.[id]).map((id) => ({ photoId: id, objectKey: opts.visible![id] }));
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
  assertEquals(url.pathname, `/milojulo-media/${KEY}`);
  assertEquals(url.searchParams.get('X-Amz-Expires'), '300');
  assertEquals(url.searchParams.get('X-Amz-Date'), '20261014T063000Z');
  assertEquals(url.searchParams.get('X-Amz-Credential'), 'AKID/20261014/auto/s3/aws4_request');
  assertEquals(url.searchParams.get('X-Amz-SignedHeaders'), 'content-type;host');
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

// photo-confirm

Deno.test('photo-confirm checks the file in R2 with a signed HEAD, confirms, and deletes the photo it replaced', async () => {
  const replaced = `${ASHA}/replaced.jpg`;
  const { call, r2Calls, dbCalls, objects } = setup({
    objects: { [KEY]: { size: 2 * MB, contentType: 'image/jpeg' }, [replaced]: { size: 1, contentType: 'image/jpeg' } },
    replaced,
  });
  assertEquals(await call({ action: 'photo-confirm', photoId: PHOTO }), { status: 200, body: { ok: true } });
  assertEquals(dbCalls, ['pendingPhotoUpload', 'confirmPhotoUpload']);
  assertEquals(r2Calls.map((c) => `${c.method} ${new URL(c.url).pathname}`), [
    `HEAD /milojulo-media/${KEY}`,
    `DELETE /milojulo-media/${replaced}`,
  ]);
  assertMatch(
    r2Calls[0].headers.get('authorization')!,
    /^AWS4-HMAC-SHA256 Credential=AKID\/20261014\/auto\/s3\/aws4_request,SignedHeaders=host;x-amz-content-sha256;x-amz-date,Signature=[0-9a-f]{64}$/,
  );
  assertEquals(objects[KEY].size, 2 * MB);
});

Deno.test('photo-confirm with nothing to replace deletes nothing', async () => {
  const { call, r2Calls } = setup({ objects: { [KEY]: { size: 10, contentType: 'image/jpeg' } } });
  assertEquals((await call({ action: 'photo-confirm', photoId: PHOTO })).status, 200);
  assertEquals(r2Calls.map((c) => c.method), ['HEAD']);
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
    const { call, dbCalls, r2Calls } = setup({ objects: { [KEY]: o } });
    assertEquals(await call({ action: 'photo-confirm', photoId: PHOTO }), {
      status: 400,
      body: { error: "the photo didn't arrive; try again" },
    });
    assertEquals(dbCalls, ['pendingPhotoUpload']);
    assertEquals(r2Calls.map((c) => c.method), ['HEAD', 'DELETE']);
  }
});

Deno.test('photo-confirm passes on database refusals', async () => {
  const objects = { [KEY]: { size: 10, contentType: 'image/jpeg' } };
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

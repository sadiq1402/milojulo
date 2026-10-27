import { assertEquals } from '@std/assert';
import { createHandler } from './handler.ts';

const ASHA = '00000000-0000-0000-0000-0000000000a1';
const TOKEN = 'session-one';

type Sent = { url: string; method: string; headers: Headers; body: unknown };

function setup(opts: {
  bias?: { lat: number; lng: number } | null;
  reply?: (sent: Sent) => Response;
} = {}) {
  const sent: Sent[] = [];
  const logs: string[] = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const s: Sent = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    sent.push(s);
    return opts.reply ? opts.reply(s) : new Response('{}');
  };
  const handler = createHandler({
    userIdFor: async (token) => (token === 'good' ? ASHA : null),
    searchBias: async (memberId) => (memberId === ASHA ? opts.bias ?? null : null),
    apiKey: 'test-key',
    fetch: fetcher,
    log: (m) => logs.push(m),
  });
  const call = (body: unknown, auth: string | null = 'Bearer good') =>
    handler(
      new Request('http://x', {
        method: 'POST',
        headers: auth ? { Authorization: auth } : {},
        body: JSON.stringify(body),
      }),
    );
  return { call, sent, logs };
}

const googleJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

Deno.test('signed-out callers are refused and Google is never asked', async () => {
  const f = setup();
  const none = await f.call({ action: 'autocomplete', input: 'cafe', sessionToken: TOKEN }, null);
  assertEquals(none.status, 401);
  assertEquals(await none.json(), { error: 'sign in first' });
  assertEquals((await f.call({ action: 'details', placeId: 'abc', sessionToken: TOKEN }, 'Bearer bad')).status, 401);
  assertEquals(f.sent, []);
});

Deno.test('only POST, a JSON body and a known action', async () => {
  const f = setup();
  const handler = createHandler({
    userIdFor: async () => ASHA,
    searchBias: async () => null,
    apiKey: 'k',
    fetch: async () => new Response('{}'),
  });
  assertEquals((await handler(new Request('http://x', { method: 'GET' }))).status, 405);
  assertEquals(await (await f.call({ action: 'nearby' })).json(), { error: 'unknown action' });
  assertEquals((await f.call({ action: 'autocomplete', input: '  ', sessionToken: TOKEN })).status, 400);
  assertEquals((await f.call({ action: 'autocomplete', input: 'cafe' })).status, 400);
  assertEquals((await f.call({ action: 'details', placeId: 'a/b', sessionToken: TOKEN })).status, 400);
  assertEquals(f.sent, []);
});

Deno.test('autocomplete asks Places (New) with the session token, biased to the caller, and maps suggestions', async () => {
  const f = setup({
    bias: { lat: 18.56, lng: 73.79 },
    reply: () =>
      googleJson({
        suggestions: [
          {
            placePrediction: {
              placeId: 'ChIJcafe',
              structuredFormat: {
                mainText: { text: 'Cafe Goodluck', matches: [{ endOffset: 4 }] },
                secondaryText: { text: 'FC Road, Pune' },
              },
            },
          },
          { queryPrediction: { text: { text: 'cafes near me' } } },
          {
            placePrediction: {
              placeId: 'ChIJother',
              structuredFormat: {
                mainText: { text: 'The Cafe', matches: [{ startOffset: 4, endOffset: 8 }] },
              },
            },
          },
        ],
      }),
  });
  const res = await f.call({ action: 'autocomplete', input: ' cafe ', sessionToken: TOKEN });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), {
    suggestions: [
      {
        placeId: 'ChIJcafe',
        mainText: 'Cafe Goodluck',
        secondaryText: 'FC Road, Pune',
        matches: [{ start: 0, end: 4 }],
      },
      { placeId: 'ChIJother', mainText: 'The Cafe', secondaryText: '', matches: [{ start: 4, end: 8 }] },
    ],
  });
  const [s] = f.sent;
  assertEquals(s.url, 'https://places.googleapis.com/v1/places:autocomplete');
  assertEquals(s.method, 'POST');
  assertEquals(s.headers.get('X-Goog-Api-Key'), 'test-key');
  assertEquals(s.body, {
    input: 'cafe',
    sessionToken: TOKEN,
    includeQueryPredictions: false,
    regionCode: 'in',
    locationBias: { circle: { center: { latitude: 18.56, longitude: 73.79 }, radius: 50000 } },
  });
});

Deno.test("the response never carries the caller's location", async () => {
  const f = setup({ bias: { lat: 18.56, lng: 73.79 }, reply: () => googleJson({}) });
  const body = await (await f.call({ action: 'autocomplete', input: 'cafe', sessionToken: TOKEN })).text();
  assertEquals(body, '{"suggestions":[]}');
});

Deno.test('without a fresh location, autocomplete has no bias', async () => {
  const f = setup({ bias: null, reply: () => googleJson({ suggestions: [] }) });
  await f.call({ action: 'autocomplete', input: 'cafe', sessionToken: TOKEN });
  assertEquals((f.sent[0].body as Record<string, unknown>).locationBias, undefined);
});

Deno.test('details asks for a minimal field mask and maps the place', async () => {
  const f = setup({
    reply: () =>
      googleJson({
        id: 'ChIJcafe',
        displayName: { text: 'Cafe Goodluck', languageCode: 'en' },
        formattedAddress: 'FC Road, Deccan, Pune, Maharashtra 411004, India',
        location: { latitude: 18.5167, longitude: 73.8415 },
      }),
  });
  const res = await f.call({ action: 'details', placeId: 'ChIJcafe', sessionToken: TOKEN });
  assertEquals(await res.json(), {
    placeId: 'ChIJcafe',
    name: 'Cafe Goodluck',
    address: 'FC Road, Deccan, Pune, Maharashtra 411004, India',
    lat: 18.5167,
    lng: 73.8415,
  });
  const [s] = f.sent;
  assertEquals(s.url, `https://places.googleapis.com/v1/places/ChIJcafe?sessionToken=${TOKEN}&regionCode=in`);
  assertEquals(s.method, 'GET');
  assertEquals(s.headers.get('X-Goog-FieldMask'), 'id,displayName,formattedAddress,location');
  assertEquals(s.headers.get('X-Goog-Api-Key'), 'test-key');
});

Deno.test('a place without a name or a point is not offered', async () => {
  const f = setup({ reply: () => googleJson({ id: 'ChIJx', displayName: { text: 'X' } }) });
  const res = await f.call({ action: 'details', placeId: 'ChIJx', sessionToken: TOKEN });
  assertEquals(res.status, 404);
  assertEquals(await res.json(), { error: 'place not found' });
});

Deno.test('Google errors are logged and answered as one retryable error', async () => {
  const f = setup({ reply: () => googleJson({ error: { message: 'API key not valid' } }, 403) });
  const res = await f.call({ action: 'autocomplete', input: 'cafe', sessionToken: TOKEN });
  assertEquals(res.status, 502);
  assertEquals(await res.json(), { error: 'place search is unavailable; try again' });
  assertEquals(f.logs.length, 1);

  const gone = setup({ reply: () => googleJson({ error: { message: 'Not found' } }, 404) });
  assertEquals((await gone.call({ action: 'details', placeId: 'ChIJgone', sessionToken: TOKEN })).status, 404);

  const down = setup({
    reply: () => {
      throw new TypeError('network down');
    },
  });
  assertEquals((await down.call({ action: 'details', placeId: 'ChIJx', sessionToken: TOKEN })).status, 502);
});

Deno.test('reverse is for signed-in callers with a valid point', async () => {
  const f = setup();
  assertEquals((await f.call({ action: 'reverse', lat: 18.5, lng: 73.8 }, null)).status, 401);
  for (const bad of [{}, { lat: '18.5', lng: 73.8 }, { lat: 91, lng: 73.8 }, { lat: 18.5, lng: -181 }]) {
    const res = await f.call({ action: 'reverse', ...bad });
    assertEquals(res.status, 400);
    assertEquals(await res.json(), { error: 'send a valid point' });
  }
  assertEquals(f.sent, []);
});

Deno.test('reverse asks Geocoding for the nearest address to the pin', async () => {
  const f = setup({
    reply: () =>
      googleJson({
        status: 'OK',
        results: [{ formatted_address: 'Sus Rd, Pashan, Pune, Maharashtra 411021, India' }, {
          formatted_address: 'Pune',
        }],
      }),
  });
  const res = await f.call({ action: 'reverse', lat: 18.5362, lng: 73.7804 });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { address: 'Sus Rd, Pashan, Pune, Maharashtra 411021, India' });
  const [s] = f.sent;
  const url = new URL(s.url);
  assertEquals(url.origin + url.pathname, 'https://maps.googleapis.com/maps/api/geocode/json');
  assertEquals(url.searchParams.get('latlng'), '18.5362,73.7804');
  assertEquals(url.searchParams.get('key'), 'test-key');
  assertEquals(url.searchParams.get('region'), 'in');
  assertEquals(s.method, 'GET');
});

Deno.test('reverse answers an empty address where Google has none, and a retryable error when it fails', async () => {
  const none = setup({ reply: () => googleJson({ status: 'ZERO_RESULTS', results: [] }) });
  assertEquals(await (await none.call({ action: 'reverse', lat: 0, lng: 0 })).json(), { address: '' });

  const denied = setup({ reply: () => googleJson({ status: 'REQUEST_DENIED', error_message: 'not allowed' }) });
  const res = await denied.call({ action: 'reverse', lat: 18.5, lng: 73.8 });
  assertEquals(res.status, 502);
  assertEquals(await res.json(), { error: 'place search is unavailable; try again' });
  assertEquals(denied.logs.length, 1);
  assertEquals(denied.logs[0].includes('test-key'), false);
});

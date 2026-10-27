// Place search for an Activity's venue (#248, decision 70) through Google Places API (New), and
// the nearest address to a dropped pin (#249) through the Geocoding API. The key
// stays here; the phone only sends what the host typed and gets back names, addresses and points.

export interface Deps {
  // The signed-in Member's id for a user JWT, or null.
  userIdFor(token: string): Promise<string | null>;
  // The Member's fresh Member Location, rounded; null without one. Never sent back to the phone.
  searchBias(memberId: string): Promise<{ lat: number; lng: number } | null>;
  apiKey: string;
  fetch: typeof fetch;
  log?: (message: string) => void;
}

export type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  // The parts of mainText that match what was typed, as [start, end) offsets.
  matches: { start: number; end: number }[];
};

export type Place = { placeId: string; name: string; address: string; lat: number; lng: number };

const GOOGLE = 'https://places.googleapis.com/v1';
const GEOCODE = 'https://maps.googleapis.com/maps/api/geocode/json';
const BIAS_RADIUS_M = 50_000;
const MAX_INPUT = 200;
const SESSION_TOKEN = /^[A-Za-z0-9_-]{1,100}$/;
const PLACE_ID = /^[A-Za-z0-9_-]{1,300}$/;

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const unavailable = () => new HttpError(502, 'place search is unavailable; try again');

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type Text = { text?: string; matches?: { startOffset?: number; endOffset?: number }[] };
type Prediction = {
  placePrediction?: { placeId?: string; structuredFormat?: { mainText?: Text; secondaryText?: Text } };
};

function text(field: unknown, max: number): string {
  if (typeof field !== 'string' || !field.trim()) throw new HttpError(400, 'send the search text');
  return field.trim().slice(0, max);
}

function matching(field: unknown, pattern: RegExp, what: string): string {
  if (typeof field !== 'string' || !pattern.test(field)) throw new HttpError(400, `send a valid ${what}`);
  return field;
}

export function createHandler(deps: Deps): (req: Request) => Promise<Response> {
  const log = deps.log ?? ((m: string) => console.error(m));

  async function google(url: string, init: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await deps.fetch(url, init);
    } catch (e) {
      log(`places: Google unreachable: ${e}`);
      throw unavailable();
    }
    if (res.status === 404) throw new HttpError(404, 'place not found');
    if (!res.ok) {
      log(`places: Google answered ${res.status}: ${(await res.text()).slice(0, 500)}`);
      throw unavailable();
    }
    return await res.json();
  }

  async function autocomplete(me: string, body: Record<string, unknown>) {
    const input = text(body.input, MAX_INPUT);
    const sessionToken = matching(body.sessionToken, SESSION_TOKEN, 'session token');
    const bias = await deps.searchBias(me);
    const request: Record<string, unknown> = { input, sessionToken, includeQueryPredictions: false, regionCode: 'in' };
    if (bias) {
      request.locationBias = {
        circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: BIAS_RADIUS_M },
      };
    }
    const reply = await google(`${GOOGLE}/places:autocomplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': deps.apiKey },
      body: JSON.stringify(request),
    }) as { suggestions?: Prediction[] };
    const suggestions: Suggestion[] = [];
    for (const s of reply.suggestions ?? []) {
      const p = s.placePrediction;
      const main = p?.structuredFormat?.mainText;
      if (!p?.placeId || !main?.text) continue;
      suggestions.push({
        placeId: p.placeId,
        mainText: main.text,
        secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
        // Google leaves out a start offset of 0.
        matches: (main.matches ?? []).map((m) => ({ start: m.startOffset ?? 0, end: m.endOffset ?? 0 })),
      });
    }
    return { suggestions };
  }

  async function details(_me: string, body: Record<string, unknown>): Promise<Place> {
    const placeId = matching(body.placeId, PLACE_ID, 'place id');
    const sessionToken = matching(body.sessionToken, SESSION_TOKEN, 'session token');
    const query = new URLSearchParams({ sessionToken, regionCode: 'in' });
    const place = await google(`${GOOGLE}/places/${placeId}?${query}`, {
      method: 'GET',
      headers: { 'X-Goog-Api-Key': deps.apiKey, 'X-Goog-FieldMask': 'id,displayName,formattedAddress,location' },
    }) as {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
    };
    const name = place.displayName?.text;
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    if (!name || typeof lat !== 'number' || typeof lng !== 'number') throw new HttpError(404, 'place not found');
    return { placeId: place.id ?? placeId, name, address: place.formattedAddress ?? '', lat, lng };
  }

  // The nearest address to a pin the host dropped (#249), through the Geocoding API.
  async function reverse(_me: string, body: Record<string, unknown>) {
    const { lat, lng } = body;
    if (
      typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180
    ) {
      throw new HttpError(400, 'send a valid point');
    }
    const query = new URLSearchParams({ latlng: `${lat},${lng}`, region: 'in', language: 'en', key: deps.apiKey });
    const reply = await google(`${GEOCODE}?${query}`, { method: 'GET' }) as {
      status?: string;
      results?: { formatted_address?: string }[];
      error_message?: string;
    };
    if (reply.status === 'ZERO_RESULTS') return { address: '' };
    if (reply.status !== 'OK') {
      log(`places: Geocoding answered ${reply.status}: ${reply.error_message ?? ''}`);
      throw unavailable();
    }
    return { address: reply.results?.find((r) => r.formatted_address)?.formatted_address ?? '' };
  }

  const actions: Record<string, (me: string, body: Record<string, unknown>) => Promise<unknown>> = {
    autocomplete,
    details,
    reverse,
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
      log(`places: unexpected error: ${e instanceof Error ? e.stack ?? e.message : e}`);
      return json(500, { error: 'something went wrong; try again' });
    }
  };
}

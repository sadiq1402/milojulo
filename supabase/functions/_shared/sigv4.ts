// AWS Signature Version 4 with Web Crypto, enough for S3-compatible storage (Cloudflare R2).

export interface SigningKey {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
}

export const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
export const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

const encoder = new TextEncoder();

// RFC 3986 percent-encoding, as SigV4 requires (encodeURIComponent leaves !'()* alone).
export function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

export function encodePath(segments: string[]): string {
  return '/' + segments.map(uriEncode).join('/');
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

async function hmac(key: BufferSource, text: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(text));
}

// 20130524T000000Z
export function amzDate(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function canonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(params[k])}`)
    .join('&');
}

interface Canonical {
  method: string;
  host: string;
  path: string; // already URI-encoded, as sent
  query: Record<string, string>;
  headers: Record<string, string>; // lower-case names, host excluded
  payloadHash: string;
}

async function signature(key: SigningKey, date: string, c: Canonical) {
  const headers: Record<string, string> = { ...c.headers, host: c.host };
  const names = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const signedHeaders = names.join(';');
  const canonicalRequest = [
    c.method,
    c.path,
    canonicalQuery(c.query),
    names.map((n) => `${n}:${lower[n].trim().replace(/\s+/g, ' ')}\n`).join(''),
    signedHeaders,
    c.payloadHash,
  ].join('\n');
  const day = date.slice(0, 8);
  const scope = `${day}/${key.region}/${key.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', date, scope, await sha256Hex(canonicalRequest)].join('\n');
  let k = await hmac(encoder.encode('AWS4' + key.secretAccessKey), day);
  k = await hmac(k, key.region);
  k = await hmac(k, key.service);
  k = await hmac(k, 'aws4_request');
  return { signature: hex(await hmac(k, stringToSign)), scope, signedHeaders };
}

// A presigned URL: anyone holding it may make this one request until it expires.
export async function presignUrl(key: SigningKey, req: {
  method: string;
  host: string;
  path: string;
  headers?: Record<string, string>;
  expiresIn: number;
  now: Date;
}): Promise<string> {
  const date = amzDate(req.now);
  const headers = req.headers ?? {};
  const names = [...Object.keys(headers).map((h) => h.toLowerCase()), 'host'].sort();
  const day = date.slice(0, 8);
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${key.accessKeyId}/${day}/${key.region}/${key.service}/aws4_request`,
    'X-Amz-Date': date,
    'X-Amz-Expires': String(req.expiresIn),
    'X-Amz-SignedHeaders': names.join(';'),
  };
  const { signature: sig } = await signature(key, date, {
    method: req.method,
    host: req.host,
    path: req.path,
    query,
    headers,
    payloadHash: UNSIGNED_PAYLOAD,
  });
  return `https://${req.host}${req.path}?${canonicalQuery(query)}&X-Amz-Signature=${sig}`;
}

// Headers (Authorization included) for a request made by the server itself.
export async function signHeaders(key: SigningKey, req: {
  method: string;
  host: string;
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  payloadHash?: string;
  now: Date;
}): Promise<Record<string, string>> {
  const date = amzDate(req.now);
  const payloadHash = req.payloadHash ?? EMPTY_SHA256;
  const headers = { ...req.headers, 'x-amz-content-sha256': payloadHash, 'x-amz-date': date };
  const s = await signature(key, date, {
    method: req.method,
    host: req.host,
    path: req.path,
    query: req.query ?? {},
    headers,
    payloadHash,
  });
  return {
    ...headers,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${key.accessKeyId}/${s.scope},SignedHeaders=${s.signedHeaders},Signature=${s.signature}`,
  };
}

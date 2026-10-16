export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encodeJson = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));

async function importKey(pem: string): Promise<CryptoKey> {
  const der = Uint8Array.from(
    atob(pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '')),
    (c) => c.charCodeAt(0),
  );
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

export async function signJwt(account: ServiceAccount, nowSeconds: number): Promise<string> {
  const header = encodeJson({ alg: 'RS256', typ: 'JWT' });
  const claims = encodeJson({
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  });
  const input = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    await importKey(account.private_key),
    new TextEncoder().encode(input),
  );
  return `${input}.${base64url(new Uint8Array(signature))}`;
}

// An OAuth access token for FCM, kept in memory until a minute before it expires.
export function createAccessToken(account: ServiceAccount, fetchFn: typeof fetch, now: () => number = Date.now) {
  let cached: { token: string; expiresAt: number } | null = null;
  return async (): Promise<string> => {
    if (cached && now() < cached.expiresAt - 60_000) return cached.token;
    const assertion = await signJwt(account, Math.floor(now() / 1000));
    const res = await fetchFn(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!res.ok) throw new Error(`push: token exchange failed with ${res.status}`);
    const body = await res.json();
    cached = { token: body.access_token, expiresAt: now() + body.expires_in * 1000 };
    return cached.token;
  };
}

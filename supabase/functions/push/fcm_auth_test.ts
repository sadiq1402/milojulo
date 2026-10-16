import { assertEquals } from '@std/assert';
import { createAccessToken, type ServiceAccount, signJwt } from './fcm_auth.ts';

async function testAccount(): Promise<{ account: ServiceAccount; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----\n`;
  return {
    account: { project_id: 'p', client_email: 'push@p.iam.gserviceaccount.com', private_key: pem },
    publicKey: pair.publicKey,
  };
}

const fromBase64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

Deno.test('signs an RS256 JWT for the FCM scope', async () => {
  const { account, publicKey } = await testAccount();
  const [header, claims, signature] = (await signJwt(account, 1000)).split('.');
  assertEquals(JSON.parse(new TextDecoder().decode(fromBase64url(header))), { alg: 'RS256', typ: 'JWT' });
  assertEquals(JSON.parse(new TextDecoder().decode(fromBase64url(claims))), {
    iss: 'push@p.iam.gserviceaccount.com',
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: 1000,
    exp: 4600,
  });
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    fromBase64url(signature),
    new TextEncoder().encode(`${header}.${claims}`),
  );
  assertEquals(valid, true);
});

Deno.test('exchanges the JWT once and reuses the token until near expiry', async () => {
  const { account } = await testAccount();
  let now = 0;
  const calls: URLSearchParams[] = [];
  const accessToken = createAccessToken(account, async (_url, init) => {
    calls.push(new URLSearchParams(String(init?.body)));
    return Response.json({ access_token: `t${calls.length}`, expires_in: 3600 });
  }, () => now);
  assertEquals(await accessToken(), 't1');
  now = 3_000_000;
  assertEquals(await accessToken(), 't1');
  now = 3_550_000;
  assertEquals(await accessToken(), 't2');
  assertEquals(calls[0].get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
});

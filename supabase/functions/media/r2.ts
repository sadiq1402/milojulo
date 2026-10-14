import { encodePath, presignUrl, signHeaders, type SigningKey } from './sigv4.ts';

export interface StoredObject {
  size: number;
  contentType: string | null;
}

export interface Storage {
  uploadUrl(key: string, contentType: string, size: number, expiresIn: number): Promise<string>;
  downloadUrl(key: string, expiresIn: number): Promise<string>;
  head(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  copy(sourceKey: string, destinationKey: string): Promise<void>;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  now: () => Date;
  fetch?: typeof fetch;
}

// Cloudflare R2 through its S3 API: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>.
export function createR2(config: R2Config): Storage {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const key: SigningKey = {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: 'auto',
    service: 's3',
  };
  const doFetch = config.fetch ?? fetch;
  const pathOf = (objectKey: string) => encodePath([config.bucket, ...objectKey.split('/')]);

  async function send(method: 'HEAD' | 'DELETE' | 'PUT', objectKey: string, extra: Record<string, string> = {}) {
    const path = pathOf(objectKey);
    const headers = await signHeaders(key, { method, host, path, headers: extra, now: config.now() });
    return doFetch(`https://${host}${path}`, { method, headers });
  }

  return {
    // Content-Type and Content-Length are signed, so the uploader must send exactly these.
    uploadUrl: (objectKey, contentType, size, expiresIn) =>
      presignUrl(key, {
        method: 'PUT',
        host,
        path: pathOf(objectKey),
        headers: { 'content-length': String(size), 'content-type': contentType },
        expiresIn,
        now: config.now(),
      }),
    downloadUrl: (objectKey, expiresIn) =>
      presignUrl(key, { method: 'GET', host, path: pathOf(objectKey), expiresIn, now: config.now() }),
    async head(objectKey) {
      const res = await send('HEAD', objectKey);
      await res.body?.cancel();
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 HEAD failed with ${res.status}`);
      return {
        size: Number(res.headers.get('content-length') ?? '0'),
        contentType: res.headers.get('content-type'),
      };
    },
    async delete(objectKey) {
      const res = await send('DELETE', objectKey);
      await res.body?.cancel();
      if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE failed with ${res.status}`);
    },
    // S3 CopyObject: R2 copies the object server side.
    async copy(sourceKey, destinationKey) {
      const res = await send('PUT', destinationKey, { 'x-amz-copy-source': pathOf(sourceKey) });
      await res.body?.cancel();
      if (!res.ok) throw new Error(`R2 copy failed with ${res.status}`);
    },
  };
}

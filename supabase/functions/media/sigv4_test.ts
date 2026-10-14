import { assertEquals } from '@std/assert';
import { encodePath, presignUrl, signHeaders } from './sigv4.ts';

// The worked examples in AWS's S3 docs ("Signature Calculations for the Authorization Header" and
// "Authenticating Requests: Using Query Parameters"), with their published signatures.
const example = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  service: 's3',
};
const now = new Date('2013-05-24T00:00:00Z');

Deno.test('presigned GET matches the AWS example', async () => {
  const url = await presignUrl(example, {
    method: 'GET',
    host: 'examplebucket.s3.amazonaws.com',
    path: '/test.txt',
    expiresIn: 86400,
    now,
  });
  assertEquals(
    url,
    'https://examplebucket.s3.amazonaws.com/test.txt' +
      '?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
      '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
      '&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
      '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
  );
});

Deno.test('signed GET with a Range header matches the AWS example', async () => {
  const headers = await signHeaders(example, {
    method: 'GET',
    host: 'examplebucket.s3.amazonaws.com',
    path: '/test.txt',
    headers: { range: 'bytes=0-9' },
    now,
  });
  assertEquals(
    headers.authorization,
    'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,' +
      'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,' +
      'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
  );
  assertEquals(headers['x-amz-date'], '20130524T000000Z');
});

Deno.test('signed GET with a query string matches the AWS example', async () => {
  const headers = await signHeaders(example, {
    method: 'GET',
    host: 'examplebucket.s3.amazonaws.com',
    path: '/',
    query: { 'max-keys': '2', prefix: 'J' },
    now,
  });
  assertEquals(
    headers.authorization.split('Signature=')[1],
    '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7',
  );
});

Deno.test('path segments are RFC 3986 encoded, slashes kept between them', () => {
  assertEquals(encodePath(['bucket', 'a b', "it's(1).jpg"]), '/bucket/a%20b/it%27s%281%29.jpg');
});

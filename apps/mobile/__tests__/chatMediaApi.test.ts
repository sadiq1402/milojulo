import {
  fetchChatMediaLimits,
  fetchMediaAllowance,
  waitText,
  fetchMediaState,
  fetchMediaUrls,
  insertMediaMessage,
  uploadChatMedia,
  setMediaConsent,
  type OutgoingMedia,
} from '../src/features/chat/media';
import { supabase } from '../src/lib/supabase';

// jest.setup.js stands Supabase in with an empty object; give it what the media function, the
// messages table and the consent functions would answer.
const invoke = jest.fn();
const rpc = jest.fn();
const insert = jest.fn();
const from = jest.fn();
const stub = supabase as unknown as Record<string, unknown>;
stub.functions = { invoke };
stub.rpc = rpc;
stub.from = from;

const refused = (message: string) => ({
  data: null,
  error: { context: { json: async () => ({ error: message }) } },
});

const file = { size: 400_000 };
let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn(async (url: string) =>
    url.startsWith('file://')
      ? { blob: async () => file }
      : { ok: true, status: 200 },
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  from.mockReturnValue({ insert });
  insert.mockResolvedValue({ error: null });
});

const image: OutgoingMedia = {
  kind: 'image',
  uri: 'file:///tmp/a.jpg',
  mime: 'image/jpeg',
  width: 1200,
  height: 900,
  durationMs: null,
};
const voice: OutgoingMedia = {
  kind: 'voice',
  uri: 'file:///tmp/v.m4a',
  mime: 'audio/mp4',
  width: null,
  height: null,
  durationMs: 14_000,
};
const upload = {
  data: { uploadId: 'up-1', uploadUrl: 'https://r2/put', expiresIn: 300 },
  error: null,
};
const confirmed = { data: { mediaKey: 'k/1.jpg' }, error: null };
// The function answers the upload link, then the confirm.
const uploads = () =>
  invoke.mockResolvedValueOnce(upload).mockResolvedValueOnce(confirmed);
// Limits as the server might have them; refusals name these numbers.
const limits = {
  videoMaxMs: 15_000,
  imageMaxBytes: 2 * 1024 * 1024,
  voiceMaxMs: 90_000,
};
const send = async (media: OutgoingMedia, id = 'msg-1'): Promise<void> => {
  const mediaKey = await uploadChatMedia('c1', media, limits);
  await insertMediaMessage({ id, connectionId: 'c1', media, mediaKey, limits });
};

describe('uploading and sending chat media', () => {
  test('asks for a link, PUTs with type and length, confirms, then inserts the message with its key, size and duration', async () => {
    uploads();
    await send(image);

    expect(invoke).toHaveBeenNthCalledWith(1, 'media', {
      body: {
        action: 'chat-upload',
        connectionId: 'c1',
        kind: 'image',
        contentType: 'image/jpeg',
        size: 400_000,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith('https://r2/put', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '400000' },
      body: file,
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'media', {
      body: { action: 'chat-confirm', uploadId: 'up-1' },
    });
    expect(from).toHaveBeenCalledWith('messages');
    expect(insert).toHaveBeenCalledWith({
      id: 'msg-1',
      connection_id: 'c1',
      type: 'image',
      media_key: 'k/1.jpg',
      media_mime: 'image/jpeg',
      media_width: 1200,
      media_height: 900,
      media_duration_ms: null,
    });
  });

  test('a voice note carries its duration', async () => {
    uploads();
    await send(voice, 'msg-2');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'voice',
        media_mime: 'audio/mp4',
        media_duration_ms: 14_000,
      }),
    );
  });

  test('a repeat of an id already sent counts as sent', async () => {
    uploads();
    insert.mockResolvedValueOnce({ error: { code: '23505', message: 'dup' } });
    await expect(send(image)).resolves.toBeUndefined();
  });

  test('a failed PUT is never confirmed or sent', async () => {
    invoke.mockResolvedValueOnce(upload);
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith('file://') ? { blob: async () => file } : { ok: false },
    );
    await expect(send(image)).rejects.toThrow("didn't finish uploading");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
  });

  test.each([
    ['no upload to confirm', 'That upload took too long'],
    ["the media didn't arrive; try again", "didn't finish uploading"],
  ])('the confirm refusing "%s" reads as friendly copy', async (key, copy) => {
    invoke.mockResolvedValueOnce(upload).mockResolvedValueOnce(refused(key));
    await expect(send(image)).rejects.toThrow(copy);
    expect(insert).not.toHaveBeenCalled();
  });

  test.each([
    ['image is too large', 'Photos can be up to 2 MB. Try another one.'],
    ['video is too large', 'That video is too large'],
    ['voice note is too large', 'That voice note is too large'],
    ['image must be a JPEG', "That file can't be sent"],
    ['video must be an MP4', "That file can't be sent"],
    ['voice note must be an M4A', "That file can't be sent"],
    ['no connection', "can't send messages in this chat"],
    ['media is off in this chat', 'Photos and video are off in this chat'],
    [
      'media limit reached',
      "You've sent today's photo, video or voice note in this chat.",
    ],
  ])('the function refusing "%s" reads as friendly copy', async (key, copy) => {
    invoke.mockResolvedValueOnce(refused(key));
    await expect(send(image)).rejects.toThrow(copy);
    expect(insert).not.toHaveBeenCalled();
  });

  test.each([
    ['upload the media first', "didn't finish uploading"],
    ['media is off in this chat', 'Photos and video are off in this chat'],
    ['video is too long', 'Videos can be up to 15 seconds.'],
    [
      'media limit reached',
      "You've sent today's photo, video or voice note in this chat.",
    ],
    ['voice note is too long', 'Voice notes can be up to 1 minute 30 seconds.'],
  ])('the database refusing "%s" reads as friendly copy', async (key, copy) => {
    uploads();
    insert.mockResolvedValueOnce({ error: { code: 'P0001', message: key } });
    await expect(send(image)).rejects.toThrow(copy);
  });

  test('the wording follows the limits read, not fixed numbers', async () => {
    uploads();
    insert.mockResolvedValueOnce({
      error: { code: 'P0001', message: 'voice note is too long' },
    });
    const mediaKey = await uploadChatMedia('c1', voice, limits);
    await expect(
      insertMediaMessage({
        id: 'msg-3',
        connectionId: 'c1',
        media: voice,
        mediaKey,
        limits: { ...limits, voiceMaxMs: 120_000 },
      }),
    ).rejects.toThrow('Voice notes can be up to 2 minutes.');
  });

  test('a closed chat or a Block refuses with the usual line', async () => {
    uploads();
    insert.mockResolvedValueOnce({ error: { code: '42501', message: 'rls' } });
    await expect(send(image)).rejects.toThrow(
      "You can't send messages in this chat any more.",
    );
  });
});

describe('fetchChatMediaLimits', () => {
  test("reads the server's limits", async () => {
    rpc.mockReturnValueOnce({
      single: async () => ({
        data: {
          video_max_ms: 15_000,
          image_max_bytes: 2_097_152,
          voice_max_ms: 120_000,
        },
        error: null,
      }),
    });
    await expect(fetchChatMediaLimits()).resolves.toEqual({
      videoMaxMs: 15_000,
      imageMaxBytes: 2_097_152,
      voiceMaxMs: 120_000,
    });
    expect(rpc).toHaveBeenCalledWith('chat_media_limits');
  });
});

describe('the daily media allowance', () => {
  test("reads the caller's allowance for one chat", async () => {
    rpc.mockReturnValueOnce({
      single: async () => ({
        data: { remaining: 0, next_at: '2026-10-25T10:00:00+00:00' },
        error: null,
      }),
    });
    await expect(fetchMediaAllowance('c1')).resolves.toEqual({
      remaining: 0,
      nextAt: '2026-10-25T10:00:00+00:00',
    });
    expect(rpc).toHaveBeenCalledWith('chat_media_allowance', {
      connection_id: 'c1',
    });
  });

  test.each([
    [4 * 60 + 10, 'Next photo, video or voice note in 5 h'],
    [60, 'Next photo, video or voice note in 1 h'],
    [59, 'Next photo, video or voice note in 59 min'],
    [0.5, 'Next photo, video or voice note in 1 min'],
  ])('a wait of %s minutes reads "%s"', (minutes, text) => {
    const now = Date.parse('2026-10-24T10:00:00Z');
    expect(waitText(new Date(now + minutes * 60_000).toISOString(), now)).toBe(
      text,
    );
  });
});

describe('fetchMediaUrls', () => {
  test('asks in batches of 60 and merges the links; missing ids stay missing', async () => {
    const ids = Array.from({ length: 61 }, (_, i) => `m${i}`);
    invoke
      .mockResolvedValueOnce({
        data: { urls: { m0: 'https://r2/m0' }, expiresIn: 600 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { urls: { m60: 'https://r2/m60' }, expiresIn: 600 },
        error: null,
      });
    await expect(fetchMediaUrls(ids)).resolves.toEqual({
      m0: 'https://r2/m0',
      m60: 'https://r2/m60',
    });
    expect(invoke).toHaveBeenNthCalledWith(1, 'media', {
      body: { action: 'chat-urls', messageIds: ids.slice(0, 60) },
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'media', {
      body: { action: 'chat-urls', messageIds: ['m60'] },
    });
  });

  test('no ids, no call', async () => {
    await expect(fetchMediaUrls([])).resolves.toEqual({});
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('Media Consent', () => {
  test('reads both sides of the switch', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ is_casual: true, mine: true, theirs: false }],
      error: null,
    });
    await expect(fetchMediaState('c1')).resolves.toEqual({
      isCasual: true,
      mine: true,
      theirs: false,
    });
    expect(rpc).toHaveBeenCalledWith('chat_media_state', {
      connection_id: 'c1',
    });
  });

  test('sets my side', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await setMediaConsent('c1', true);
    expect(rpc).toHaveBeenCalledWith('set_media_consent', {
      connection_id: 'c1',
      consent: true,
    });
  });

  test('a failure reads as the connection line', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(setMediaConsent('c1', false)).rejects.toThrow(
      "That didn't work",
    );
  });
});

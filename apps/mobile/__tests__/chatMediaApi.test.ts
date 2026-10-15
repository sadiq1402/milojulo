import {
  fetchMediaState,
  fetchMediaUrls,
  sendMediaMessage,
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

describe('sendMediaMessage', () => {
  test('asks for a link, PUTs with type and length, confirms, then inserts the message with its key, size and duration', async () => {
    uploads();
    await sendMediaMessage({ id: 'msg-1', connectionId: 'c1', media: image });

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
    await sendMediaMessage({ id: 'msg-2', connectionId: 'c1', media: voice });
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
    await expect(
      sendMediaMessage({ id: 'msg-1', connectionId: 'c1', media: image }),
    ).resolves.toBeUndefined();
  });

  test('a failed PUT is never confirmed or sent', async () => {
    invoke.mockResolvedValueOnce(upload);
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith('file://') ? { blob: async () => file } : { ok: false },
    );
    await expect(
      sendMediaMessage({ id: 'msg-1', connectionId: 'c1', media: image }),
    ).rejects.toThrow("didn't finish uploading");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
  });

  test.each([
    ['no upload to confirm', 'That upload took too long'],
    ["the media didn't arrive; try again", "didn't finish uploading"],
  ])('the confirm refusing "%s" reads as friendly copy', async (key, copy) => {
    invoke.mockResolvedValueOnce(upload).mockResolvedValueOnce(refused(key));
    await expect(
      sendMediaMessage({ id: 'msg-1', connectionId: 'c1', media: image }),
    ).rejects.toThrow(copy);
    expect(insert).not.toHaveBeenCalled();
  });

  test.each([
    ['image must be a JPEG of at most 5 MB', 'That photo is too large'],
    ['video must be an MP4 of at most 20 MB', 'That video is too large'],
    [
      'voice note must be an M4A of at most 5 MB',
      'That voice note is too large',
    ],
    ['video can be at most 30 seconds', 'Videos can be up to 30 seconds'],
    [
      'voice notes can be at most 2 minutes',
      'Voice notes can be up to 2 minutes',
    ],
    ['no connection', "can't send messages in this chat"],
    ['media is off in this chat', 'Photos and video are off in this chat'],
  ])('the function refusing "%s" reads as friendly copy', async (key, copy) => {
    invoke.mockResolvedValueOnce(refused(key));
    await expect(
      sendMediaMessage({ id: 'msg-1', connectionId: 'c1', media: image }),
    ).rejects.toThrow(copy);
    expect(insert).not.toHaveBeenCalled();
  });

  test.each([
    ['upload the media first', "didn't finish uploading"],
    ['media is off in this chat', 'Photos and video are off in this chat'],
  ])('the database refusing "%s" reads as friendly copy', async (key, copy) => {
    uploads();
    insert.mockResolvedValueOnce({ error: { code: 'P0001', message: key } });
    await expect(
      sendMediaMessage({ id: 'msg-1', connectionId: 'c1', media: image }),
    ).rejects.toThrow(copy);
  });

  test('a closed chat or a Block refuses with the usual line', async () => {
    uploads();
    insert.mockResolvedValueOnce({ error: { code: '42501', message: 'rls' } });
    await expect(
      sendMediaMessage({ id: 'msg-1', connectionId: 'c1', media: image }),
    ).rejects.toThrow("You can't send messages in this chat any more.");
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

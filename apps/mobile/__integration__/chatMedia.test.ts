import { signOut } from '../src/features/auth/api';
import { fetchMessages, newMessageId } from '../src/features/chat/api';
import {
  fetchChatMediaLimits,
  fetchMediaState,
  fetchMediaUrls,
  insertMediaMessage,
  uploadChatMedia,
  setMediaConsent,
} from '../src/features/chat/media';
import { supabase } from '../src/lib/supabase';
import { admin } from './support/admin';
import { connect, createMember, type TestMember } from './support/members';

// Written against the #12 contract before it merged; run once #12's migration and the media
// function's chat actions are on the shared database.

// Uploads go to the real R2 bucket through the local media function, so a test takes seconds.
jest.setTimeout(30000);

const tinyJpeg =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const image = {
  kind: 'image' as const,
  uri: tinyJpeg,
  mime: 'image/jpeg' as const,
  width: 1,
  height: 1,
  durationMs: null,
};

async function mediaServed(): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('media', {
      body: { action: 'chat-urls', messageIds: [] },
    });
    return !error;
  } catch {
    return false;
  }
}

// Upload, confirm and send, as the chat does, under the server's limits.
async function sendMediaMessage(message: {
  id: string;
  connectionId: string;
  media: typeof image;
}) {
  const limits = await fetchChatMediaLimits();
  const mediaKey = await uploadChatMedia(
    message.connectionId,
    message.media,
    limits,
  );
  await insertMediaMessage({ ...message, mediaKey, limits });
}

let me: TestMember;
let ravi: TestMember;
let connectionId: string;
let served = false;

beforeAll(async () => {
  me = await createMember('Asha', { app: true });
  ravi = await createMember('Ravi');
  connectionId = await connect(ravi, me);
  served = await mediaServed();
  if (!served) {
    console.warn(
      'media function not served locally; chat upload tests skipped',
    );
  }
});

afterAll(() => signOut());

test('outside Casual there is no Media Consent to give', async () => {
  await expect(fetchMediaState(connectionId)).resolves.toMatchObject({
    isCasual: false,
  });
});

test('a photo uploads, sends once with a retried id, and comes back by signed link', async () => {
  if (!served) {
    return;
  }
  const id = newMessageId();
  await sendMediaMessage({ id, connectionId, media: image });
  await sendMediaMessage({ id, connectionId, media: image });
  const sent = (await fetchMessages(connectionId)).filter(m => m.id === id);
  expect(sent).toEqual([
    expect.objectContaining({
      type: 'image',
      media: expect.objectContaining({ mime: 'image/jpeg', expired: false }),
    }),
  ]);
  const urls = await fetchMediaUrls([id]);
  expect(urls[id]).toMatch(/^https?:\/\//);
});

describe('limits from the settings row (#182)', () => {
  test("the app reads the server's launch limits", async () => {
    await expect(fetchChatMediaLimits()).resolves.toEqual({
      videoMaxMs: 15_000,
      imageMaxBytes: 2 * 1024 * 1024,
      voiceMaxMs: 120_000,
    });
  });

  test('a video over the limit is refused when it goes in, worded with the limit read', async () => {
    const limits = await fetchChatMediaLimits();
    await expect(
      insertMediaMessage({
        id: newMessageId(),
        connectionId,
        media: {
          kind: 'video',
          uri: 'file:///cache/v.mp4',
          mime: 'video/mp4',
          width: 1280,
          height: 720,
          durationMs: limits.videoMaxMs + 1,
        },
        mediaKey: `chat/${connectionId}/made-up.mp4`,
        limits,
      }),
    ).rejects.toThrow('Videos can be up to 15 seconds.');
  });

  test('a photo over the limit gets no upload link, worded with the limit read', async () => {
    if (!served) {
      return;
    }
    const limits = await fetchChatMediaLimits();
    const tooLarge = `data:image/jpeg;base64,${'A'.repeat(
      Math.ceil(((limits.imageMaxBytes + 1) * 4) / 3 / 4) * 4,
    )}`;
    await expect(
      uploadChatMedia(connectionId, { ...image, uri: tooLarge }, limits),
    ).rejects.toThrow('Photos can be up to 2 MB. Try another one.');
  });
});

describe('in a Casual Connection', () => {
  beforeAll(async () => {
    // Set up directly: the Casual preferences flow isn't what's under test here.
    await admin
      .from('connections')
      .update({ mode: 'casual' })
      .eq('id', connectionId);
  });

  test('both switches must be on before photos can be sent', async () => {
    await setMediaConsent(connectionId, true);
    await expect(fetchMediaState(connectionId)).resolves.toEqual({
      isCasual: true,
      mine: true,
      theirs: false,
    });
    if (served) {
      await expect(
        sendMediaMessage({ id: newMessageId(), connectionId, media: image }),
      ).rejects.toThrow('Photos and video are off in this chat');
    }
    await ravi.client.rpc('set_media_consent', {
      connection_id: connectionId,
      consent: true,
    });
    await expect(fetchMediaState(connectionId)).resolves.toMatchObject({
      mine: true,
      theirs: true,
    });
    if (served) {
      await expect(
        sendMediaMessage({ id: newMessageId(), connectionId, media: image }),
      ).resolves.toBeUndefined();
    }
  });
});

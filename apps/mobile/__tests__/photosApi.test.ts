import {
  deletePhoto,
  fetchPhotoUrls,
  uploadPhoto,
} from '../src/features/photos/api';
import { pickPhoto } from '../src/features/photos/picker';
import { supabase } from '../src/lib/supabase';
import ImagePicker from 'react-native-image-crop-picker';

// jest.setup.js stands Supabase in with an empty object; give it what the media function and
// the photos table would answer.
const invoke = jest.fn();
const stub = supabase as unknown as Record<string, unknown>;
stub.functions = { invoke };

// A refusal as supabase-js hands it back: the function's Response in `context`.
const refused = (message: string) => ({
  data: null,
  error: { context: { json: async () => ({ error: message }) } },
});

const file = { size: 123_456 };
let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn(async (url: string) =>
    url.startsWith('file://')
      ? { blob: async () => file }
      : { ok: true, status: 200 },
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('uploadPhoto', () => {
  test('asks for a link, PUTs the JPEG, confirms, and returns the photo id', async () => {
    invoke
      .mockResolvedValueOnce({
        data: { photoId: 'ph1', uploadUrl: 'https://r2/put', expiresIn: 300 },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    await expect(uploadPhoto(2, 'file:///tmp/a.jpg')).resolves.toBe('ph1');

    expect(invoke).toHaveBeenNthCalledWith(1, 'media', {
      body: {
        action: 'photo-upload',
        position: 2,
        contentType: 'image/jpeg',
        size: 123_456,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith('https://r2/put', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: file,
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'media', {
      body: { action: 'photo-confirm', photoId: 'ph1' },
    });
  });

  test('a PUT that fails is never confirmed', async () => {
    invoke.mockResolvedValueOnce({
      data: { photoId: 'ph1', uploadUrl: 'https://r2/put', expiresIn: 300 },
      error: null,
    });
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith('file://')
        ? { blob: async () => file }
        : { ok: false, status: 403 },
    );
    await expect(uploadPhoto(1, 'file:///tmp/a.jpg')).rejects.toThrow(
      "The photo didn't finish uploading. Try again.",
    );
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['sign in first', "You've been signed out. Sign in again to add photos."],
    [
      'photo must be a JPEG of at most 5 MB',
      'That photo is too large to upload. Try another one.',
    ],
    [
      'something else',
      "That didn't work. Check your connection and try again.",
    ],
  ])('a link refused with "%s" reads "%s"', async (message, copy) => {
    invoke.mockResolvedValueOnce(refused(message));
    await expect(uploadPhoto(1, 'file:///tmp/a.jpg')).rejects.toThrow(copy);
  });

  test.each([
    ['no photo upload to confirm', 'That upload took too long. Try again.'],
    [
      "the photo didn't arrive; try again",
      "The photo didn't finish uploading. Try again.",
    ],
  ])('a confirm refused with "%s" reads "%s"', async (message, copy) => {
    invoke
      .mockResolvedValueOnce({
        data: { photoId: 'ph1', uploadUrl: 'https://r2/put', expiresIn: 300 },
        error: null,
      })
      .mockResolvedValueOnce(refused(message));
    await expect(uploadPhoto(1, 'file:///tmp/a.jpg')).rejects.toThrow(copy);
  });

  test('a network failure without a body reads as a connection problem', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    await expect(uploadPhoto(1, 'file:///tmp/a.jpg')).rejects.toThrow(
      "That didn't work. Check your connection and try again.",
    );
  });
});

describe('deletePhoto', () => {
  // The rest of my photos, as the table returns them after the delete.
  function photosTable(rows: { id: string; position: number }[]) {
    const update = jest.fn(() => ({
      eq: jest.fn(async () => ({ error: null })),
    }));
    stub.from = jest.fn(() => ({
      select: () => ({ order: async () => ({ data: rows, error: null }) }),
      update,
    }));
    return update;
  }

  test('goes through the media function, then closes the gap', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const update = photosTable([
      { id: 'b', position: 2 },
      { id: 'c', position: 3 },
    ]);
    await deletePhoto('a');
    expect(invoke).toHaveBeenCalledWith('media', {
      body: { action: 'photo-delete', photoId: 'a' },
    });
    expect(update).toHaveBeenNthCalledWith(1, { position: 1 });
    expect(update).toHaveBeenNthCalledWith(2, { position: 2 });
  });

  test.each([
    ['no photo to delete', 'That photo is already gone.'],
    [
      'add at least 2 photos',
      'Your profile needs at least 2 photos. Add another before removing this one.',
    ],
  ])('refused with "%s" reads "%s"', async (message, copy) => {
    invoke.mockResolvedValueOnce(refused(message));
    await expect(deletePhoto('a')).rejects.toThrow(copy);
  });
});

describe('fetchPhotoUrls', () => {
  test('nothing asked, nothing called', async () => {
    await expect(fetchPhotoUrls([])).resolves.toEqual({});
    expect(invoke).not.toHaveBeenCalled();
  });

  test('ids are de-duplicated and sent at most 60 per call, then merged', async () => {
    invoke.mockImplementation(
      async (_: string, { body }: { body: { photoIds: string[] } }) => ({
        data: {
          urls: Object.fromEntries(body.photoIds.map(id => [id, `url-${id}`])),
          expiresIn: 600,
        },
        error: null,
      }),
    );
    const ids = Array.from({ length: 130 }, (_, i) => `id${i}`);
    const urls = await fetchPhotoUrls([...ids, 'id0', 'id1']);
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(
      invoke.mock.calls.map(([, { body }]) => body.photoIds.length),
    ).toEqual([60, 60, 10]);
    expect(invoke.mock.calls[0][1].body.action).toBe('photo-urls');
    expect(Object.keys(urls)).toHaveLength(130);
    expect(urls.id129).toBe('url-id129');
  });
});

describe('pickPhoto', () => {
  test('crops to 4:5 at 1080 x 1350 as a JPEG at quality 0.8', async () => {
    jest
      .mocked(ImagePicker.openCamera)
      .mockResolvedValue({ path: '/data/x.jpg' } as never);
    await expect(pickPhoto('camera')).resolves.toBe('file:///data/x.jpg');
    expect(ImagePicker.openCamera).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: 'photo',
        cropping: true,
        width: 1080,
        height: 1350,
        compressImageQuality: 0.8,
        forceJpg: true,
      }),
    );
  });

  test('backing out is not an error', async () => {
    jest
      .mocked(ImagePicker.openPicker)
      .mockRejectedValue({ code: 'E_PICKER_CANCELLED' });
    await expect(pickPhoto('library')).resolves.toBeNull();
  });

  test('no photo permission says how to allow it', async () => {
    jest
      .mocked(ImagePicker.openPicker)
      .mockRejectedValue({ code: 'E_NO_LIBRARY_PERMISSION' });
    await expect(pickPhoto('library')).rejects.toThrow(
      "Allow photo access for MiloJulo in your phone's settings, then try again.",
    );
  });
});

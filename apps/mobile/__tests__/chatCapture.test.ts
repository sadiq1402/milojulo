import ImagePicker from 'react-native-image-crop-picker';
import { Video, getVideoMetaData } from 'react-native-compressor';
import Sound from 'react-native-nitro-sound';
import { pickMedia, startVoiceNote } from '../src/features/chat/capture';

// The server's launch limits (#182).
const limits = {
  videoMaxMs: 15_000,
  imageMaxBytes: 2 * 1024 * 1024,
  voiceMaxMs: 120_000,
};

const pickedImage = {
  path: '/data/a.jpg',
  mime: 'image/jpeg',
  width: 1600,
  height: 1200,
  size: 300_000,
};
const pickedVideo = {
  path: '/data/v.mp4',
  mime: 'video/mp4',
  width: 1280,
  height: 720,
  size: 40_000_000,
  duration: 12_000,
};

describe('pickMedia', () => {
  test('a gallery photo comes back as a compressed JPEG with its size', async () => {
    jest.mocked(ImagePicker.openPicker).mockResolvedValue(pickedImage as never);
    await expect(pickMedia('library', limits)).resolves.toEqual({
      kind: 'image',
      uri: 'file:///data/a.jpg',
      mime: 'image/jpeg',
      width: 1600,
      height: 1200,
      durationMs: null,
    });
    expect(ImagePicker.openPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: 'any',
        forceJpg: true,
        compressImageQuality: expect.any(Number),
      }),
    );
  });

  test("a photo over the server's image limit after compressing is refused before upload, naming the limit", async () => {
    jest.mocked(ImagePicker.openPicker).mockResolvedValue({
      ...pickedImage,
      size: 2 * 1024 * 1024 + 1,
    } as never);
    await expect(pickMedia('library', limits)).rejects.toThrow(
      'Photos can be up to 2 MB. Try another one.',
    );
  });

  test("a photo right at the server's image limit goes ahead", async () => {
    jest
      .mocked(ImagePicker.openPicker)
      .mockResolvedValue({ ...pickedImage, size: 2 * 1024 * 1024 } as never);
    await expect(pickMedia('library', limits)).resolves.toMatchObject({
      kind: 'image',
    });
  });

  test('a video is compressed to MP4 and keeps its duration', async () => {
    jest.mocked(ImagePicker.openPicker).mockResolvedValue(pickedVideo as never);
    jest.mocked(Video.compress).mockResolvedValue('file:///cache/small.mp4');
    jest.mocked(getVideoMetaData).mockResolvedValue({
      extension: 'mp4',
      size: 6_000_000,
      duration: 12,
      width: 1280,
      height: 720,
    });
    await expect(pickMedia('library', limits)).resolves.toEqual({
      kind: 'video',
      uri: 'file:///cache/small.mp4',
      mime: 'video/mp4',
      width: 1280,
      height: 720,
      durationMs: 12_000,
    });
    expect(Video.compress).toHaveBeenCalledWith(
      'file:///data/v.mp4',
      expect.objectContaining({ compressionMethod: 'auto' }),
    );
  });

  test("a video over the server's limit is refused before compressing, naming the limit", async () => {
    jest
      .mocked(ImagePicker.openPicker)
      .mockResolvedValue({ ...pickedVideo, duration: 15_001 } as never);
    await expect(pickMedia('library', limits)).rejects.toThrow(
      'Videos can be up to 15 seconds.',
    );
    expect(Video.compress).not.toHaveBeenCalled();
  });

  test("a video of unknown length is checked against the server's limit after compressing", async () => {
    jest
      .mocked(ImagePicker.openPicker)
      .mockResolvedValue({ ...pickedVideo, duration: null } as never);
    jest.mocked(Video.compress).mockResolvedValue('file:///cache/small.mp4');
    jest.mocked(getVideoMetaData).mockResolvedValue({
      extension: 'mp4',
      size: 6_000_000,
      duration: 16,
      width: 1280,
      height: 720,
    });
    await expect(pickMedia('library', limits)).rejects.toThrow(
      'Videos can be up to 15 seconds.',
    );
  });

  test('a video still over 20 MB after compressing is refused', async () => {
    jest.mocked(ImagePicker.openPicker).mockResolvedValue(pickedVideo as never);
    jest.mocked(Video.compress).mockResolvedValue('file:///cache/small.mp4');
    jest.mocked(getVideoMetaData).mockResolvedValue({
      extension: 'mp4',
      size: 21_000_000,
      duration: 12,
      width: 1280,
      height: 720,
    });
    await expect(pickMedia('library', limits)).rejects.toThrow('too large');
  });

  test('the camera asks for a photo or a video', async () => {
    jest.mocked(ImagePicker.openCamera).mockResolvedValue(pickedImage as never);
    await pickMedia('camera-photo', limits);
    expect(ImagePicker.openCamera).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: 'photo' }),
    );
    jest.mocked(ImagePicker.openCamera).mockResolvedValue(pickedVideo as never);
    jest.mocked(Video.compress).mockResolvedValue('file:///cache/small.mp4');
    jest.mocked(getVideoMetaData).mockResolvedValue({
      extension: 'mp4',
      size: 6_000_000,
      duration: 12,
      width: 1280,
      height: 720,
    });
    await pickMedia('camera-video', limits);
    expect(ImagePicker.openCamera).toHaveBeenLastCalledWith(
      expect.objectContaining({ mediaType: 'video' }),
    );
  });

  test('backing out is not an error', async () => {
    jest
      .mocked(ImagePicker.openPicker)
      .mockRejectedValue(
        Object.assign(new Error('cancel'), { code: 'E_PICKER_CANCELLED' }),
      );
    await expect(pickMedia('library', limits)).resolves.toBeNull();
  });
});

describe('voice notes', () => {
  test("records AAC in M4A and stops at the server's voice limit on its own", async () => {
    jest.mocked(Sound.startRecorder).mockResolvedValue('file:///cache/v.m4a');
    jest.mocked(Sound.stopRecorder).mockResolvedValue('file:///cache/v.m4a');
    const onTick = jest.fn();
    const onLimit = jest.fn();
    const recording = await startVoiceNote({
      limitMs: 90_000,
      onTick,
      onLimit,
    });
    const listener = jest.mocked(Sound.addRecordBackListener).mock.calls[0][0];
    listener({ currentPosition: 5_000 });
    expect(onTick).toHaveBeenCalledWith(5_000);
    listener({ currentPosition: 89_999 });
    expect(onLimit).not.toHaveBeenCalled();
    listener({ currentPosition: 90_000 });
    expect(onLimit).toHaveBeenCalled();

    await expect(recording.stop()).resolves.toEqual({
      kind: 'voice',
      uri: 'file:///cache/v.m4a',
      mime: 'audio/mp4',
      width: null,
      height: null,
      durationMs: 90_000,
    });
    expect(Sound.removeRecordBackListener).toHaveBeenCalled();
  });

  test('a tap shorter than a second is dropped', async () => {
    jest.mocked(Sound.startRecorder).mockResolvedValue('file:///cache/v.m4a');
    jest.mocked(Sound.stopRecorder).mockResolvedValue('file:///cache/v.m4a');
    const recording = await startVoiceNote({ limitMs: 120_000 });
    jest.mocked(Sound.addRecordBackListener).mock.calls[0][0]({
      currentPosition: 400,
    });
    await expect(recording.stop()).resolves.toBeNull();
  });
});

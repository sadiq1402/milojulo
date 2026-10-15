import ImagePicker from 'react-native-image-crop-picker';
import { Video, getVideoMetaData } from 'react-native-compressor';
import Sound from 'react-native-nitro-sound';
import {
  pickMedia,
  startVoiceNote,
  voiceLimitMs,
} from '../src/features/chat/capture';

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
    await expect(pickMedia('library')).resolves.toEqual({
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
    await expect(pickMedia('library')).resolves.toEqual({
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

  test('a video over 30 seconds is refused before compressing', async () => {
    jest
      .mocked(ImagePicker.openPicker)
      .mockResolvedValue({ ...pickedVideo, duration: 31_000 } as never);
    await expect(pickMedia('library')).rejects.toThrow(
      'Videos can be up to 30 seconds.',
    );
    expect(Video.compress).not.toHaveBeenCalled();
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
    await expect(pickMedia('library')).rejects.toThrow('too large');
  });

  test('the camera asks for a photo or a video', async () => {
    jest.mocked(ImagePicker.openCamera).mockResolvedValue(pickedImage as never);
    await pickMedia('camera-photo');
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
    await pickMedia('camera-video');
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
    await expect(pickMedia('library')).resolves.toBeNull();
  });
});

describe('voice notes', () => {
  test('records AAC in M4A and stops at 2 minutes on its own', async () => {
    jest.mocked(Sound.startRecorder).mockResolvedValue('file:///cache/v.m4a');
    jest.mocked(Sound.stopRecorder).mockResolvedValue('file:///cache/v.m4a');
    const onTick = jest.fn();
    const onLimit = jest.fn();
    const recording = await startVoiceNote({ onTick, onLimit });
    const listener = jest.mocked(Sound.addRecordBackListener).mock.calls[0][0];
    listener({ currentPosition: 5_000 });
    expect(onTick).toHaveBeenCalledWith(5_000);
    listener({ currentPosition: voiceLimitMs });
    expect(onLimit).toHaveBeenCalled();

    await expect(recording.stop()).resolves.toEqual({
      kind: 'voice',
      uri: 'file:///cache/v.m4a',
      mime: 'audio/mp4',
      width: null,
      height: null,
      durationMs: voiceLimitMs,
    });
    expect(Sound.removeRecordBackListener).toHaveBeenCalled();
  });

  test('a tap shorter than a second is dropped', async () => {
    jest.mocked(Sound.startRecorder).mockResolvedValue('file:///cache/v.m4a');
    jest.mocked(Sound.stopRecorder).mockResolvedValue('file:///cache/v.m4a');
    const recording = await startVoiceNote({});
    jest.mocked(Sound.addRecordBackListener).mock.calls[0][0]({
      currentPosition: 400,
    });
    await expect(recording.stop()).resolves.toBeNull();
  });
});

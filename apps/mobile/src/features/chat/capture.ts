import { PermissionsAndroid, Platform } from 'react-native';
import { Video, getVideoMetaData } from 'react-native-compressor';
import ImagePicker from 'react-native-image-crop-picker';
import Sound, {
  AudioEncoderAndroidType,
  OutputFormatAndroidType,
} from 'react-native-nitro-sound';
import { colors } from '../../theme';
import { fileUri, pickerFailure } from '../media/picker';
import {
  limitCopy,
  tooLargeVideo,
  type ChatMediaLimits,
  type OutgoingMedia,
} from './media';

export type MediaSource = 'library' | 'camera-photo' | 'camera-video';

// Checked here first so nothing too big uploads: the server's limits (#182), and the media
// function's fixed video size (#12).
const videoLimitBytes = 20 * 1024 * 1024;
const shortestVoiceMs = 1_000;

// Chat photos are compressed to JPEG on the phone; no crop, the bubble shows them 4:3.
const pickerOptions = {
  compressImageMaxWidth: 1600,
  compressImageMaxHeight: 1600,
  compressImageQuality: 0.8,
  forceJpg: true,
  cropping: false,
  cropperActiveWidgetColor: colors.orchid,
} as const;

// The picked photo or video, compressed and checked; null when the Member backs out.
export async function pickMedia(
  source: MediaSource,
  limits: ChatMediaLimits,
): Promise<OutgoingMedia | null> {
  const copy = limitCopy(limits);
  let picked;
  try {
    picked =
      source === 'library'
        ? await ImagePicker.openPicker({ ...pickerOptions, mediaType: 'any' })
        : await ImagePicker.openCamera({
            ...pickerOptions,
            mediaType: source === 'camera-video' ? 'video' : 'photo',
          });
  } catch (error) {
    const failure = pickerFailure(
      error,
      "We couldn't open that. Try another one.",
    );
    if (failure) {
      throw failure;
    }
    return null;
  }
  if (!picked.mime.startsWith('video/')) {
    if (picked.size > limits.imageMaxBytes) {
      throw new Error(copy.tooLargePhoto);
    }
    return {
      kind: 'image',
      uri: fileUri(picked.path),
      mime: 'image/jpeg',
      width: picked.width,
      height: picked.height,
      durationMs: null,
    };
  }
  const pickedMs = (picked as { duration?: number | null }).duration ?? null;
  if (pickedMs !== null && pickedMs > limits.videoMaxMs) {
    throw new Error(copy.tooLongVideo);
  }
  let uri: string;
  let meta;
  try {
    uri = await Video.compress(fileUri(picked.path), {
      compressionMethod: 'auto',
    });
    meta = await getVideoMetaData(uri);
  } catch {
    throw new Error("We couldn't prepare that video. Try another one.");
  }
  // The compressor reports seconds.
  const durationMs = pickedMs ?? Math.round(meta.duration * 1000);
  if (durationMs > limits.videoMaxMs) {
    throw new Error(copy.tooLongVideo);
  }
  if (meta.size > videoLimitBytes) {
    throw new Error(tooLargeVideo);
  }
  return {
    kind: 'video',
    uri,
    mime: 'video/mp4',
    width: meta.width || picked.width,
    height: meta.height || picked.height,
    durationMs,
  };
}

async function micAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export const micRefusal =
  "Allow microphone access for MiloJulo in your phone's settings, then try again.";

export type VoiceRecording = {
  // The finished note, or null when it was too short to send.
  stop: () => Promise<OutgoingMedia | null>;
};

// Records AAC in an M4A file; `onLimit` fires at `limitMs` (the server's voice limit) so the
// caller stops and sends.
export async function startVoiceNote({
  limitMs,
  onTick,
  onLimit,
}: {
  limitMs: number;
  onTick?: (ms: number) => void;
  onLimit?: () => void;
}): Promise<VoiceRecording> {
  if (!(await micAllowed())) {
    throw new Error(micRefusal);
  }
  let elapsed = 0;
  let limitHit = false;
  Sound.addRecordBackListener(({ currentPosition }) => {
    elapsed = Math.min(currentPosition, limitMs);
    onTick?.(elapsed);
    if (currentPosition >= limitMs && !limitHit) {
      limitHit = true;
      onLimit?.();
    }
  });
  try {
    await Sound.startRecorder(undefined, {
      OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
      AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
      AVFormatIDKeyIOS: 'aac',
      AudioChannels: 1,
      AudioSamplingRate: 44_100,
      AudioEncodingBitRate: 64_000,
    });
  } catch {
    Sound.removeRecordBackListener();
    throw new Error("We couldn't start recording. Try again.");
  }
  return {
    stop: async () => {
      Sound.removeRecordBackListener();
      const path = await Sound.stopRecorder();
      if (elapsed < shortestVoiceMs) {
        return null;
      }
      return {
        kind: 'voice',
        uri: fileUri(path),
        mime: 'audio/mp4',
        width: null,
        height: null,
        durationMs: elapsed,
      };
    },
  };
}

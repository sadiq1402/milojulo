import { supabase } from '../../lib/supabase';
import {
  fallback,
  fetchSignedUrls,
  invokeMedia,
  refusalFrom,
} from '../media/mediaFunction';
import { cannotSendMessage } from './api';

export type MediaKind = 'image' | 'video' | 'voice';

// A file ready to send: compressed on the phone, in the format the media function takes.
export type OutgoingMedia = {
  kind: MediaKind;
  uri: string;
  mime: 'image/jpeg' | 'video/mp4' | 'audio/mp4';
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

const notArrived = "It didn't finish uploading. Try again.";
export const mediaOffCopy =
  'Photos and video are off in this chat until you both allow them.';

// The chat media limits in force (#182): the server's settings row, never above the fixed
// maximums. The fixed ones stand in until the server's arrive; the server checks again anyway.
export type ChatMediaLimits = {
  videoMaxMs: number;
  imageMaxBytes: number;
  voiceMaxMs: number;
};
export const fixedLimits: ChatMediaLimits = {
  videoMaxMs: 30_000,
  imageMaxBytes: 5 * 1024 * 1024,
  voiceMaxMs: 120_000,
};

export async function fetchChatMediaLimits(): Promise<ChatMediaLimits> {
  const { data, error } = await supabase.rpc('chat_media_limits').single();
  if (error || !data) {
    throw new Error("That didn't work. Check your connection and try again.");
  }
  return {
    videoMaxMs: data.video_max_ms,
    imageMaxBytes: data.image_max_bytes,
    voiceMaxMs: data.voice_max_ms,
  };
}

// "15 seconds", "2 minutes", "1 minute 30 seconds".
export function lengthText(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return [
    minutes > 0 ? unit(minutes, 'minute') : null,
    seconds > 0 || minutes === 0 ? unit(seconds, 'second') : null,
  ]
    .filter(Boolean)
    .join(' ');
}

// "2 MB", "1.5 MB".
const sizeText = (bytes: number) =>
  `${Math.floor((bytes / (1024 * 1024)) * 10) / 10} MB`;

// The wording that names a limit; the server's refusals carry no numbers, so they come from here.
export function limitCopy(limits: ChatMediaLimits) {
  return {
    tooLargePhoto: `Photos can be up to ${sizeText(
      limits.imageMaxBytes,
    )}. Try another one.`,
    tooLongVideo: `Videos can be up to ${lengthText(limits.videoMaxMs)}.`,
    tooLongVoice: `Voice notes can be up to ${lengthText(limits.voiceMaxMs)}.`,
    attachNote: `Videos up to ${lengthText(
      limits.videoMaxMs,
    )}. Photos, videos and voice notes are deleted after 90 days.`,
  };
}

// The caller's media messages left in one chat today (#183): null `remaining` means no limit;
// `nextAt` is when the next one opens once they are used up.
export type MediaAllowance = {
  remaining: number | null;
  nextAt: string | null;
};

export async function fetchMediaAllowance(
  connectionId: string,
): Promise<MediaAllowance> {
  const { data, error } = await supabase
    .rpc('chat_media_allowance', { connection_id: connectionId })
    .single();
  if (error || !data) {
    throw new Error("That didn't work. Check your connection and try again.");
  }
  return { remaining: data.remaining, nextAt: data.next_at };
}

// "Next photo, video or voice note in 5 h" (whole hours, rounded up), or in minutes under an hour.
export function waitText(nextAt: string, now = Date.now()): string {
  const minutes = Math.max(1, Math.ceil((Date.parse(nextAt) - now) / 60_000));
  const wait =
    minutes >= 60 ? `${Math.ceil(minutes / 60)} h` : `${minutes} min`;
  return `Next photo, video or voice note in ${wait}`;
}

export const tooLargeVideo =
  'That video is too large to send. Try a shorter one.';
const wrongType = "That file can't be sent. Try another one.";

// Keys are the media function's and the database's exact messages (#12, #182).
const fixedRefusals: Record<string, string> = {
  'sign in first': "You've been signed out. Sign in again to send this.",
  'image must be a JPEG': wrongType,
  'video must be an MP4': wrongType,
  'voice note must be an M4A': wrongType,
  'video is too large': tooLargeVideo,
  'voice note is too large':
    'That voice note is too large to send. Try a shorter one.',
  'no connection': cannotSendMessage,
  'upload the media first': notArrived,
  'no upload to confirm': 'That upload took too long. Try again.',
  "the media didn't arrive; try again": notArrived,
  'media is off in this chat': mediaOffCopy,
  'media limit reached':
    "You've sent today's photo, video or voice note in this chat.",
};

function refusalsFor(limits: ChatMediaLimits): Record<string, string> {
  const copy = limitCopy(limits);
  return {
    ...fixedRefusals,
    'image is too large': copy.tooLargePhoto,
    'video is too long': copy.tooLongVideo,
    'voice note is too long': copy.tooLongVoice,
  };
}

// Upload link (a staging key), PUT to R2, then confirm (the function copies it to its final
// key). The key it returns is what the message carries.
export async function uploadChatMedia(
  connectionId: string,
  media: OutgoingMedia,
  limits: ChatMediaLimits,
): Promise<string> {
  const refusals = refusalsFor(limits);
  const invoke = <T>(body: Record<string, unknown>) =>
    invokeMedia<T>(body, refusals);
  let file: Blob;
  try {
    file = await (await fetch(media.uri)).blob();
  } catch {
    throw new Error("We couldn't read that file. Try another one.");
  }
  const { uploadId, uploadUrl } = await invoke<{
    uploadId: string;
    uploadUrl: string;
    expiresIn: number;
  }>({
    action: 'chat-upload',
    connectionId,
    kind: media.kind,
    contentType: media.mime,
    size: file.size,
  });
  let put: Response;
  try {
    put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': media.mime,
        'Content-Length': String(file.size),
      },
      body: file,
    });
  } catch {
    throw new Error(notArrived);
  }
  if (!put.ok) {
    throw new Error(notArrived);
  }
  const { mediaKey } = await invoke<{ mediaKey: string }>({
    action: 'chat-confirm',
    uploadId,
  });
  return mediaKey;
}

// The message for a confirmed upload. A retry reuses `id` and the key, so nothing uploads again;
// a send that got through earlier is a unique violation and counts as sent.
export async function insertMediaMessage({
  id,
  connectionId,
  media,
  mediaKey,
  limits,
}: {
  id: string;
  connectionId: string;
  media: OutgoingMedia;
  mediaKey: string;
  limits: ChatMediaLimits;
}): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    id,
    connection_id: connectionId,
    type: media.kind,
    media_key: mediaKey,
    media_mime: media.mime,
    media_width: media.width,
    media_height: media.height,
    media_duration_ms: media.durationMs,
  });
  if (!error || error.code === '23505') {
    return;
  }
  if (error.code === '42501') {
    throw new Error(cannotSendMessage);
  }
  throw refusalFrom(refusalsFor(limits))(error.message);
}

// Signed links by message id; ids I may not see (expired, or withheld by Media Consent) are
// simply missing.
export async function fetchMediaUrls(
  messageIds: string[],
): Promise<Record<string, string>> {
  return fetchSignedUrls('chat-urls', 'messageIds', messageIds, fixedRefusals);
}

export type MediaState = { isCasual: boolean; mine: boolean; theirs: boolean };

// Media Consent: in a Casual Connection both sides must switch it on before images or video.
export async function fetchMediaState(
  connectionId: string,
): Promise<MediaState> {
  const { data, error } = await supabase.rpc('chat_media_state', {
    connection_id: connectionId,
  });
  if (error) {
    throw new Error(fallback);
  }
  const row = data[0];
  return {
    isCasual: row?.is_casual ?? false,
    mine: row?.mine ?? false,
    theirs: row?.theirs ?? false,
  };
}

export async function setMediaConsent(
  connectionId: string,
  consent: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('set_media_consent', {
    connection_id: connectionId,
    consent,
  });
  if (error) {
    throw new Error(fallback);
  }
}

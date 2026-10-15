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

// Keys are the media function's and the database's exact messages (#12).
const refusals: Record<string, string> = {
  'sign in first': "You've been signed out. Sign in again to send this.",
  'image must be a JPEG of at most 5 MB':
    'That photo is too large to send. Try another one.',
  'video must be an MP4 of at most 20 MB':
    'That video is too large to send. Try a shorter one.',
  'voice note must be an M4A of at most 5 MB':
    'That voice note is too large to send. Try a shorter one.',
  'video can be at most 30 seconds': 'Videos can be up to 30 seconds.',
  'voice notes can be at most 2 minutes': 'Voice notes can be up to 2 minutes.',
  'no connection': cannotSendMessage,
  'upload the media first': notArrived,
  'no upload to confirm': 'That upload took too long. Try again.',
  "the media didn't arrive; try again": notArrived,
  'media is off in this chat': mediaOffCopy,
};

// The phone checks these before uploading too, with the same copy.
export const tooLargePhoto = refusals['image must be a JPEG of at most 5 MB'];
export const tooLargeVideo = refusals['video must be an MP4 of at most 20 MB'];
export const tooLongVideo = refusals['video can be at most 30 seconds'];

const refusal = refusalFrom(refusals);
const invoke = <T>(body: Record<string, unknown>) =>
  invokeMedia<T>(body, refusals);

// Upload link (a staging key), PUT to R2, then confirm (the function copies it to its final
// key). The key it returns is what the message carries.
export async function uploadChatMedia(
  connectionId: string,
  media: OutgoingMedia,
): Promise<string> {
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
}: {
  id: string;
  connectionId: string;
  media: OutgoingMedia;
  mediaKey: string;
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
  throw refusal(error.message);
}

// Signed links by message id; ids I may not see (expired, or withheld by Media Consent) are
// simply missing.
export async function fetchMediaUrls(
  messageIds: string[],
): Promise<Record<string, string>> {
  return fetchSignedUrls('chat-urls', 'messageIds', messageIds, refusals);
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

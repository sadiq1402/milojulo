import { supabase } from '../../lib/supabase';
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

// The media function signs at most this many links per call.
const urlBatchSize = 60;

const fallback = "That didn't work. Check your connection and try again.";
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

const refusal = (message?: string) =>
  new Error((message && refusals[message]) || fallback);

async function refusalMessage(error: unknown): Promise<string | undefined> {
  const context = (error as { context?: { json?: () => Promise<unknown> } })
    .context;
  if (typeof context?.json !== 'function') {
    return undefined;
  }
  try {
    const body = (await context.json()) as { error?: unknown };
    return typeof body?.error === 'string' ? body.error : undefined;
  } catch {
    return undefined;
  }
}

async function invokeMedia<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('media', { body });
  if (error) {
    throw refusal(await refusalMessage(error));
  }
  return data as T;
}

// Upload link (a staging key), PUT to R2, confirm (the function copies it to its final key), then
// the message itself. A retry reuses `id`, so a send that got
// through earlier isn't doubled (the repeat insert is a unique violation).
export async function sendMediaMessage({
  id,
  connectionId,
  media,
}: {
  id: string;
  connectionId: string;
  media: OutgoingMedia;
}): Promise<void> {
  let file: Blob;
  try {
    file = await (await fetch(media.uri)).blob();
  } catch {
    throw new Error("We couldn't read that file. Try another one.");
  }
  const { uploadId, uploadUrl } = await invokeMedia<{
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
  const { mediaKey } = await invokeMedia<{ mediaKey: string }>({
    action: 'chat-confirm',
    uploadId,
  });
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

// Signed links by message id; ids I may not see (or whose media expired) are simply missing.
export async function fetchMediaUrls(
  messageIds: string[],
): Promise<Record<string, string>> {
  const ids = [...new Set(messageIds)];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += urlBatchSize) {
    batches.push(ids.slice(i, i + urlBatchSize));
  }
  const results = await Promise.all(
    batches.map(batch =>
      invokeMedia<{ urls: Record<string, string> }>({
        action: 'chat-urls',
        messageIds: batch,
      }),
    ),
  );
  return Object.assign({}, ...results.map(result => result.urls));
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

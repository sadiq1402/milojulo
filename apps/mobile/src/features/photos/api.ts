import { supabase } from '../../lib/supabase';
import {
  fallback,
  fetchSignedUrls,
  invokeMedia,
  refusalFrom,
} from '../media/mediaFunction';
import type { MyPhoto } from './model';

export type { MyPhoto } from './model';

// Keys are the media function's and the database's exact messages.
const refusals: Record<string, string> = {
  'sign in first': "You've been signed out. Sign in again to add photos.",
  'photo must be a JPEG of at most 5 MB':
    'That photo is too large to upload. Try another one.',
  'no photo upload to confirm': 'That upload took too long. Try again.',
  "the photo didn't arrive; try again":
    "The photo didn't finish uploading. Try again.",
  'accept the terms first':
    'Accept the terms and give your date of birth first.',
  'your account cannot add photos': "Your account can't add photos right now.",
  'choose a photo position from 1 to 4': 'Photos go in places 1 to 4.',
  'no photo to delete': 'That photo is already gone.',
  'no photo to move': 'That photo is already gone.',
  'add at least 2 photos':
    'Your profile needs at least 2 photos. Add another before removing this one.',
};

const refusal = refusalFrom(refusals);
const invoke = <T>(body: Record<string, unknown>) =>
  invokeMedia<T>(body, refusals);

// Upload link, PUT to R2, then confirm; the photo takes `position`, replacing any photo there.
export async function uploadPhoto(
  position: number,
  localUri: string,
): Promise<string> {
  let file: Blob;
  try {
    file = await (await fetch(localUri)).blob();
  } catch {
    throw new Error("We couldn't read that photo. Try another one.");
  }
  const { photoId, uploadUrl } = await invoke<{
    photoId: string;
    uploadUrl: string;
    expiresIn: number;
  }>({
    action: 'photo-upload',
    position,
    contentType: 'image/jpeg',
    size: file.size,
  });
  let put: Response;
  try {
    put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: file,
    });
  } catch {
    throw refusal("the photo didn't arrive; try again");
  }
  if (!put.ok) {
    throw refusal("the photo didn't arrive; try again");
  }
  await invoke({ action: 'photo-confirm', photoId });
  return photoId;
}

// In order. Only photos neither hidden (Auto-hide) nor taken down count, as in the profile
// minimum; the table holds only confirmed photos (pending uploads are kept apart, #35).
export async function fetchMyPhotos(): Promise<MyPhoto[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('id, position')
    .is('hidden_at', null)
    .is('removed_at', null)
    .order('position');
  if (error) {
    throw new Error(fallback);
  }
  return data;
}

// Moves a photo to `position`, swapping with any photo there, in one statement.
export async function movePhoto(photoId: string, position: number) {
  const { error } = await supabase.rpc('move_photo', {
    photo_id: photoId,
    new_position: position,
  });
  if (error) {
    throw refusal(error.message);
  }
}

// The media function deletes the row and its R2 file; then the gap closes, so the cover stays
// the first photo.
export async function deletePhoto(photoId: string) {
  await invoke({ action: 'photo-delete', photoId });
  const rest = await fetchMyPhotos();
  for (const [index, photo] of rest.entries()) {
    if (photo.position !== index + 1) {
      await movePhoto(photo.id, index + 1);
    }
  }
}

// Signed links by photo id; ids I may not see are simply missing.
export async function fetchPhotoUrls(
  photoIds: string[],
): Promise<Record<string, string>> {
  return fetchSignedUrls('photo-urls', 'photoIds', photoIds, refusals);
}

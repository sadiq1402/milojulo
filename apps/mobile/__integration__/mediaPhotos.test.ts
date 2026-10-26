import {
  acceptConsents,
  fetchConsentDocuments,
} from '../src/features/consents/api';
import {
  deletePhoto,
  fetchMyPhotos,
  fetchPhotoUrls,
  uploadPhoto,
} from '../src/features/photos/api';
import {
  saveBasics,
  saveModes,
  savePrompts,
  submitProfile,
} from '../src/features/profileSetup/api';
import { supabase } from '../src/lib/supabase';
import { signInNewAccount } from './support/signIn';

// The smallest valid JPEG (1 x 1); Node's fetch reads data: URIs as the phone reads file:// ones.
const tinyJpeg =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

// Needs the media Edge Function (#35) served locally with R2 secrets in supabase/functions/.env.
// CI's stack runs without the edge runtime, so this file skips when the function doesn't answer.
async function mediaServed(): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('media', {
      body: { action: 'photo-urls', photoIds: [] },
    });
    return !error;
  } catch {
    return false;
  }
}

let served = false;
beforeAll(async () => {
  await signInNewAccount();
  await acceptConsents('1996-05-04', await fetchConsentDocuments());
  served = await mediaServed();
  if (!served) {
    console.warn(
      'media function not served locally; photo upload tests skipped',
    );
  }
});

test('upload, replace, link, delete and the photo minimum, through the media function', async () => {
  if (!served) {
    return;
  }
  const first = await uploadPhoto(1, tinyJpeg);
  expect(await fetchMyPhotos()).toEqual([{ id: first, position: 1 }]);
  const urls = await fetchPhotoUrls([first]);
  expect(urls[first]).toMatch(/^https?:\/\//);

  // Uploading to a taken position replaces that photo.
  const cover = await uploadPhoto(1, tinyJpeg);
  expect(await fetchMyPhotos()).toEqual([{ id: cover, position: 1 }]);

  // Deleting closes the gap, so the next photo becomes the cover.
  const second = await uploadPhoto(2, tinyJpeg);
  const third = await uploadPhoto(3, tinyJpeg);
  await deletePhoto(cover);
  expect(await fetchMyPhotos()).toEqual([
    { id: second, position: 1 },
    { id: third, position: 2 },
  ]);
  await expect(deletePhoto(cover)).rejects.toThrow(
    'That photo is already gone.',
  );

  // A Submitted Profile keeps at least 2 photos.
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { data: questions } = await supabase
    .from('prompt_questions')
    .select('id')
    .order('sort_order')
    .limit(2);
  await saveBasics(userId, { displayName: 'Asha' });
  await saveModes(userId, {
    modes: ['friends'],
    gender: null,
    prefGenders: [],
    prefAgeMin: null,
    prefAgeMax: null,
    prefMaxKm: null,
    profession: null,
    industryId: null,
    careerStage: null,
  });
  await savePrompts(
    userId,
    questions!.map((q, i) => ({
      position: (i + 1) as 1 | 2,
      questionId: q.id,
      answer: 'An answer',
    })),
  );
  await submitProfile();
  await expect(deletePhoto(second)).rejects.toThrow(
    'Your profile needs at least 2 photos. Add another before removing this one.',
  );
}, 60_000);

test('ids I may not see are left out of the links, never an error', async () => {
  if (!served) {
    return;
  }
  expect(
    await fetchPhotoUrls(['00000000-0000-0000-0000-000000000000']),
  ).toEqual({});
});

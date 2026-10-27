import {
  acceptConsents,
  fetchConsentDocuments,
} from '../src/features/consents/api';
import { fetchMyPhotos, movePhoto } from '../src/features/photos/api';
import {
  fetchDraft,
  saveBasics,
  saveInterests,
  saveModes,
  savePrompts,
  submitProfile,
} from '../src/features/profileSetup/api';
import type { ModeFields } from '../src/features/profileSetup/model';
import { fetchAccountStage } from '../src/features/account/api';
import { fetchIndustries } from '../src/features/catalog/api';
import { admin } from './support/admin';
import { signInNewAccount } from './support/signIn';

const friendsOnly: ModeFields = {
  modes: ['friends'],
  gender: null,
  prefGenders: [],
  prefAgeMin: null,
  prefAgeMax: null,
  prefMaxKm: null,
  profession: null,
  industryId: null,
  careerStage: null,
};

async function newAccountPastConsent(): Promise<string> {
  const userId = await signInNewAccount();
  await acceptConsents('1996-05-04', await fetchConsentDocuments());
  return userId;
}

// What the media function does once an upload lands in R2 (dev seed and tests only).
async function confirmedPhotos(userId: string, positions: number[]) {
  const { data, error } = await admin
    .from('photos')
    .insert(
      positions.map(position => ({
        user_id: userId,
        position,
        object_key: `${userId}/${position}-${Date.now()}.jpg`,
        uploaded_at: new Date().toISOString(),
      })),
    )
    .select('id, position');
  if (error) {
    throw error;
  }
  return data;
}

async function promptQuestionIds(): Promise<number[]> {
  const { data } = await admin
    .from('prompt_questions')
    .select('id')
    .order('sort_order')
    .limit(2);
  return data!.map(q => q.id);
}

test('setup offers the active catalogs in order', async () => {
  await newAccountPastConsent();
  expect((await fetchIndustries()).length).toBeGreaterThan(0);
});

test('a new account starts with an empty draft and its date of birth', async () => {
  const userId = await newAccountPastConsent();
  const draft = await fetchDraft(userId);
  expect(draft).toMatchObject({
    displayName: null,
    birthDate: '1996-05-04',
    modes: [],
    prompts: [],
    tagIds: [],
    availability: [],
    prefGenders: [],
  });
});

test('each step saves, and the draft reads it all back', async () => {
  const userId = await newAccountPastConsent();
  const [q1, q2] = await promptQuestionIds();
  const { data: tags } = await admin.from('tags').select('id').limit(2);
  const { data: industry } = await admin
    .from('industries')
    .select('id')
    .limit(1)
    .single();

  await saveBasics(userId, { displayName: '  Asha ' });
  await savePrompts(userId, [
    { position: 1, questionId: q1, answer: 'Chai and a trek' },
    { position: 2, questionId: q2, answer: 'Play badminton' },
  ]);
  // Answering again updates in place.
  await savePrompts(userId, [
    { position: 1, questionId: q1, answer: ' Misal and a trek ' },
    { position: 2, questionId: q2, answer: 'Play badminton' },
  ]);
  await saveModes(userId, {
    modes: ['friends', 'dating', 'networking'],
    gender: 'woman',
    prefGenders: ['man', 'nonbinary'],
    prefAgeMin: 25,
    prefAgeMax: 34,
    prefMaxKm: 15,
    profession: ' Designer ',
    industryId: industry!.id,
    careerStage: 'mid',
  });
  await saveInterests(userId, {
    tagIds: tags!.map(t => t.id),
    availability: ['weekends'],
  });
  await saveInterests(userId, {
    tagIds: [tags![1].id],
    availability: ['weekends', 'early_mornings'],
  });

  expect(await fetchDraft(userId)).toEqual({
    displayName: 'Asha',
    birthDate: '1996-05-04',
    prompts: [
      { position: 1, questionId: q1, answer: 'Misal and a trek' },
      { position: 2, questionId: q2, answer: 'Play badminton' },
    ],
    modes: ['friends', 'dating', 'networking'],
    gender: 'woman',
    prefGenders: ['man', 'nonbinary'],
    prefAgeMin: 25,
    prefAgeMax: 34,
    prefMaxKm: 15,
    profession: 'Designer',
    industryId: industry!.id,
    careerStage: 'mid',
    tagIds: [tags![1].id],
    availability: ['weekends', 'early_mornings'],
  });
});

test('submitting names the step that still needs work, in order, then makes a Member', async () => {
  const userId = await newAccountPastConsent();
  const [q1, q2] = await promptQuestionIds();

  await expect(submitProfile()).rejects.toMatchObject({
    message: 'Add your first name.',
    step: 'basics',
  });
  await saveBasics(userId, { displayName: 'Asha' });
  await expect(submitProfile()).rejects.toMatchObject({ step: 'modes' });
  await saveModes(userId, { ...friendsOnly, modes: ['casual'] });
  await expect(submitProfile()).rejects.toMatchObject({
    message: 'Add your gender to use Dating, Serious or Casual.',
    step: 'modes',
  });
  await saveModes(userId, {
    ...friendsOnly,
    modes: ['casual'],
    gender: 'man',
  });
  await expect(submitProfile()).rejects.toMatchObject({ step: 'modes' });
  await saveModes(userId, friendsOnly);
  await expect(submitProfile()).rejects.toMatchObject({
    message: 'Answer both prompts.',
    step: 'prompts',
  });
  await savePrompts(userId, [
    { position: 1, questionId: q1, answer: 'One' },
    { position: 2, questionId: q2, answer: 'Two' },
  ]);
  await expect(submitProfile()).rejects.toMatchObject({
    message: 'Add at least 2 photos.',
    step: 'photos',
  });
  await confirmedPhotos(userId, [1, 2]);

  await submitProfile();
  expect(await fetchAccountStage(userId)).toBe('member');
});

describe('my photos', () => {
  test('lists my photos in order, never another Member’s', async () => {
    const other = await newAccountPastConsent();
    await confirmedPhotos(other, [1]);
    const userId = await newAccountPastConsent();
    const [first, second] = await confirmedPhotos(userId, [2, 1]);
    expect(await fetchMyPhotos()).toEqual([
      { id: second.id, position: 1 },
      { id: first.id, position: 2 },
    ]);
  });

  test('moving swaps with the photo already there', async () => {
    const userId = await newAccountPastConsent();
    const [a, b, c] = await confirmedPhotos(userId, [1, 2, 3]);
    await movePhoto(c.id, 1);
    expect(await fetchMyPhotos()).toEqual([
      { id: c.id, position: 1 },
      { id: b.id, position: 2 },
      { id: a.id, position: 3 },
    ]);
    await movePhoto(b.id, 4);
    expect((await fetchMyPhotos()).map(p => p.position)).toEqual([1, 3, 4]);
  });

  test('with all 4 photos two can still swap, in one step', async () => {
    const userId = await newAccountPastConsent();
    const [a, b, c, d] = await confirmedPhotos(userId, [1, 2, 3, 4]);
    await movePhoto(d.id, 1);
    expect(await fetchMyPhotos()).toEqual([
      { id: d.id, position: 1 },
      { id: b.id, position: 2 },
      { id: c.id, position: 3 },
      { id: a.id, position: 4 },
    ]);
  });

  test('a photo that is hidden or taken down neither counts nor fills a slot', async () => {
    const userId = await newAccountPastConsent();
    const [a, b, c] = await confirmedPhotos(userId, [1, 2, 3]);
    await admin
      .from('photos')
      .update({ hidden_at: new Date().toISOString() })
      .eq('id', a.id);
    await admin
      .from('photos')
      .update({ removed_at: new Date().toISOString() })
      .eq('id', b.id);
    expect(await fetchMyPhotos()).toEqual([{ id: c.id, position: 3 }]);
  });

  test('moving someone else’s photo or outside 1 to 4 is refused', async () => {
    const other = await newAccountPastConsent();
    const [theirs] = await confirmedPhotos(other, [1]);
    const userId = await newAccountPastConsent();
    const [mine] = await confirmedPhotos(userId, [1]);
    await expect(movePhoto(theirs.id, 2)).rejects.toThrow(
      'That photo is already gone.',
    );
    await expect(movePhoto(mine.id, 5)).rejects.toThrow(
      'Photos go in places 1 to 4.',
    );
  });
});

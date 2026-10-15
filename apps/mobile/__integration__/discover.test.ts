import { signOut } from '../src/features/auth/api';
import { fetchPromptQuestions, fetchTags } from '../src/features/catalog/api';
import { blockMember } from '../src/features/chat/api';
import {
  fetchFeedPage,
  fetchMyDiscoverState,
  fetchProfile,
  unpause,
  type FeedCard,
} from '../src/features/discover/api';
import { admin } from './support/admin';
import { createMember, type TestMember } from './support/members';

let me: TestMember;
let ravi: TestMember;
let neha: TestMember;
let kabir: TestMember;
let tags: { badminton: number; trekking: number };

// Other visible Members (the founder, a dev partner) may share the local database, so
// assertions look for this file's own Members rather than the whole feed.
async function wholeFeed(mode: FeedCard['modes'][number] | null = null) {
  const cards: FeedCard[] = [];
  let cursor: string | null = null;
  do {
    const page = await fetchFeedPage({ mode, pageSize: 2, cursor });
    expect(page.cards.length).toBeLessThanOrEqual(2);
    cards.push(...page.cards);
    cursor = page.nextCursor;
  } while (cursor);
  return cards;
}

const ids = (cards: FeedCard[]) => cards.map(card => card.id);

beforeAll(async () => {
  me = await createMember('Asha', { app: true });
  ravi = await createMember('Ravi');
  neha = await createMember('Neha');
  kabir = await createMember('Kabir');
  // Ravi also holds Activities with me; Kabir holds only Networking, which I don't.
  await admin
    .from('profiles')
    .update({ modes: ['friends', 'activities'] })
    .in('id', [me.id, ravi.id]);
  await admin
    .from('profiles')
    .update({ modes: ['networking'] })
    .eq('id', kabir.id);
  const { data } = await admin
    .from('tags')
    .select('id, slug')
    .in('slug', ['badminton', 'trekking']);
  const bySlug = Object.fromEntries(data!.map(t => [t.slug, t.id]));
  tags = { badminton: bySlug.badminton, trekking: bySlug.trekking };
  await admin.from('profile_tags').insert([
    { user_id: me.id, tag_id: tags.badminton },
    { user_id: ravi.id, tag_id: tags.badminton },
    { user_id: ravi.id, tag_id: tags.trekking },
  ]);
});

afterAll(() => signOut());

test('the feed shows visible Members nearby, with why we match and shared tags', async () => {
  const feed = await wholeFeed();
  // No shared Mode needed (decision 42): Kabir appears too.
  expect(ids(feed)).toEqual(
    expect.arrayContaining([ravi.id, neha.id, kabir.id]),
  );
  expect(ids(feed)).not.toContain(me.id);
  expect(feed.find(card => card.id === ravi.id)).toMatchObject({
    name: 'Ravi',
    age: expect.any(Number),
    areaId: 'baner',
    modes: ['friends', 'activities'],
    sharedTagIds: [tags.badminton],
    whyYouMatch: expect.stringContaining('like badminton'),
  });
});

test('paging with the cursor returns each Member once', async () => {
  const feed = ids(await wholeFeed());
  expect(new Set(feed).size).toBe(feed.length);
});

test('filtering by a Mode shows only Members who share that Mode', async () => {
  const activities = ids(await wholeFeed('activities'));
  expect(activities).toContain(ravi.id);
  expect(activities).not.toContain(neha.id);
});

test('my own Modes and pause state come from my profile', async () => {
  expect(await fetchMyDiscoverState(me.id)).toEqual({
    modes: ['friends', 'activities'],
    paused: false,
  });
});

test('a Paused Member gets an empty feed until they unpause', async () => {
  await admin
    .from('profiles')
    .update({ paused_at: new Date().toISOString() })
    .eq('id', me.id);
  expect((await fetchMyDiscoverState(me.id)).paused).toBe(true);
  expect((await fetchFeedPage({ mode: null })).cards).toEqual([]);

  await unpause();
  expect((await fetchMyDiscoverState(me.id)).paused).toBe(false);
  expect(ids(await wholeFeed())).toContain(ravi.id);
});

test('the profile view has the shared Modes, prompts and all their tags', async () => {
  const profile = await fetchProfile(ravi.id);
  expect(profile).toMatchObject({
    id: ravi.id,
    name: 'Ravi',
    age: expect.any(Number),
    areaId: 'baner',
    modes: ['friends', 'activities'],
    whyYouMatch: expect.stringContaining('You both'),
    tagIds: [tags.badminton, tags.trekking],
  });
  expect(profile!.photoIds).toHaveLength(2);
  expect(profile!.prompts).toEqual([
    { position: 1, questionId: expect.any(Number), answer: 'An answer' },
    { position: 2, questionId: expect.any(Number), answer: 'An answer' },
  ]);
});

test('tag and prompt names come from the catalog', async () => {
  const tagList = await fetchTags();
  expect(tagList.find(tag => tag.id === tags.badminton)?.label).toBe(
    'Badminton',
  );
  const questions = Object.fromEntries(
    (await fetchPromptQuestions()).map(q => [q.id, q.label]),
  );
  const profile = await fetchProfile(ravi.id);
  // createMember answers the first two questions in whatever order the catalog returns.
  expect(
    profile!.prompts.map(prompt => questions[prompt.questionId]).sort(),
  ).toEqual(['A perfect Sunday in Pune is…', "I'm looking for people to…"]);
});

test('a profile without a shared Mode still opens, naming their Mode', async () => {
  expect(await fetchProfile(kabir.id)).toMatchObject({
    modes: [],
    whyYouMatch: "Less than 2 km away. They're here for Networking.",
  });
});

test('after blocking, the Member leaves the feed and their profile closes', async () => {
  await blockMember(neha.id);
  expect(ids(await wholeFeed())).not.toContain(neha.id);
  expect(await fetchProfile(neha.id)).toBeNull();
});

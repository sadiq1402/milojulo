import {
  fetchPendingFeedback,
  hasAnswered,
  submitMeetFeedback,
} from '../src/features/meetFeedback/api';
import { connect, createMember, type TestMember } from './support/members';

// These run against local Supabase and only pass once #19's migration is applied
// (`meetup_feedback`, `submit_meetup_feedback`, `pending_meetup_feedback`). Written against the
// agreed contract. Shared database: never `db reset`; run through the integration lock.

let asha: TestMember;
let isha: TestMember;

beforeAll(async () => {
  // The app's own client is signed in as Asha for the whole file.
  asha = await createMember('Asha', { app: true });
  isha = await createMember('Isha');
});

test('without a Connection there is no one to answer about', async () => {
  await expect(
    submitMeetFeedback({ otherUserId: isha.id, didMeet: true, keep: true }),
  ).rejects.toThrow("You can't answer about this person any more.");
  await expect(hasAnswered(isha.id)).resolves.toBe(false);
});

test('after an accepted Connection, "We met" is answered once', async () => {
  await connect(asha, isha);
  await submitMeetFeedback({ otherUserId: isha.id, didMeet: true, keep: true });
  await expect(hasAnswered(isha.id)).resolves.toBe(true);
  await expect(
    submitMeetFeedback({ otherUserId: isha.id, didMeet: false, keep: false }),
  ).rejects.toThrow("You've already answered about this one.");
});

test('a new Member has no Activity to answer about', async () => {
  await expect(fetchPendingFeedback()).resolves.toEqual([]);
});

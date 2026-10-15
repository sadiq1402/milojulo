import {
  fetchPendingFeedback,
  hasAnswered,
  submitMeetFeedback,
} from '../src/features/meetFeedback/api';
import { supabase } from '../src/lib/supabase';

// jest.setup.js stands Supabase in with an empty object; give it an rpc that answers like the
// database would, so the copy for each of its exact refusal messages is pinned here.
const rpc = jest.fn();
(supabase as unknown as { rpc: jest.Mock }).rpc = rpc;

describe('submitMeetFeedback', () => {
  test('sends both answers about an Activity', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await submitMeetFeedback({
      otherUserId: 'isha',
      activityId: 'badminton',
      didMeet: true,
      keep: false,
    });
    expect(rpc).toHaveBeenCalledWith('submit_meetup_feedback', {
      other_user: 'isha',
      activity: 'badminton',
      did_meet: true,
      keep: false,
    });
  });

  test('a chat answer leaves the Activity out', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await submitMeetFeedback({
      otherUserId: 'isha',
      didMeet: false,
      keep: true,
    });
    expect(rpc).toHaveBeenCalledWith('submit_meetup_feedback', {
      other_user: 'isha',
      did_meet: false,
      keep: true,
    });
  });

  test.each([
    [
      'no one to give feedback about',
      "You can't answer about this person any more.",
    ],
    ['you already answered', "You've already answered about this one."],
    [
      'something else',
      "That didn't work. Check your connection and try again.",
    ],
  ])('refusal %p reads as friendly copy', async (message, copy) => {
    rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(
      submitMeetFeedback({ otherUserId: 'isha', didMeet: true, keep: true }),
    ).rejects.toThrow(copy);
  });
});

// A stand-in query builder: records each filter and answers with the given rows.
function ownRows(rows: unknown[] | null, error: unknown = null) {
  const filters: unknown[][] = [];
  const builder: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'is', 'limit']) {
    builder[name] = (...args: unknown[]) => {
      filters.push([name, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => void) =>
    resolve({ data: rows, error });
  (supabase as unknown as { from: jest.Mock }).from = jest.fn(table => {
    filters.push(['from', table]);
    return builder;
  });
  return filters;
}

describe('hasAnswered', () => {
  test('a chat answer is one about the pair with no Activity', async () => {
    const filters = ownRows([{ id: 'f1' }]);
    await expect(hasAnswered('isha')).resolves.toBe(true);
    expect(filters).toContainEqual(['from', 'meetup_feedback']);
    expect(filters).toContainEqual(['eq', 'other_user_id', 'isha']);
    expect(filters).toContainEqual(['is', 'activity_id', null]);
  });

  test('an Activity answer is one about the pair and that Activity', async () => {
    const filters = ownRows([]);
    await expect(hasAnswered('isha', 'badminton')).resolves.toBe(false);
    expect(filters).toContainEqual(['eq', 'activity_id', 'badminton']);
  });

  test('a failed load says so', async () => {
    ownRows(null, { message: 'boom' });
    await expect(hasAnswered('isha')).rejects.toThrow(
      "We couldn't load this. Check your connection and try again.",
    );
  });
});

describe('fetchPendingFeedback', () => {
  test('maps each pair waiting for an answer', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          other_user_id: 'isha',
          display_name: 'Isha',
          cover_photo_id: 'p1',
          activity_id: 'badminton',
          activity_title: 'Badminton doubles',
          ends_at: '2026-10-14T16:30:00Z',
        },
      ],
      error: null,
    });
    await expect(fetchPendingFeedback()).resolves.toEqual([
      {
        otherUserId: 'isha',
        otherName: 'Isha',
        coverPhotoId: 'p1',
        activityId: 'badminton',
        activityTitle: 'Badminton doubles',
        endsAt: '2026-10-14T16:30:00Z',
      },
    ]);
    expect(rpc).toHaveBeenCalledWith('pending_meetup_feedback');
  });

  test('a failed load says so', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchPendingFeedback()).rejects.toThrow(
      "We couldn't load this. Check your connection and try again.",
    );
  });
});

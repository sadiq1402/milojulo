import {
  askToJoin,
  fetchActivity,
  respondJoinRequest,
  withdrawJoinRequest,
} from '../src/features/activities/api';
import { supabase } from '../src/lib/supabase';

// jest.setup.js stands Supabase in with an empty object; give it an rpc that answers like the
// database would, so the copy for each of its exact refusal messages is pinned here.
const rpc = jest.fn();
(supabase as unknown as { rpc: jest.Mock }).rpc = rpc;

const refuse = (message: string) =>
  rpc.mockResolvedValue({ data: null, error: { message } });

test.each([
  [
    'unpause your profile to join activities',
    'Your profile is paused. Unpause it to join Activities.',
  ],
  [
    'your profile is not visible',
    "Your profile isn't visible right now, so you can't join Activities.",
  ],
  ['no activity to join', "This Activity isn't open to join any more."],
  ['you cannot join your own activity', "You're hosting this Activity."],
  ['this activity has already started', 'This Activity has already started.'],
  [
    'you already asked to join this activity',
    "You've already asked to join this Activity.",
  ],
  ['no spots left', 'There are no spots left on this Activity.'],
  [
    'you have sent 10 join requests in the last 24 hours',
    "You've sent 10 join requests in the last 24 hours, the most allowed. Try again later.",
  ],
  ['something else', "That didn't work. Check your connection and try again."],
])('asking to join refused with "%s" reads "%s"', async (message, copy) => {
  refuse(message);
  await expect(askToJoin('a1')).rejects.toThrow(copy);
  expect(rpc).toHaveBeenCalledWith('join_activity_request', {
    activity_id: 'a1',
  });
});

test.each([
  [
    'no join request to answer',
    'This join request is no longer waiting for an answer.',
  ],
  ['no spots left', 'There are no spots left on this Activity.'],
])('answering refused with "%s" reads "%s"', async (message, copy) => {
  refuse(message);
  await expect(respondJoinRequest('r1', true)).rejects.toThrow(copy);
});

test('withdrawing refused reads as too late to change', async () => {
  refuse('no join request to withdraw');
  await expect(withdrawJoinRequest('r1')).rejects.toThrow(
    "This join request can't be cancelled or withdrawn any more.",
  );
  expect(rpc).toHaveBeenCalledWith('withdraw_activity_request', {
    request_id: 'r1',
  });
});

test('accepting returns the Activity Connection; declining returns null', async () => {
  rpc.mockResolvedValue({ data: 'conn-1', error: null });
  await expect(respondJoinRequest('r1', true)).resolves.toBe('conn-1');
  expect(rpc).toHaveBeenCalledWith('respond_activity_request', {
    request_id: 'r1',
    accept: true,
  });
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(respondJoinRequest('r1', false)).resolves.toBeNull();
});

test('the detail carries my request and the Activity Connection, or null when I never asked', async () => {
  const row = {
    id: 'a1',
    host_id: 'h',
    host_name: 'Isha',
    title: 'Badminton',
    type: 'sports',
    area_id: 'baner',
    starts_at: '2027-01-15T13:30:00Z',
    ends_at: null,
    capacity: 4,
    spots_left: 3,
    description: null,
    starts_when: 'later',
    is_mine: false,
    status: 'open',
    venue_detail: 'Court 2',
    is_locked: true,
  };
  rpc.mockResolvedValue({
    data: [
      {
        ...row,
        my_request_id: 'r1',
        my_request_status: 'accepted',
        connection_id: 'conn-1',
      },
    ],
    error: null,
  });
  expect(await fetchActivity('a1')).toMatchObject({
    myRequest: { id: 'r1', status: 'accepted' },
    connectionId: 'conn-1',
    venueDetail: 'Court 2',
  });
  rpc.mockResolvedValue({
    data: [
      {
        ...row,
        my_request_id: null,
        my_request_status: null,
        connection_id: null,
      },
    ],
    error: null,
  });
  expect(await fetchActivity('a1')).toMatchObject({
    myRequest: null,
    connectionId: null,
  });
});

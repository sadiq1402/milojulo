import {
  fetchCircle,
  fetchCircleActivities,
  fetchCircleMembers,
  fetchCircles,
  joinCircle,
  leaveCircle,
} from '../src/features/circles/api';
import { postActivity } from '../src/features/activities/api';
import { supabase } from '../src/lib/supabase';

// jest.setup.js stands Supabase in with an empty object; give it an rpc that answers like the
// database would, so the copy for each of its exact refusal messages is pinned here.
const rpc = jest.fn();
(supabase as unknown as { rpc: jest.Mock }).rpc = rpc;

const refuse = (message: string) =>
  rpc.mockResolvedValue({ data: null, error: { message } });

const circleRow = {
  circle_id: 'c1',
  name: 'Weekend Trekkers',
  area_id: 'baner',
  tag_id: 7,
  description: 'Sunday treks.',
  member_count: 4,
  i_am_member: true,
};

test('browse maps the circle rows and keeps the database order', async () => {
  rpc.mockResolvedValue({ data: [circleRow], error: null });
  const circles = await fetchCircles();
  expect(rpc).toHaveBeenCalledWith('browse_circles');
  expect(circles[0]).toEqual({
    id: 'c1',
    name: 'Weekend Trekkers',
    areaId: 'baner',
    tagId: 7,
    description: 'Sunday treks.',
    memberCount: 4,
    iAmMember: true,
  });
});

test('fetching one Circle returns null when the row is absent', async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  expect(await fetchCircle('c1')).toBeNull();
  expect(rpc).toHaveBeenCalledWith('get_circle', { circle_id: 'c1' });
});

test('members map to profile rows', async () => {
  rpc.mockResolvedValue({
    data: [
      {
        member_id: 'm1',
        display_name: 'Kabir',
        cover_photo_id: null,
        area_id: 'wakad',
      },
    ],
    error: null,
  });
  const members = await fetchCircleMembers('c1');
  expect(rpc).toHaveBeenCalledWith('circle_members_of', { circle_id: 'c1' });
  expect(members[0]).toEqual({
    id: 'm1',
    name: 'Kabir',
    coverPhotoId: null,
    areaId: 'wakad',
  });
});

test('Circle Activities carry the Circle label from the board shape', async () => {
  rpc.mockResolvedValue({
    data: [
      {
        id: 'a1',
        host_id: 'h',
        host_name: 'Kabir',
        title: 'Sinhagad trek',
        type: 'outdoors',
        area_id: 'baner',
        starts_at: '2027-01-15T00:00:00Z',
        ends_at: null,
        capacity: 6,
        spots_left: 5,
        description: null,
        starts_when: 'later',
        is_mine: false,
        circle_id: 'c1',
        circle_name: 'Weekend Trekkers',
      },
    ],
    error: null,
  });
  const activities = await fetchCircleActivities('c1');
  expect(rpc).toHaveBeenCalledWith('circle_activities', { circle_id: 'c1' });
  expect(activities[0]).toMatchObject({
    id: 'a1',
    circleId: 'c1',
    circleName: 'Weekend Trekkers',
  });
});

test.each([
  [
    'your profile is not visible',
    "Your profile isn't visible right now, so you can't join Circles.",
  ],
  ['no circle to join', "This Circle isn't available any more."],
  ['something else', "That didn't work. Check your connection and try again."],
])('joining refused with "%s" reads "%s"', async (message, copy) => {
  refuse(message);
  await expect(joinCircle('c1')).rejects.toThrow(copy);
  expect(rpc).toHaveBeenCalledWith('join_circle', { circle_id: 'c1' });
});

test('joining an already-joined Circle resolves', async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(joinCircle('c1')).resolves.toBeUndefined();
});

test.each([
  ['you are not in this circle', "You're not a member of this Circle."],
  ['something else', "That didn't work. Check your connection and try again."],
])('leaving refused with "%s" reads "%s"', async (message, copy) => {
  refuse(message);
  await expect(leaveCircle('c1')).rejects.toThrow(copy);
  expect(rpc).toHaveBeenCalledWith('leave_circle', { circle_id: 'c1' });
});

test('posting to a Circle sends its id and words the not-a-member refusal', async () => {
  rpc.mockResolvedValue({ data: 'a1', error: null });
  await postActivity({
    title: 'Sinhagad trek',
    type: 'outdoors',
    areaId: 'baner',
    startsAt: '2027-01-15T00:00:00Z',
    endsAt: null,
    capacity: 6,
    description: '',
    venueDetail: '',
    circleId: 'c1',
  });
  expect(rpc).toHaveBeenCalledWith(
    'post_activity',
    expect.objectContaining({ circle_id: 'c1' }),
  );

  refuse('join the circle to post to it');
  await expect(
    postActivity({
      title: 'Sinhagad trek',
      type: 'outdoors',
      areaId: 'baner',
      startsAt: '2027-01-15T00:00:00Z',
      endsAt: null,
      capacity: 6,
      description: '',
      venueDetail: '',
      circleId: 'c1',
    }),
  ).rejects.toThrow('Join this Circle before posting an Activity to it.');
});

test('a title or description the word filter refuses reads as friendly copy', async () => {
  refuse("that wording isn't allowed; please change it");
  await expect(
    postActivity({
      title: 'x',
      type: 'outdoors',
      areaId: 'baner',
      startsAt: '2027-01-15T00:00:00Z',
      endsAt: null,
      capacity: 6,
      description: '',
      venueDetail: '',
      circleId: null,
    }),
  ).rejects.toThrow(
    "Some of that wording isn't allowed on MiloJulo. Please change it.",
  );
});

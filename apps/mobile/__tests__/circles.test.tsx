import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import type { BoardActivity } from '../src/features/activities/model';
import * as catalog from '../src/features/catalog/api';
import * as chat from '../src/features/chat/api';
import * as circles from '../src/features/circles/api';
import type { Circle, CircleMember } from '../src/features/circles/model';
import * as discover from '../src/features/discover/api';
import * as location from '../src/features/location/api';
import * as device from '../src/features/location/device';
import { numbered } from '../test/catalog';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/activities/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/circles/api');
jest.mock('../src/features/discover/api');
jest.mock('../src/features/location/api');

const me = sessionFor('asha@example.com');

const circle = (overrides: Partial<Circle> = {}): Circle => ({
  id: 'trekkers',
  name: 'Weekend Trekkers',
  placeName: 'Baner, Pune',
  distanceBand: '~3 km',
  tagId: 1,
  description: 'Sunday treks around the city.',
  memberCount: 4,
  iAmMember: false,
  ...overrides,
});

const badminton = circle({
  id: 'badminton',
  name: 'Baner Badminton',
  tagId: 2,
  description: 'Weekly doubles, all levels.',
  memberCount: 12,
  iAmMember: true,
  distanceBand: null,
});

const circleActivity: BoardActivity = {
  id: 'trek-1',
  hostId: 'kabir',
  hostName: 'Kabir',
  title: 'Sinhagad sunrise trek',
  type: 'outdoors',
  distanceBand: '~4 km',
  startsAt: '2027-01-15T00:00:00Z',
  endsAt: null,
  capacity: 6,
  spotsLeft: 5,
  description: null,
  startsWhen: 'later',
  isMine: false,
  circleId: 'trekkers',
  circleName: 'Weekend Trekkers',
  hostPhotoId: null,
};

const members: CircleMember[] = [
  { id: 'kabir', name: 'Kabir', coverPhotoId: null },
  { id: 'meera', name: 'Meera', coverPhotoId: null },
];

beforeEach(() => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest
    .mocked(catalog.fetchTags)
    .mockResolvedValue(numbered({ 1: 'Trekking', 2: 'Badminton' }));
  jest.mocked(catalog.fetchPromptQuestions).mockResolvedValue(numbered({}));
  jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
    modes: ['friends'],
    paused: false,
    rangeKm: 10,
    hasLocation: true,
  });
  jest
    .mocked(discover.fetchFeedPage)
    .mockResolvedValue({ cards: [], nextCursor: null });
  jest.mocked(chat.fetchConversations).mockResolvedValue([]);
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
  // Posting navigates to the new Activity; a null keeps that screen quiet in the test.
  jest.mocked(activities.postActivity).mockResolvedValue('new-activity');
  jest.mocked(activities.fetchActivity).mockResolvedValue(null);
  jest.mocked(circles.fetchCircles).mockResolvedValue([badminton, circle()]);
  jest
    .mocked(circles.fetchCircle)
    .mockImplementation(async id =>
      id === badminton.id ? badminton : circle(),
    );
  jest.mocked(circles.fetchCircleMembers).mockResolvedValue(members);
  jest.mocked(circles.fetchCircleActivities).mockResolvedValue([]);
  jest.mocked(circles.joinCircle).mockResolvedValue();
  jest.mocked(circles.leaveCircle).mockResolvedValue();
});

const cardFor = (name: string) =>
  screen.findByRole('button', { name: new RegExp(`^${name}, `) });

async function openCircles() {
  await renderApp(me);
  await fireEvent.press(await screen.findByRole('tab', { name: 'Circles' }));
}

async function openDetail(name: string) {
  await openCircles();
  await fireEvent.press(await cardFor(name));
  await screen.findByRole('header', { name });
}

describe('the Circles list', () => {
  test('shows each Circle with its place, distance, interest and member count', async () => {
    await openCircles();
    const card = within(await cardFor('Weekend Trekkers'));
    expect(card.getByText('Sunday treks around the city.')).toBeOnTheScreen();
    expect(card.getByText('Baner, Pune')).toBeOnTheScreen();
    expect(card.getByText('~3 km')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: /^Weekend Trekkers, Baner, Pune, ~3 km, /,
      }),
    ).toBeOnTheScreen();
    expect(card.getByText('Trekking')).toBeOnTheScreen();
    expect(card.getByText('4 members')).toBeOnTheScreen();
    const joined = within(await cardFor('Baner Badminton'));
    expect(joined.getByText('Joined')).toBeOnTheScreen();
    expect(joined.getByText('12 members')).toBeOnTheScreen();
    expect(joined.queryByText(/km/)).toBeNull();
  });

  test('says each Circle gathers people near one place', async () => {
    await openCircles();
    expect(
      await screen.findByText(
        /^Each Circle gathers people near one place around one interest\./,
      ),
    ).toBeOnTheScreen();
  });

  test('with no Circles, says so', async () => {
    jest.mocked(circles.fetchCircles).mockResolvedValue([]);
    await openCircles();
    expect(await screen.findByText('No Circles yet')).toBeOnTheScreen();
  });

  test('a Paused Member is told Circles are hidden and can unpause', async () => {
    jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
      modes: ['friends'],
      paused: true,
      rangeKm: 10,
      hasLocation: true,
    });
    jest.mocked(circles.fetchCircles).mockResolvedValue([]);
    await openCircles();
    expect(await screen.findByText('Your profile is paused')).toBeOnTheScreen();
    expect(screen.queryByText('No Circles yet')).not.toBeOnTheScreen();
  });

  test('a failed load offers a retry', async () => {
    jest
      .mocked(circles.fetchCircles)
      .mockRejectedValueOnce(new Error(circles.couldNotLoad));
    await openCircles();
    expect(await screen.findByText(circles.couldNotLoad)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await cardFor('Weekend Trekkers')).toBeOnTheScreen();
  });
});

describe('a Circle I have not joined', () => {
  test('offers Join and hides the members list', async () => {
    await openDetail('Weekend Trekkers');
    expect(screen.getByText('Baner, Pune')).toBeOnTheScreen();
    expect(screen.getByText('~3 km')).toBeOnTheScreen();
    expect(screen.getByText('Trekking')).toBeOnTheScreen();
    expect(screen.getByText('Sunday treks around the city.')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Join Circle' }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('circle-members')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Post an activity/ }),
    ).toBeNull();
  });

  test('joining shows the members and the Post button', async () => {
    jest.mocked(circles.joinCircle).mockImplementation(async () => {
      jest
        .mocked(circles.fetchCircle)
        .mockResolvedValue(circle({ iAmMember: true, memberCount: 5 }));
    });
    await openDetail('Weekend Trekkers');
    await fireEvent.press(screen.getByRole('button', { name: 'Join Circle' }));
    expect(circles.joinCircle).toHaveBeenCalledWith('trekkers');
    expect(await screen.findByTestId('circle-members')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Post an activity to this circle' }),
    ).toBeOnTheScreen();
  });

  test('a refused join says why in friendly words', async () => {
    jest
      .mocked(circles.joinCircle)
      .mockRejectedValue(new Error("This Circle isn't available any more."));
    await openDetail('Weekend Trekkers');
    await fireEvent.press(screen.getByRole('button', { name: 'Join Circle' }));
    expect(
      await screen.findByText("This Circle isn't available any more."),
    ).toBeOnTheScreen();
  });
});

describe('a Circle I belong to', () => {
  test('lists members, upcoming Activities, and opens a member profile', async () => {
    jest
      .mocked(circles.fetchCircleActivities)
      .mockResolvedValue([circleActivity]);
    await openDetail('Baner Badminton');
    const list = within(await screen.findByTestId('circle-members'));
    expect(list.getByText('Kabir')).toBeOnTheScreen();
    expect(list.getByText('Meera')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('circle-activities')).getByText(
        'Sinhagad sunrise trek',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(
      list.getByRole('button', { name: 'Kabir, see their profile' }),
    );
    expect(discover.fetchProfile).toHaveBeenCalledWith('kabir');
  });

  test('posting pre-selects the Circle and refreshes its Coming up list', async () => {
    await openDetail('Baner Badminton');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Post an activity to this circle' }),
    );
    expect(
      await screen.findByText(/Posting to Baner Badminton/),
    ).toBeOnTheScreen();
    await fireEvent.changeText(
      screen.getByLabelText('The plan'),
      'Evening doubles',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Sports' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tomorrow' }));
    // The detail stays mounted under the form; its Activities should reload after posting.
    jest.mocked(circles.fetchCircleActivities).mockClear();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Post Activity' }),
    );
    expect(activities.postActivity).toHaveBeenCalledWith(
      expect.objectContaining({ circleId: 'badminton' }),
    );
    await waitFor(() =>
      expect(circles.fetchCircleActivities).toHaveBeenCalledWith('badminton'),
    );
  });

  test('leaving asks first', async () => {
    await openDetail('Baner Badminton');
    await fireEvent.press(screen.getByRole('button', { name: 'Leave Circle' }));
    const sheet = within(await screen.findByTestId('confirm-leave'));
    expect(sheet.getByText('Leave Baner Badminton?')).toBeOnTheScreen();
    expect(circles.leaveCircle).not.toHaveBeenCalled();
    await fireEvent.press(sheet.getByRole('button', { name: 'Yes, leave' }));
    expect(circles.leaveCircle).toHaveBeenCalledWith('badminton');
  });
});

describe('the Circle label on an Activity card', () => {
  test('shows the Circle name, and drops it when the Circle is archived', async () => {
    jest.mocked(circles.fetchCircleActivities).mockResolvedValue([
      circleActivity,
      {
        ...circleActivity,
        id: 'trek-2',
        title: 'Old trek',
        circleName: null,
      },
    ]);
    await openDetail('Baner Badminton');
    const labelled = within(await cardFor('Sinhagad sunrise trek'));
    expect(labelled.getByText('Weekend Trekkers')).toBeOnTheScreen();
    const archived = within(await cardFor('Old trek'));
    expect(archived.queryByText('Weekend Trekkers')).toBeNull();
  });
});

describe('without a fresh location', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    // Location was put off in the prompt, so the gate lets the Member through.
    await AsyncStorage.setItem(
      `location_prompt:${me.user.id}`,
      JSON.stringify({ answer: 'notNow', notNowCount: 2, offShown: true }),
    );
    let permission = false;
    jest
      .spyOn(device, 'hasPermission')
      .mockImplementation(async () => permission);
    jest.spyOn(device, 'requestPermission').mockImplementation(async () => {
      permission = true;
      return true;
    });
    jest
      .spyOn(device, 'currentPosition')
      .mockResolvedValue({ lat: 18.56, lng: 73.78 });
    jest.mocked(location.setLocation).mockResolvedValue();
    jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
      modes: ['friends'],
      paused: false,
      rangeKm: 10,
      hasLocation: false,
    });
    jest.mocked(circles.fetchCircles).mockResolvedValue([badminton]);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.clear();
  });

  test('asks for my location above the Circles I joined', async () => {
    await openCircles();
    expect(
      await screen.findByRole('header', { name: 'Circles need your location' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'MiloJulo shows Circles within the distance you choose, measured from where you are.',
      ),
    ).toBeOnTheScreen();
    expect(await cardFor('Baner Badminton')).toBeOnTheScreen();
    expect(screen.queryByText('No Circles yet')).toBeNull();
  });

  test('with nothing joined, shows the location block alone', async () => {
    jest.mocked(circles.fetchCircles).mockResolvedValue([]);
    await openCircles();
    expect(
      await screen.findByRole('header', { name: 'Circles need your location' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('No Circles yet')).toBeNull();
  });

  test('Turn on location sends my location and reloads the Circles', async () => {
    await openCircles();
    await cardFor('Baner Badminton');
    jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
      modes: ['friends'],
      paused: false,
      rangeKm: 10,
      hasLocation: true,
    });
    jest.mocked(circles.fetchCircles).mockResolvedValue([badminton, circle()]);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Turn on location' }),
    );
    expect(location.setLocation).toHaveBeenCalledWith(18.56, 73.78);
    expect(await cardFor('Weekend Trekkers')).toBeOnTheScreen();
    expect(screen.queryByText('Circles need your location')).toBeNull();
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { Linking, ScrollView } from 'react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import {
  ActivityError,
  type Activity,
  type BoardListing,
  type JoinRequest,
} from '../src/features/activities/model';
import {
  addDays,
  defaultStart,
  indiaInstant,
  indiaParts,
} from '../src/features/activities/time';
import * as catalog from '../src/features/catalog/api';
import * as chat from '../src/features/chat/api';
import * as discover from '../src/features/discover/api';
import * as location from '../src/features/location/api';
import * as device from '../src/features/location/device';
import * as photos from '../src/features/photos/api';
import * as profileSetup from '../src/features/profileSetup/api';
import { emptyDraft } from '../test/profileSetup';
import * as reports from '../src/features/reports/api';
import { numbered } from '../test/catalog';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/activities/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/discover/api');
jest.mock('../src/features/location/api');
jest.mock('../src/features/photos/api');
jest.mock('../src/features/profileSetup/api');
// Keep the real reason list; only the call to the database is stood in.
jest.mock('../src/features/reports/api', () => ({
  ...jest.requireActual('../src/features/reports/api'),
  reportContent: jest.fn(),
}));

// Only the clock is frozen (a Wednesday, 10:00 in India), so "today at 23:00" is always still ahead;
// real timers keep React Query and the screens running as usual.
jest.useFakeTimers({
  now: new Date('2026-10-14T04:30:00Z'),
  doNotFake: [
    'hrtime',
    'nextTick',
    'performance',
    'queueMicrotask',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback',
    'cancelIdleCallback',
    'setImmediate',
    'clearImmediate',
    'setInterval',
    'clearInterval',
    'setTimeout',
    'clearTimeout',
  ],
});
afterAll(() => jest.useRealTimers());

const me = sessionFor('asha@example.com');

// Times ahead of the frozen clock; the board's grouping comes from starts_when.
const inDays = (days: number, hourIndia: number) =>
  indiaInstant(addDays(indiaParts(new Date()).dateKey, days), hourIndia * 60);

const boardActivity = (overrides: Partial<BoardListing>): BoardListing => ({
  id: 'badminton',
  hostId: 'isha',
  hostName: 'Isha',
  title: 'Badminton doubles',
  type: 'sports',
  distanceBand: '<2 km',
  startsAt: inDays(0, 23),
  endsAt: null,
  capacity: 4,
  spotsLeft: 2,
  description: 'Casual doubles, all levels welcome.',
  startsWhen: 'tonight',
  isMine: false,
  circleId: null,
  circleName: null,
  hostPhotoId: null,
  visibleUntil: inDays(1, 2),
  ...overrides,
});

const badminton = boardActivity({});
const chai = boardActivity({
  id: 'chai',
  hostId: 'rohan',
  hostName: 'Rohan',
  title: 'Chai and board games',
  type: 'food_chai',
  distanceBand: '~3 km',
  startsAt: inDays(3, 17),
  spotsLeft: 1,
  startsWhen: 'this_weekend',
});
const trek = boardActivity({
  id: 'trek',
  hostId: me.user.id,
  hostName: 'Asha',
  title: 'Sinhagad trek',
  type: 'outdoors',
  distanceBand: '~5 km',
  startsAt: inDays(6, 6),
  spotsLeft: 0,
  startsWhen: 'later',
  isMine: true,
});

const detail = (overrides: Partial<Activity> = {}): Activity => ({
  ...badminton,
  status: 'open',
  venueDetail: null,
  isLocked: false,
  myRequest: null,
  connectionId: null,
  ...overrides,
});

const myActivity = detail({
  ...trek,
  endsAt: inDays(6, 10),
  description: 'Meet at the base village.',
  venueDetail: 'Sinhagad base, near the parking',
});

beforeEach(() => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(profileSetup.fetchDraft).mockResolvedValue(emptyDraft);
  jest.mocked(catalog.fetchTags).mockResolvedValue(numbered({}));
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
  jest.mocked(activities.fetchBoard).mockResolvedValue([trek, chai, badminton]);
  jest
    .mocked(activities.fetchActivity)
    .mockImplementation(async activityId =>
      activityId === trek.id ? myActivity : detail(),
    );
  jest.mocked(activities.postActivity).mockResolvedValue('new-activity');
  jest.mocked(activities.updateActivity).mockResolvedValue();
  jest.mocked(activities.cancelActivity).mockResolvedValue();
  jest.mocked(activities.fetchJoinRequests).mockResolvedValue([]);
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
  jest.mocked(activities.fetchJoined).mockResolvedValue([]);
});

const cardFor = (title: string) =>
  screen.findByRole('button', { name: new RegExp(`^${title}, `) });

async function openBoard() {
  await renderApp(me);
  await fireEvent.press(await screen.findByRole('tab', { name: 'Activities' }));
}

async function openDetail(title: string) {
  await openBoard();
  await fireEvent.press(await cardFor(title));
  await screen.findByRole('header', { name: title });
}

async function openCreate() {
  await openBoard();
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Post an Activity' }),
  );
  await screen.findByRole('header', { name: 'Post an Activity' });
}

describe('the Activity Board', () => {
  test('groups Activities into Tonight, This weekend and Later', async () => {
    await openBoard();
    await cardFor('Badminton doubles');
    const headings = screen
      .getAllByRole('header')
      .map(h => h.props.children)
      .filter(text => ['Tonight', 'This weekend', 'Later'].includes(text));
    expect(headings).toEqual(['Tonight', 'This weekend', 'Later']);
    const order = screen
      .getAllByRole('button', { name: /, hosted by / })
      .map(card => card.props.accessibilityLabel.split(',')[0]);
    expect(order).toEqual([
      'Badminton doubles',
      'Chai and board games',
      'Sinhagad trek',
    ]);
  });

  test('within a day, keeps the nearest-first order the server sends', async () => {
    const later = boardActivity({
      id: 'near',
      title: 'Nearby chess',
      distanceBand: '<2 km',
      startsAt: inDays(0, 23.5),
    });
    const sooner = boardActivity({
      id: 'far',
      title: 'Far football',
      distanceBand: '~8 km',
      startsAt: inDays(0, 22),
    });
    jest.mocked(activities.fetchBoard).mockResolvedValue([later, sooner]);
    await openBoard();
    await cardFor('Nearby chess');
    const order = screen
      .getAllByRole('button', { name: /, hosted by / })
      .map(card => card.props.accessibilityLabel.split(',')[0]);
    expect(order).toEqual(['Nearby chess', 'Far football']);
  });

  test('each card shows the type, title, distance, time, host first name and spots left', async () => {
    await openBoard();
    const card = within(await cardFor('Badminton doubles'));
    expect(card.getByText('Sports')).toBeOnTheScreen();
    expect(card.getByText('Badminton doubles')).toBeOnTheScreen();
    expect(card.getByText('<2 km')).toBeOnTheScreen();
    expect(card.getByText('Today, 11:00 pm')).toBeOnTheScreen();
    expect(card.getByText('Hosted by Isha')).toBeOnTheScreen();
    expect(card.getByText('2 spots left')).toBeOnTheScreen();
    expect(
      within(await cardFor('Chai and board games')).getByText('1 spot left'),
    ).toBeOnTheScreen();
    const mine = within(await cardFor('Sinhagad trek'));
    expect(mine.getByText('Hosted by you')).toBeOnTheScreen();
    expect(mine.getByText('Full')).toBeOnTheScreen();
  });

  test('an Activity leaves the board when it ends, without asking the server again', async () => {
    const endsSoon = new Date(Date.now() + 300).toISOString();
    jest
      .mocked(activities.fetchBoard)
      .mockResolvedValue([{ ...badminton, visibleUntil: endsSoon }, chai]);
    await openBoard();
    await cardFor('Badminton doubles');
    const calls = jest.mocked(activities.fetchBoard).mock.calls.length;
    jest.setSystemTime(Date.now() + 1000);
    await waitFor(() =>
      expect(screen.queryByText('Badminton doubles')).not.toBeOnTheScreen(),
    );
    expect(await cardFor('Chai and board games')).toBeOnTheScreen();
    expect(activities.fetchBoard).toHaveBeenCalledTimes(calls);
  });

  test('coming back to the Activities tab shows the latest board', async () => {
    await openBoard();
    await cardFor('Badminton doubles');
    jest.mocked(activities.fetchBoard).mockResolvedValue([chai]);
    await fireEvent.press(screen.getByRole('tab', { name: /^Discover/ }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Activities' }));
    await waitFor(() =>
      expect(screen.queryByText('Badminton doubles')).not.toBeOnTheScreen(),
    );
  });

  test("each card shows its host's photo", async () => {
    jest
      .mocked(activities.fetchBoard)
      .mockResolvedValue([{ ...badminton, hostPhotoId: 'isha-1' }]);
    jest
      .mocked(photos.fetchPhotoUrls)
      .mockResolvedValue({ 'isha-1': 'https://r2.example/isha-1.jpg' });
    await openBoard();
    const card = within(await cardFor('Badminton doubles'));
    expect(await card.findByLabelText('Photo of Isha')).toHaveProp('source', {
      uri: 'https://r2.example/isha-1.jpg',
    });
  });

  test('with nothing open, says so and points at posting one', async () => {
    jest.mocked(activities.fetchBoard).mockResolvedValue([]);
    await openBoard();
    expect(await screen.findByText('No Activities yet')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Post an Activity' }),
    ).toBeOnTheScreen();
  });

  test('a Paused Member is told why the board is empty and can unpause', async () => {
    jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
      modes: ['friends'],
      paused: true,
      rangeKm: 10,
      hasLocation: true,
    });
    jest.mocked(activities.fetchBoard).mockResolvedValue([]);
    jest.mocked(discover.unpause).mockImplementation(async () => {
      jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
        modes: ['friends'],
        paused: false,
        rangeKm: 10,
        hasLocation: true,
      });
      jest.mocked(activities.fetchBoard).mockResolvedValue([chai]);
    });
    await openBoard();
    expect(await screen.findByText('Your profile is paused')).toBeOnTheScreen();
    expect(screen.queryByText('No Activities yet')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Unpause' }));
    expect(await cardFor('Chai and board games')).toBeOnTheScreen();
  });

  test('a failed load offers a retry', async () => {
    jest
      .mocked(activities.fetchBoard)
      .mockRejectedValueOnce(new Error(activities.couldNotLoad));
    await openBoard();
    expect(await screen.findByText(activities.couldNotLoad)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await cardFor('Badminton doubles')).toBeOnTheScreen();
  });

  test('pulling down reloads the board', async () => {
    await openBoard();
    await cardFor('Badminton doubles');
    const kabaddi = boardActivity({ id: 'kabaddi', title: 'Kabaddi practice' });
    jest.mocked(activities.fetchBoard).mockResolvedValue([kabaddi]);
    const { refreshControl } = screen.getByTestId('activity-board').props;
    await act(() => refreshControl.props.onRefresh());
    expect(await cardFor('Kabaddi practice')).toBeOnTheScreen();
    expect(screen.queryByText('Badminton doubles')).not.toBeOnTheScreen();
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
      jest.mocked(activities.fetchBoard).mockResolvedValue([]);
    });

    afterEach(async () => {
      jest.restoreAllMocks();
      await AsyncStorage.clear();
    });

    test('the board says it needs my location', async () => {
      await openBoard();
      expect(
        await screen.findByRole('header', {
          name: 'Activities need your location',
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByText(
          'MiloJulo shows Activities within the distance you choose, measured from where you are.',
        ),
      ).toBeOnTheScreen();
    });

    test('Turn on location sends my location and shows the board', async () => {
      await openBoard();
      const turnOn = await screen.findByRole('button', {
        name: 'Turn on location',
      });
      jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
        modes: ['friends'],
        paused: false,
        rangeKm: 10,
        hasLocation: true,
      });
      jest.mocked(activities.fetchBoard).mockResolvedValue([badminton]);
      await fireEvent.press(turnOn);
      expect(location.setLocation).toHaveBeenCalledWith(18.56, 73.78);
      expect(await cardFor('Badminton doubles')).toBeOnTheScreen();
      expect(screen.queryByText('Activities need your location')).toBeNull();
    });
  });
});

describe('the Joined screen', () => {
  const going = { ...chai, requestStatus: 'accepted' as const };
  const waiting = { ...badminton, requestStatus: 'requested' as const };

  test("the Joined button counts the Activities I'm going to", async () => {
    jest.mocked(activities.fetchJoined).mockResolvedValue([going, waiting]);
    await openBoard();
    expect(
      await screen.findByRole('button', { name: 'Joined, 1 going' }),
    ).toBeOnTheScreen();
  });

  test('Going lists what I was accepted into; Waiting lists unanswered Join Requests', async () => {
    jest.mocked(activities.fetchJoined).mockResolvedValue([going, waiting]);
    await openBoard();
    await fireEvent.press(
      await screen.findByRole('button', { name: /^Joined/ }),
    );
    expect(await cardFor('Chai and board games')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: /^Badminton doubles, / }),
    ).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Waiting' }));
    expect(await cardFor('Badminton doubles')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: /^Chai and board games, / }),
    ).toBeNull();
    expect(screen.getByText("The host hasn't answered yet.")).toBeOnTheScreen();
  });

  test('with nothing joined, each tab says so', async () => {
    await openBoard();
    await fireEvent.press(
      await screen.findByRole('button', { name: /^Joined/ }),
    );
    expect(
      await screen.findByText("You're not going to any Activities yet."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Waiting' }));
    expect(
      await screen.findByText('No Join Requests waiting.'),
    ).toBeOnTheScreen();
  });

  test('tapping a card opens the Activity', async () => {
    jest.mocked(activities.fetchJoined).mockResolvedValue([going]);
    await openBoard();
    await fireEvent.press(
      await screen.findByRole('button', { name: /^Joined/ }),
    );
    await fireEvent.press(await cardFor('Chai and board games'));
    expect(
      await screen.findByRole('header', { name: 'Badminton doubles' }),
    ).toBeOnTheScreen();
    expect(activities.fetchActivity).toHaveBeenCalledWith('chai');
  });
});

describe('posting an Activity', () => {
  test('has no Area field: an Activity is placed where the host is', async () => {
    await openCreate();
    expect(screen.queryByText('Area')).toBeNull();
    expect(screen.queryByRole('button', { name: 'All areas' })).toBeNull();
  });

  test('sends every field and opens the new Activity', async () => {
    await openCreate();
    await fireEvent.changeText(
      screen.getByLabelText("What's the plan?"),
      '  Evening cycle ride ',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Outdoors' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tomorrow' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More spots' }));
    await fireEvent.changeText(
      screen.getByLabelText('Details (optional)'),
      'Bring lights.',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Where exactly (optional)'),
      'Wakad bridge',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Post Activity' }),
    );

    const tomorrow = addDays(indiaParts(new Date()).dateKey, 1);
    const minutes = defaultStart().minutes;
    expect(activities.postActivity).toHaveBeenCalledWith({
      title: '  Evening cycle ride ',
      type: 'outdoors',
      startsAt: indiaInstant(tomorrow, minutes),
      endsAt: indiaInstant(tomorrow, minutes + 120),
      capacity: 5,
      description: 'Bring lights.',
      venueDetail: 'Wakad bridge',
      circleId: null,
    });
    expect(activities.fetchActivity).toHaveBeenCalledWith('new-activity');
  });

  test('a date beyond the next week is picked from a calendar', async () => {
    await openCreate();
    await fireEvent.changeText(
      screen.getByLabelText("What's the plan?"),
      'Sinhagad trek',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Outdoors' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Pick a date' }));
    expect(screen.getByText('October 2026')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sat 14 Nov' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Use Sat 14 Nov' }),
    );
    expect(screen.getByRole('button', { name: 'Sat 14 Nov' })).toBeSelected();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Post Activity' }),
    );
    const minutes = defaultStart().minutes;
    expect(activities.postActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        startsAt: indiaInstant('2026-11-14', minutes),
      }),
    );
  });

  test('the calendar offers days up to 90 ahead and none before today', async () => {
    await openCreate();
    await fireEvent.press(screen.getByRole('button', { name: 'Pick a date' }));
    expect(
      screen.getByRole('button', { name: 'Previous month' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tue 13 Oct' })).toBeDisabled();
    for (let i = 0; i < 3; i++) {
      await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    }
    expect(screen.getByText('January 2027')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tue 12 Jan' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Wed 13 Jan' })).toBeDisabled();
  });

  test('the time and length move in 30-minute steps, and spots stay between 1 and 20', async () => {
    await openCreate();
    const start = defaultStart();
    const startLabel = screen.getByLabelText(/^Start time: /);
    const before = startLabel.props.children;
    if (start.minutes < 23 * 60) {
      await fireEvent.press(
        screen.getByRole('button', { name: 'Later start' }),
      );
      expect(screen.getByLabelText(/^Start time: /).props.children).not.toBe(
        before,
      );
    }
    expect(screen.getByLabelText('Length: 2 h')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Shorter' }));
    expect(screen.getByLabelText('Length: 1 h 30 min')).toBeOnTheScreen();

    for (let i = 0; i < 4; i++) {
      await fireEvent.press(
        screen.getByRole('button', { name: 'Fewer spots' }),
      );
    }
    expect(screen.getByLabelText('Spots: 1')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fewer spots' })).toBeDisabled();
  });

  test('missing fields are flagged before anything is sent', async () => {
    await openCreate();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Post Activity' }),
    );
    expect(
      await screen.findByText('Give your Activity a title.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Pick a type.')).toBeOnTheScreen();
    expect(activities.postActivity).not.toHaveBeenCalled();
  });

  test('a refused Post scrolls back to the first flagged field', async () => {
    await openCreate();
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    // The title sits higher on the page than the Type chips.
    await fireEvent(screen.getByTestId('field-title'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 120, width: 0, height: 0 } },
    });
    await fireEvent(screen.getByTestId('field-type'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 260, width: 0, height: 0 } },
    });
    await fireEvent.press(
      screen.getByRole('button', { name: 'Post Activity' }),
    );
    expect(scrollTo).toHaveBeenCalledWith({ y: 120, animated: true });
  });

  async function fillAndPost() {
    await fireEvent.changeText(
      screen.getByLabelText("What's the plan?"),
      'Chai walk',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Games' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tomorrow' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Post Activity' }),
    );
  }

  test('a Paused Member is told to unpause', async () => {
    jest
      .mocked(activities.postActivity)
      .mockRejectedValue(
        new ActivityError(
          'Your profile is paused. Unpause it to post Activities.',
        ),
      );
    await openCreate();
    await fillAndPost();
    expect(
      await screen.findByText(
        'Your profile is paused. Unpause it to post Activities.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Post an Activity' }),
    ).toBeOnTheScreen();
  });

  test('without a fresh location, says why the Activity cannot be posted', async () => {
    const copy =
      "Turn on location to post an activity: it's placed where you are, so people nearby can find it.";
    jest
      .mocked(activities.postActivity)
      .mockRejectedValue(new ActivityError(copy));
    await openCreate();
    await fillAndPost();
    expect(await screen.findByText(copy)).toBeOnTheScreen();
  });

  test('a refusal about one field shows under that field', async () => {
    jest
      .mocked(activities.postActivity)
      .mockRejectedValue(
        new ActivityError('That title has a word we do not allow.', 'title'),
      );
    await openCreate();
    await fillAndPost();
    const title = await screen.findByText(
      'That title has a word we do not allow.',
    );
    // Shown with the title field, not above the button.
    expect(screen.getByLabelText("What's the plan?").parent?.parent).toBe(
      title.parent?.parent,
    );
  });
});

describe('Activity detail', () => {
  test('shows everything but the venue to someone else', async () => {
    jest.mocked(activities.fetchActivity).mockResolvedValue(
      detail({
        endsAt: inDays(0, 23.5),
        venueDetail: null,
      }),
    );
    await openDetail('Badminton doubles');
    expect(screen.getByText('Sports')).toBeOnTheScreen();
    expect(screen.getByText('2 spots left')).toBeOnTheScreen();
    expect(screen.getByText('Today, 11:00 to 11:30 pm')).toBeOnTheScreen();
    expect(screen.getByText('<2 km')).toBeOnTheScreen();
    expect(
      screen.getByText('The exact spot is shared once the host accepts you.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('2 of 4 spots taken')).toBeOnTheScreen();
    expect(screen.getByText('Hosted by Isha')).toBeOnTheScreen();
    expect(
      screen.getByText('Casual doubles, all levels welcome.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Cancel Activity' }),
    ).toBeNull();
  });

  test('the host sees the venue and can edit or cancel', async () => {
    await openDetail('Sinhagad trek');
    expect(
      screen.getByText('Sinhagad base, near the parking'),
    ).toBeOnTheScreen();
    expect(screen.getByText("You're hosting")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Cancel Activity' }),
    ).toBeOnTheScreen();
  });

  test('cancelling asks first, then takes the Activity off the board', async () => {
    await openDetail('Sinhagad trek');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Cancel Activity' }),
    );
    const sheet = within(await screen.findByTestId('confirm-cancel'));
    expect(sheet.getByText('Cancel this Activity?')).toBeOnTheScreen();
    expect(activities.cancelActivity).not.toHaveBeenCalled();
    jest.mocked(activities.fetchBoard).mockResolvedValue([chai, badminton]);
    await fireEvent.press(
      sheet.getByRole('button', { name: 'Yes, cancel it' }),
    );
    expect(activities.cancelActivity).toHaveBeenCalledWith('trek');
    expect(await cardFor('Badminton doubles')).toBeOnTheScreen();
    expect(screen.queryByText('Sinhagad trek')).toBeNull();
  });

  test('a failed cancel says why and keeps the sheet open', async () => {
    jest
      .mocked(activities.cancelActivity)
      .mockRejectedValue(
        new ActivityError('This Activity is already over or cancelled.'),
      );
    await openDetail('Sinhagad trek');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Cancel Activity' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Yes, cancel it' }),
    );
    expect(
      await screen.findByText('This Activity is already over or cancelled.'),
    ).toBeOnTheScreen();
  });

  test.each([
    ['cancelled', 'This Activity was cancelled.'],
    ['expired', 'This Activity is over.'],
  ] as const)(
    'a %s Activity says so and offers nothing to do',
    async (status, note) => {
      jest
        .mocked(activities.fetchActivity)
        .mockResolvedValue({ ...myActivity, status });
      await openDetail('Sinhagad trek');
      expect(screen.getByText(note)).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    },
  );

  test('an Activity I can no longer see says so', async () => {
    jest.mocked(activities.fetchActivity).mockResolvedValue(null);
    await openBoard();
    await fireEvent.press(await cardFor('Badminton doubles'));
    expect(
      await screen.findByText("This Activity isn't available any more."),
    ).toBeOnTheScreen();
  });
});

// The chat screen over the mocked chat module, with one accepted Connection in the list.
function chatWith(name: string, connectionId: string) {
  jest.mocked(chat.fetchConversations).mockResolvedValue([
    {
      connectionId,
      otherId: name.toLowerCase(),
      otherName: name,
      otherPhotoId: null,
      mode: 'activities',
      status: 'accepted',
      direction: 'outgoing',
      note: null,
      lastMessage: null,
      unreadCount: 0,
    },
  ]);
  jest.mocked(chat.fetchMessages).mockResolvedValue([]);
  jest
    .mocked(chat.fetchChatState)
    .mockResolvedValue({ otherLastReadAt: null, muted: false });
  jest.mocked(chat.subscribeToChat).mockReturnValue(() => {});
  jest.mocked(chat.fetchOpenModeChange).mockResolvedValue(null);
  jest.mocked(chat.markRead).mockResolvedValue();
}

describe('joining an Activity', () => {
  const requested = detail({ myRequest: { id: 'req-1', status: 'requested' } });
  const accepted = detail({
    myRequest: { id: 'req-1', status: 'accepted' },
    connectionId: 'conn-isha',
    venueDetail: 'Baner Sports Complex, court 2',
  });

  test('Ask to join sends a Join Request, then shows it waiting with Cancel request', async () => {
    jest.mocked(activities.askToJoin).mockImplementation(async () => {
      jest.mocked(activities.fetchActivity).mockResolvedValue(requested);
      return 'req-1';
    });
    await openDetail('Badminton doubles');
    await fireEvent.press(screen.getByRole('button', { name: 'Ask to join' }));
    expect(activities.askToJoin).toHaveBeenCalledWith('badminton');
    expect(await screen.findByText('Requested')).toBeOnTheScreen();
    expect(screen.getByText('Waiting for Isha to answer.')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Cancel request' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ask to join' })).toBeNull();
  });

  test('a refusal is shown in friendly words and the button stays', async () => {
    jest
      .mocked(activities.askToJoin)
      .mockRejectedValue(
        new Error(
          "You've sent 10 Join Requests in the last 24 hours, the most allowed. Try again later.",
        ),
      );
    await openDetail('Badminton doubles');
    await fireEvent.press(screen.getByRole('button', { name: 'Ask to join' }));
    expect(
      await screen.findByText(/You've sent 10 Join Requests/),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ask to join' })).toBeEnabled();
  });

  test('a full Activity says no spots are left instead of offering to ask', async () => {
    jest
      .mocked(activities.fetchActivity)
      .mockResolvedValue(detail({ spotsLeft: 0 }));
    await openDetail('Badminton doubles');
    expect(
      screen.getByText('No spots left. This Activity is full.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ask to join' })).toBeNull();
  });

  test('cancelling a pending request asks first, and it cannot be asked again', async () => {
    jest.mocked(activities.fetchActivity).mockResolvedValue(requested);
    jest.mocked(activities.withdrawJoinRequest).mockImplementation(async () => {
      jest
        .mocked(activities.fetchActivity)
        .mockResolvedValue(
          detail({ myRequest: { id: 'req-1', status: 'cancelled' } }),
        );
    });
    await openDetail('Badminton doubles');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Cancel request' }),
    );
    const sheet = within(await screen.findByTestId('confirm-withdraw'));
    expect(sheet.getByText('Cancel your request?')).toBeOnTheScreen();
    expect(activities.withdrawJoinRequest).not.toHaveBeenCalled();
    await fireEvent.press(
      sheet.getByRole('button', { name: 'Yes, cancel my request' }),
    );
    expect(activities.withdrawJoinRequest).toHaveBeenCalledWith('req-1');
    expect(
      await screen.findByText('You cancelled your request to join.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ask to join' })).toBeNull();
  });

  test('an accepted joiner sees the venue and can open the chat with the host', async () => {
    jest.mocked(activities.fetchActivity).mockResolvedValue(accepted);
    await openDetail('Badminton doubles');
    expect(screen.getByText('Baner Sports Complex, court 2')).toBeOnTheScreen();
    expect(screen.getByText('Isha accepted you.')).toBeOnTheScreen();
    chatWith('Isha', 'conn-isha');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Open chat with Isha' }),
    );
    expect(await screen.findByLabelText('Chat menu')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Isha' })).toBeOnTheScreen();
  });

  test('an accepted joiner gets directions to the venue in Google Maps', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    jest.mocked(activities.fetchActivity).mockResolvedValue(accepted);
    await openDetail('Badminton doubles');
    await fireEvent.press(screen.getByRole('button', { name: 'Directions' }));
    expect(openURL).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/?api=1&destination=Baner%20Sports%20Complex%2C%20court%202',
    );
  });

  test('with no fresh location of mine, the detail shows no distance', async () => {
    jest
      .mocked(activities.fetchActivity)
      .mockResolvedValue(detail({ distanceBand: null }));
    await openDetail('Badminton doubles');
    expect(screen.getByText('2 of 4 spots taken')).toBeOnTheScreen();
    expect(screen.queryByText('<2 km')).toBeNull();
  });

  test('someone not yet accepted gets no directions', async () => {
    jest.mocked(activities.fetchActivity).mockResolvedValue(detail());
    await openDetail('Badminton doubles');
    expect(
      await screen.findByText(
        'The exact spot is shared once the host accepts you.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Directions' })).toBeNull();
  });

  test('an accepted joiner can withdraw before the start, after confirming', async () => {
    jest.mocked(activities.fetchActivity).mockResolvedValue(accepted);
    jest.mocked(activities.withdrawJoinRequest).mockImplementation(async () => {
      jest
        .mocked(activities.fetchActivity)
        .mockResolvedValue(
          detail({ myRequest: { id: 'req-1', status: 'withdrawn' } }),
        );
    });
    await openDetail('Badminton doubles');
    await fireEvent.press(screen.getByRole('button', { name: 'Withdraw' }));
    const sheet = within(await screen.findByTestId('confirm-withdraw'));
    expect(sheet.getByText('Withdraw from this Activity?')).toBeOnTheScreen();
    expect(sheet.getByText(/Your chat with Isha stays/)).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'Yes, withdraw' }));
    expect(activities.withdrawJoinRequest).toHaveBeenCalledWith('req-1');
    expect(
      await screen.findByText('You withdrew from this Activity.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('The exact spot is shared once the host accepts you.'),
    ).toBeOnTheScreen();
  });

  test('a failed withdraw says why and keeps the sheet open', async () => {
    jest.mocked(activities.fetchActivity).mockResolvedValue(accepted);
    jest
      .mocked(activities.withdrawJoinRequest)
      .mockRejectedValue(
        new Error(
          "This Join Request can't be cancelled or withdrawn any more.",
        ),
      );
    await openDetail('Badminton doubles');
    await fireEvent.press(screen.getByRole('button', { name: 'Withdraw' }));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Yes, withdraw' }),
    );
    expect(
      await screen.findByText(
        "This Join Request can't be cancelled or withdrawn any more.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('confirm-withdraw')).toBeOnTheScreen();
  });

  test('once the Activity has started, an accepted joiner can still chat but not withdraw', async () => {
    jest.mocked(activities.fetchActivity).mockResolvedValue({
      ...accepted,
      startsAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    });
    await openDetail('Badminton doubles');
    expect(
      screen.getByRole('button', { name: 'Open chat with Isha' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });

  test('a request still waiting at the start says it went unanswered, with nothing to cancel', async () => {
    jest.mocked(activities.fetchActivity).mockResolvedValue({
      ...requested,
      startsAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    });
    await openDetail('Badminton doubles');
    expect(
      screen.getByText(
        "Isha didn't answer your Join Request before the start.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Waiting for Isha to answer.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
  });

  test('an accepted joiner whose chat was closed is told so', async () => {
    jest
      .mocked(activities.fetchActivity)
      .mockResolvedValue({ ...accepted, connectionId: null });
    await openDetail('Badminton doubles');
    expect(
      screen.getByText('Your chat with Isha was closed.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Open chat/ })).toBeNull();
  });

  test('a refusal reloads the Activity, so a full one shows as full', async () => {
    jest.mocked(activities.askToJoin).mockImplementation(async () => {
      jest
        .mocked(activities.fetchActivity)
        .mockResolvedValue(detail({ spotsLeft: 0 }));
      throw new Error('There are no spots left on this Activity.');
    });
    await openDetail('Badminton doubles');
    await fireEvent.press(screen.getByRole('button', { name: 'Ask to join' }));
    expect(
      await screen.findByText('No spots left. This Activity is full.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Full')).toBeOnTheScreen();
  });

  test.each([
    ['declined', "Your request to join wasn't accepted this time."],
    ['cancelled', 'You cancelled your request to join.'],
    ['withdrawn', 'You withdrew from this Activity.'],
  ] as const)(
    'a %s request leaves a short note and no way to ask again',
    async (status, note) => {
      jest
        .mocked(activities.fetchActivity)
        .mockResolvedValue(detail({ myRequest: { id: 'req-1', status } }));
      await openDetail('Badminton doubles');
      expect(screen.getByText(note)).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Ask to join' })).toBeNull();
      expect(screen.queryByRole('button', { name: /Open chat/ })).toBeNull();
    },
  );
});

describe("the host's Join Requests", () => {
  const joinRequest = (overrides: Partial<JoinRequest>): JoinRequest => ({
    id: 'req-kabir',
    requesterId: 'kabir',
    requesterName: 'Kabir',
    requesterPhotoId: null,
    status: 'requested',
    createdAt: '2026-10-12T10:00:00Z',
    connectionId: null,
    ...overrides,
  });
  const kabir = joinRequest({});
  const neha = joinRequest({
    id: 'req-neha',
    requesterId: 'neha',
    requesterName: 'Neha',
    status: 'accepted',
    connectionId: 'conn-neha',
  });

  beforeEach(() => {
    jest.mocked(activities.fetchJoinRequests).mockResolvedValue([kabir, neha]);
  });

  test('lists who is waiting and who is going', async () => {
    await openDetail('Sinhagad trek');
    expect(activities.fetchJoinRequests).toHaveBeenCalledWith('trek');
    const waiting = within(await screen.findByTestId('join-requests'));
    expect(waiting.getByText('Kabir')).toBeOnTheScreen();
    expect(
      waiting.getByRole('button', { name: "Accept Kabir's Join Request" }),
    ).toBeOnTheScreen();
    const going = within(screen.getByTestId('going'));
    expect(going.getByText('Neha')).toBeOnTheScreen();
    expect(
      going.getByRole('button', { name: 'Open chat with Neha' }),
    ).toBeOnTheScreen();
  });

  test('someone else never asks for the requests', async () => {
    await openDetail('Badminton doubles');
    expect(activities.fetchJoinRequests).not.toHaveBeenCalled();
    expect(screen.queryByTestId('join-requests')).toBeNull();
  });

  test('accepting keeps the host on the Activity and moves the joiner to Going', async () => {
    jest.mocked(activities.respondJoinRequest).mockImplementation(async () => {
      jest
        .mocked(activities.fetchJoinRequests)
        .mockResolvedValue([
          { ...kabir, status: 'accepted', connectionId: 'conn-kabir' },
          neha,
        ]);
      return 'conn-kabir';
    });
    await openDetail('Sinhagad trek');
    await fireEvent.press(
      await screen.findByRole('button', {
        name: "Accept Kabir's Join Request",
      }),
    );
    expect(activities.respondJoinRequest).toHaveBeenCalledWith(
      'req-kabir',
      true,
    );
    const going = within(screen.getByTestId('going'));
    expect(
      await going.findByRole('button', { name: 'Open chat with Kabir' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Sinhagad trek' }),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText('Chat menu')).toBeNull();
    expect(
      within(screen.getByTestId('join-requests')).getByText(
        /No one is waiting/,
      ),
    ).toBeOnTheScreen();
  });

  test('declining takes the request away', async () => {
    jest.mocked(activities.respondJoinRequest).mockImplementation(async () => {
      jest.mocked(activities.fetchJoinRequests).mockResolvedValue([neha]);
      return null;
    });
    await openDetail('Sinhagad trek');
    await fireEvent.press(
      await screen.findByRole('button', {
        name: "Decline Kabir's Join Request",
      }),
    );
    expect(activities.respondJoinRequest).toHaveBeenCalledWith(
      'req-kabir',
      false,
    );
    expect(await screen.findByText(/No one is waiting/)).toBeOnTheScreen();
    expect(screen.queryByText('Kabir')).toBeNull();
  });

  test('a refused accept says why on the card', async () => {
    jest
      .mocked(activities.respondJoinRequest)
      .mockRejectedValue(
        new Error('There are no spots left on this Activity.'),
      );
    await openDetail('Sinhagad trek');
    await fireEvent.press(
      await screen.findByRole('button', {
        name: "Accept Kabir's Join Request",
      }),
    );
    expect(
      await screen.findByText('There are no spots left on this Activity.'),
    ).toBeOnTheScreen();
  });

  test.each([
    [
      'has started',
      { startsAt: new Date(Date.now() - 30 * 60_000).toISOString() },
    ],
    ['was cancelled', { status: 'cancelled' as const }],
  ])(
    'once the Activity %s, waiting requests can no longer be answered',
    async (_, change) => {
      jest
        .mocked(activities.fetchActivity)
        .mockResolvedValue({ ...myActivity, ...change });
      await openDetail('Sinhagad trek');
      const waiting = within(await screen.findByTestId('join-requests'));
      expect(waiting.getByText('Kabir')).toBeOnTheScreen();
      expect(
        waiting.queryByRole('button', { name: /Join Request$/ }),
      ).toBeNull();
    },
  );

  test('Open chat takes the host to the chat with that joiner', async () => {
    await openDetail('Sinhagad trek');
    chatWith('Neha', 'conn-neha');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Open chat with Neha' }),
    );
    expect(await screen.findByLabelText('Chat menu')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Neha' })).toBeOnTheScreen();
  });
});

describe('editing an Activity', () => {
  async function openEdit() {
    await openDetail('Sinhagad trek');
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByRole('header', { name: 'Edit Activity' });
  }

  test('the form starts filled in and sends only what changed', async () => {
    await openEdit();
    expect(screen.getByLabelText("What's the plan?").props.value).toBe(
      'Sinhagad trek',
    );
    expect(screen.getByLabelText('Spots: 4')).toBeOnTheScreen();
    expect(screen.getByLabelText('Length: 4 h')).toBeOnTheScreen();
    expect(screen.getByLabelText('Where exactly (optional)').props.value).toBe(
      'Sinhagad base, near the parking',
    );
    await fireEvent.changeText(
      screen.getByLabelText("What's the plan?"),
      'Sinhagad sunrise trek',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Where exactly (optional)'),
      '',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'More spots' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    expect(activities.updateActivity).toHaveBeenCalledWith('trek', {
      title: 'Sinhagad sunrise trek',
      capacity: 5,
      venueDetail: '',
    });
    expect(
      await screen.findByRole('header', { name: 'Sinhagad trek' }),
    ).toBeOnTheScreen();
  });

  test('a Locked Activity keeps its title, time and venue, and spots only go up', async () => {
    jest
      .mocked(activities.fetchActivity)
      .mockResolvedValue({ ...myActivity, isLocked: true, spotsLeft: 3 });
    await openEdit();
    expect(
      screen.getByText(
        'Someone has joined, so the title, time and venue stay as they are. You can still change the details or add Spots.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText("What's the plan?")).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tomorrow' })).toBeNull();
    expect(screen.queryByLabelText('Where exactly (optional)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fewer spots' })).toBeDisabled();
    await fireEvent.changeText(
      screen.getByLabelText('Details (optional)'),
      'Meet at 5:45.',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'More spots' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    expect(activities.updateActivity).toHaveBeenCalledWith('trek', {
      description: 'Meet at 5:45.',
      capacity: 5,
    });
  });
});

describe('reporting an Activity', () => {
  test('the Activity menu opens Report for this Activity and its host', async () => {
    jest.mocked(reports.reportContent).mockResolvedValue();
    jest.mocked(activities.fetchActivity).mockResolvedValue(detail());
    await openDetail('Badminton doubles');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Activity menu' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Report this Activity' }),
    );
    await screen.findByRole('header', { name: 'Report this Activity' });
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Fake profile or spam' }),
    );
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Also block Isha, so you never see each other',
      }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Submit report' }),
    );
    expect(reports.reportContent).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'activity',
        targetId: 'badminton',
      }),
    );
    expect(chat.blockMember).toHaveBeenCalledWith('isha');
  });

  test('the host has nothing to report on their own Activity', async () => {
    await openDetail('Sinhagad trek');
    expect(screen.queryByRole('button', { name: 'Activity menu' })).toBeNull();
  });
});

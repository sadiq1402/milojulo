import { act, fireEvent, screen, within } from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import {
  ActivityError,
  type Activity,
  type BoardActivity,
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
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/activities/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/discover/api');

const me = sessionFor('asha@example.com');

// Times well in the future, so labels are stable; the board's grouping comes from starts_when.
const inDays = (days: number, hourIndia: number) =>
  indiaInstant(addDays(indiaParts(new Date()).dateKey, days), hourIndia * 60);

const boardActivity = (overrides: Partial<BoardActivity>): BoardActivity => ({
  id: 'badminton',
  hostId: 'isha',
  hostName: 'Isha',
  title: 'Badminton doubles',
  type: 'sports',
  areaId: 'baner',
  startsAt: inDays(0, 23),
  endsAt: null,
  capacity: 4,
  spotsLeft: 2,
  description: 'Casual doubles, all levels welcome.',
  startsWhen: 'tonight',
  isMine: false,
  ...overrides,
});

const badminton = boardActivity({});
const chai = boardActivity({
  id: 'chai',
  hostId: 'rohan',
  hostName: 'Rohan',
  title: 'Chai and board games',
  type: 'food_chai',
  areaId: 'wakad',
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
  areaId: 'baner',
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
  jest.mocked(catalog.fetchAreaNames).mockResolvedValue({
    baner: 'Baner',
    wakad: 'Wakad',
  });
  jest.mocked(catalog.fetchTagNames).mockResolvedValue({});
  jest.mocked(catalog.fetchPromptQuestions).mockResolvedValue({});
  jest
    .mocked(discover.fetchMyDiscoverState)
    .mockResolvedValue({ modes: ['friends'], paused: false });
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
  // The Area chips come from the catalog.
  await screen.findByRole('button', { name: 'Baner' });
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

  test('each card shows the type, title, Area, time, host first name and spots left', async () => {
    await openBoard();
    const card = within(await cardFor('Badminton doubles'));
    expect(card.getByText('Sports')).toBeOnTheScreen();
    expect(card.getByText('Badminton doubles')).toBeOnTheScreen();
    expect(await card.findByText('Baner')).toBeOnTheScreen();
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

  test('with nothing open, says so and points at posting one', async () => {
    jest.mocked(activities.fetchBoard).mockResolvedValue([]);
    await openBoard();
    expect(await screen.findByText('No Activities yet')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Post an Activity' }),
    ).toBeOnTheScreen();
  });

  test('a Paused Member is told why the board is empty and can unpause', async () => {
    jest
      .mocked(discover.fetchMyDiscoverState)
      .mockResolvedValue({ modes: ['friends'], paused: true });
    jest.mocked(activities.fetchBoard).mockResolvedValue([]);
    jest.mocked(discover.unpause).mockImplementation(async () => {
      jest
        .mocked(discover.fetchMyDiscoverState)
        .mockResolvedValue({ modes: ['friends'], paused: false });
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
});

describe('posting an Activity', () => {
  test('sends every field and opens the new Activity', async () => {
    await openCreate();
    await fireEvent.changeText(
      screen.getByLabelText("What's the plan?"),
      '  Evening cycle ride ',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Outdoors' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Wakad' }));
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
      areaId: 'wakad',
      startsAt: indiaInstant(tomorrow, minutes),
      endsAt: indiaInstant(tomorrow, minutes + 120),
      capacity: 5,
      description: 'Bring lights.',
      venueDetail: 'Wakad bridge',
    });
    expect(activities.fetchActivity).toHaveBeenCalledWith('new-activity');
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
    expect(screen.getByText('Pick an Area.')).toBeOnTheScreen();
    expect(activities.postActivity).not.toHaveBeenCalled();
  });

  async function fillAndPost() {
    await fireEvent.changeText(
      screen.getByLabelText("What's the plan?"),
      'Chai walk',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Games' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Baner' }));
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
    expect(await screen.findByText('Baner')).toBeOnTheScreen();
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

  test('a Locked Activity keeps its title, time, Area and venue, and spots only go up', async () => {
    jest
      .mocked(activities.fetchActivity)
      .mockResolvedValue({ ...myActivity, isLocked: true, spotsLeft: 3 });
    await openEdit();
    expect(
      screen.getByText(
        'Someone has joined, so the title, time, Area and venue stay as they are. You can still change the details or add Spots.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText("What's the plan?")).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tomorrow' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Baner' })).toBeNull();
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

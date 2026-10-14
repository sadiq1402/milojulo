import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import * as catalog from '../src/features/catalog/api';
import * as chat from '../src/features/chat/api';
import type { Conversation } from '../src/features/chat/api';
import * as discover from '../src/features/discover/api';
import type { FeedCard, Profile } from '../src/features/discover/api';
import * as reports from '../src/features/reports/api';
import { areas, numbered } from '../test/catalog';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/activities/api');
jest.mock('../src/features/discover/api');
// Keep the real reason list; only the call to the database is stood in.
jest.mock('../src/features/reports/api', () => ({
  ...jest.requireActual('../src/features/reports/api'),
  reportContent: jest.fn(),
}));
// The request sheet belongs to Connection Requests (#41); this checks what Discover hands it.
jest.mock('../src/screens/requests/SendRequestSheet', () => ({
  SendRequestSheet: (props: {
    visible: boolean;
    member: { id: string; name: string; modes: string[] };
  }) => {
    const { Text } = require('react-native');
    return props.visible ? (
      <Text>
        Request sheet for {props.member.name}: {props.member.modes.join(', ')}
      </Text>
    ) : null;
  },
}));

const me = sessionFor('asha@example.com');

const card = (overrides: Partial<FeedCard>): FeedCard => ({
  id: 'isha',
  name: 'Isha',
  age: 27,
  areaId: 'baner',
  modes: ['friends'],
  coverPhotoId: null,
  sharedTagIds: [1, 2],
  whyYouMatch: 'You both want friends, like badminton and cafes.',
  ...overrides,
});

const isha = card({});
const rohan = card({
  id: 'rohan',
  name: 'Rohan',
  age: 29,
  areaId: 'wakad',
  modes: ['friends', 'activities'],
  sharedTagIds: [3],
  whyYouMatch:
    'You both want friends and activity partners, and like trekking.',
});

const ishaProfile: Profile = {
  id: 'isha',
  name: 'Isha',
  age: 27,
  areaId: 'baner',
  modes: ['friends', 'activities'],
  whyYouMatch: 'You both want friends, like badminton and cafes.',
  photoIds: ['p1', 'p2'],
  prompts: [
    { position: 1, questionId: 10, answer: 'A long breakfast.' },
    { position: 2, questionId: 20, answer: 'Make up a badminton group.' },
  ],
  tagIds: [1, 3],
};

const conversation = (overrides: Partial<Conversation>): Conversation => ({
  connectionId: 'conn-isha',
  otherId: 'isha',
  otherName: 'Isha',
  otherPhotoId: null,
  otherAreaId: 'baner',
  mode: 'friends',
  status: 'accepted',
  direction: 'outgoing',
  note: null,
  lastMessage: null,
  unreadCount: 0,
  ...overrides,
});

beforeEach(() => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
  jest
    .mocked(catalog.fetchAreas)
    .mockResolvedValue(areas({ baner: 'Baner', wakad: 'Wakad' }));
  jest
    .mocked(catalog.fetchTags)
    .mockResolvedValue(numbered({ 1: 'Badminton', 2: 'Cafes', 3: 'Trekking' }));
  jest.mocked(catalog.fetchPromptQuestions).mockResolvedValue(
    numbered({
      10: 'A perfect Sunday in Pune is…',
      20: "I'm looking for people to…",
    }),
  );
  jest
    .mocked(discover.fetchMyDiscoverState)
    .mockResolvedValue({ modes: ['friends', 'activities'], paused: false });
  jest
    .mocked(discover.fetchFeedPage)
    .mockResolvedValue({ cards: [isha, rohan], nextCursor: null });
  jest.mocked(discover.fetchProfile).mockResolvedValue(ishaProfile);
  jest.mocked(chat.fetchConversations).mockResolvedValue([]);
  jest.mocked(chat.blockMember).mockResolvedValue();
  jest.mocked(reports.reportContent).mockResolvedValue();
});

const cardFor = (name: string) =>
  screen.findByRole('button', { name: new RegExp(`^${name}, `) });

async function openProfile(name = 'Isha') {
  await renderApp(me);
  await fireEvent.press(await cardFor(name));
  await screen.findByRole('header', { name: `${name}, 27` });
  // Let the catalog and Connection loads land before the test goes on.
  await screen.findByText('A perfect Sunday in Pune is…');
}

describe('the Discover feed', () => {
  test('shows a card per person with age, Area, shared Mode, why you match and shared tags', async () => {
    await renderApp(me);
    const ishaCard = await cardFor('Isha');
    expect(ishaCard).toHaveAccessibleName(
      'Isha, 27, Baner. You both want friends, like badminton and cafes.',
    );
    const inCard = within(ishaCard);
    expect(inCard.getByText('Isha, 27')).toBeOnTheScreen();
    expect(inCard.getByText('Baner')).toBeOnTheScreen();
    expect(inCard.getByText('Friends')).toBeOnTheScreen();
    expect(
      inCard.getByText('You both want friends, like badminton and cafes.'),
    ).toBeOnTheScreen();
    expect(inCard.getByText('Badminton')).toBeOnTheScreen();
    expect(await inCard.findByText('Cafes')).toBeOnTheScreen();
    expect(
      within(await cardFor('Rohan')).getByText('Activities'),
    ).toBeOnTheScreen();
    expect(discover.fetchFeedPage).toHaveBeenCalledWith({
      mode: null,
      cursor: null,
    });
  });

  test('filter chips are All plus my own Modes, and a chip narrows the feed to that Mode', async () => {
    await renderApp(me);
    await cardFor('Isha');
    expect(
      screen.getByRole('button', { name: 'All', selected: true }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Friends' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Dating' })).toBeNull();

    jest
      .mocked(discover.fetchFeedPage)
      .mockResolvedValue({ cards: [rohan], nextCursor: null });
    await fireEvent.press(screen.getByRole('button', { name: 'Activities' }));
    expect(
      await screen.findByRole('button', { name: 'Activities', selected: true }),
    ).toBeOnTheScreen();
    expect(discover.fetchFeedPage).toHaveBeenLastCalledWith({
      mode: 'activities',
      cursor: null,
    });
    await screen.findByText(
      'You both want friends and activity partners, and like trekking.',
    );
    expect(screen.queryByText('Isha, 27')).toBeNull();
  });

  test('scrolling to the end loads the next page with the cursor', async () => {
    jest
      .mocked(discover.fetchFeedPage)
      .mockResolvedValueOnce({ cards: [isha], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ cards: [rohan], nextCursor: null });
    await renderApp(me);
    await cardFor('Isha');
    await fireEvent(screen.getByTestId('discover-feed'), 'endReached');
    expect(await cardFor('Rohan')).toBeOnTheScreen();
    expect(discover.fetchFeedPage).toHaveBeenLastCalledWith({
      mode: null,
      cursor: 'cursor-1',
    });

    // The last page has no cursor, so the end of the list loads nothing more.
    await fireEvent(screen.getByTestId('discover-feed'), 'endReached');
    expect(discover.fetchFeedPage).toHaveBeenCalledTimes(2);
  });

  test('someone who comes up again on the next page shows only once', async () => {
    jest
      .mocked(discover.fetchFeedPage)
      .mockResolvedValueOnce({ cards: [isha], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ cards: [isha, rohan], nextCursor: null });
    await renderApp(me);
    await cardFor('Isha');
    await fireEvent(screen.getByTestId('discover-feed'), 'endReached');
    expect(await cardFor('Rohan')).toBeOnTheScreen();
    expect(screen.getAllByText('Isha, 27')).toHaveLength(1);
  });

  test('pulling down refreshes the feed', async () => {
    await renderApp(me);
    await cardFor('Isha');
    jest
      .mocked(discover.fetchFeedPage)
      .mockResolvedValue({ cards: [rohan], nextCursor: null });
    const { refreshControl } = screen.getByTestId('discover-feed').props;
    await act(() => refreshControl.props.onRefresh());
    // Rohan was already in the first page, so wait for Isha to go.
    await waitFor(() => expect(screen.queryByText('Isha, 27')).toBeNull());
    expect(await cardFor('Rohan')).toBeOnTheScreen();
  });

  test('when nobody matches, says so', async () => {
    jest
      .mocked(discover.fetchFeedPage)
      .mockResolvedValue({ cards: [], nextCursor: null });
    await renderApp(me);
    expect(await screen.findByText('Nobody new right now')).toBeOnTheScreen();
  });

  test('a failed load offers a retry', async () => {
    jest
      .mocked(discover.fetchFeedPage)
      .mockRejectedValueOnce(new Error("We couldn't load this."))
      .mockResolvedValue({ cards: [isha], nextCursor: null });
    await renderApp(me);
    expect(await screen.findByText("We couldn't load this.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await cardFor('Isha')).toBeOnTheScreen();
  });

  test('a Paused Member is told why the feed is empty and can unpause', async () => {
    jest
      .mocked(discover.fetchMyDiscoverState)
      .mockResolvedValueOnce({ modes: ['friends'], paused: true })
      .mockResolvedValue({ modes: ['friends'], paused: false });
    jest.mocked(discover.unpause).mockResolvedValue();
    await renderApp(me);
    expect(await screen.findByText('Your profile is paused')).toBeOnTheScreen();
    expect(discover.fetchFeedPage).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Unpause' }));
    expect(discover.unpause).toHaveBeenCalled();
    expect(await cardFor('Isha')).toBeOnTheScreen();
    expect(screen.queryByText('Your profile is paused')).toBeNull();
  });
});

describe('a profile', () => {
  test('tapping a card opens the profile with Area, shared Modes, why you match, prompts and tags', async () => {
    await openProfile();
    expect(discover.fetchProfile).toHaveBeenCalledWith('isha');
    expect(screen.getByText('Baner')).toBeOnTheScreen();
    expect(screen.getByText('Friends')).toBeOnTheScreen();
    expect(screen.getByText('Activities')).toBeOnTheScreen();
    expect(screen.getByText('Why you match')).toBeOnTheScreen();
    expect(
      screen.getByText('You both want friends, like badminton and cafes.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('A long breakfast.')).toBeOnTheScreen();
    expect(screen.getByText("I'm looking for people to…")).toBeOnTheScreen();
    expect(screen.getByText('Make up a badminton group.')).toBeOnTheScreen();
    expect(screen.getByText('Badminton')).toBeOnTheScreen();
    expect(screen.getByText('Trekking')).toBeOnTheScreen();
  });

  test('Send request opens the request sheet with our shared Modes', async () => {
    await openProfile();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Send request' }),
    );
    expect(
      screen.getByText('Request sheet for Isha: friends, activities'),
    ).toBeOnTheScreen();
  });

  test('with an accepted Connection it offers the chat instead', async () => {
    jest
      .mocked(chat.fetchConversations)
      .mockResolvedValue([conversation({ status: 'accepted' })]);
    jest.mocked(chat.fetchMessages).mockResolvedValue([]);
    jest
      .mocked(chat.fetchChatState)
      .mockResolvedValue({ otherLastReadAt: null, muted: false });
    jest.mocked(chat.subscribeToChat).mockReturnValue(() => {});
    jest.mocked(chat.fetchOpenModeChange).mockResolvedValue(null);
    await openProfile();
    expect(screen.queryByRole('button', { name: 'Send request' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open chat' }));
    expect(await screen.findByLabelText('Chat menu')).toBeOnTheScreen();
  });

  test('with my request still waiting, it shows the request as sent', async () => {
    jest
      .mocked(chat.fetchConversations)
      .mockResolvedValue([
        conversation({ status: 'requested', direction: 'outgoing' }),
      ]);
    await openProfile();
    expect(
      screen.getByRole('button', { name: 'Request sent', disabled: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Send request' })).toBeNull();
  });

  test('blocking confirms first, then leaves the profile and refreshes the feed', async () => {
    await openProfile();
    await fireEvent.press(screen.getByRole('button', { name: 'Profile menu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Block Isha' }));
    const confirm = screen.getByTestId('confirm-block');
    expect(within(confirm).getByText('Block Isha?')).toBeOnTheScreen();
    expect(chat.blockMember).not.toHaveBeenCalled();

    jest
      .mocked(discover.fetchFeedPage)
      .mockResolvedValue({ cards: [rohan], nextCursor: null });
    await fireEvent.press(
      within(confirm).getByRole('button', { name: 'Block' }),
    );
    expect(chat.blockMember).toHaveBeenCalledWith('isha');
    expect(await cardFor('Rohan')).toBeOnTheScreen();
    expect(screen.queryByText('Isha, 27')).toBeNull();
  });

  test('a profile that is no longer available says so', async () => {
    jest.mocked(discover.fetchProfile).mockResolvedValue(null);
    await renderApp(me);
    await fireEvent.press(await cardFor('Isha'));
    expect(
      await screen.findByText("This profile isn't available any more."),
    ).toBeOnTheScreen();
  });
});

describe('reporting', () => {
  async function openReport() {
    await openProfile();
    await fireEvent.press(screen.getByRole('button', { name: 'Profile menu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Report Isha' }));
    await screen.findByRole('header', { name: 'Report Isha' });
  }

  test('the profile menu opens Report with the reasons from the mockup', async () => {
    await openReport();
    expect(
      screen.getAllByRole('radio').map(r => r.props.accessibilityLabel),
    ).toEqual([
      'Fake profile or spam',
      'Harassment or unwanted contact',
      'Inappropriate photos or messages',
      'Seems under 18',
      'I felt unsafe in person',
      'Something else',
    ]);
    expect(
      screen.getByText(/We aim to respond within 24 hours/),
    ).toBeOnTheScreen();
  });

  test('a reason is needed before anything is sent', async () => {
    await openReport();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Submit report' }),
    );
    expect(
      screen.getByText('Choose a reason for your report.'),
    ).toBeOnTheScreen();
    expect(reports.reportContent).not.toHaveBeenCalled();
  });

  test('sends the profile, reason and details, then confirms the 24-hour response target', async () => {
    await openReport();
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Harassment or unwanted contact' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('Details (optional)'),
      'Kept messaging after I said no.',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Submit report' }),
    );
    expect(reports.reportContent).toHaveBeenCalledWith({
      targetType: 'profile',
      targetId: 'isha',
      reason: 'harassment',
      details: 'Kept messaging after I said no.',
    });
    expect(chat.blockMember).not.toHaveBeenCalled();
    expect(await screen.findByText('Thanks for telling us')).toBeOnTheScreen();
    expect(screen.getByText(/respond within 24 hours/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(
      await screen.findByRole('header', { name: 'Isha, 27' }),
    ).toBeOnTheScreen();
  });

  test('details stop at 500 characters', async () => {
    await openReport();
    expect(screen.getByLabelText('Details (optional)').props.maxLength).toBe(
      500,
    );
  });

  test('Also block blocks after the report is sent, and Done leaves the profile', async () => {
    await openReport();
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Seems under 18' }),
    );
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Also block Isha, so you never see each other',
      }),
    );
    jest
      .mocked(discover.fetchFeedPage)
      .mockResolvedValue({ cards: [rohan], nextCursor: null });
    await fireEvent.press(
      screen.getByRole('button', { name: 'Submit report' }),
    );
    expect(reports.reportContent).toHaveBeenCalledWith({
      targetType: 'profile',
      targetId: 'isha',
      reason: 'underage',
      details: '',
    });
    await waitFor(() => expect(chat.blockMember).toHaveBeenCalledWith('isha'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Done' }));
    expect(await cardFor('Rohan')).toBeOnTheScreen();
    expect(screen.queryByText('Isha, 27')).toBeNull();
  });

  test('a refused report says why, keeps the form and does not block', async () => {
    jest
      .mocked(reports.reportContent)
      .mockRejectedValue(new Error("This isn't available to report any more."));
    await openReport();
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Something else' }),
    );
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Also block Isha, so you never see each other',
      }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Submit report' }),
    );
    expect(
      await screen.findByText("This isn't available to report any more."),
    ).toBeOnTheScreen();
    expect(chat.blockMember).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Submit report' }),
    ).toBeOnTheScreen();
  });

  test('when the block fails after the report, the report still counts and says so', async () => {
    jest.mocked(chat.blockMember).mockRejectedValue(new Error('nope'));
    await openReport();
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Something else' }),
    );
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Also block Isha, so you never see each other',
      }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Submit report' }),
    );
    expect(await screen.findByText('Thanks for telling us')).toBeOnTheScreen();
    expect(screen.getByText(/Blocking didn't work/)).toBeOnTheScreen();
  });

  test('a screen reader can report the photo through its actions', async () => {
    await openProfile();
    await fireEvent(
      screen.getByLabelText("Isha's photo"),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'report' },
      },
    );
    expect(
      await screen.findByRole('header', { name: "Report Isha's photo" }),
    ).toBeOnTheScreen();
  });

  test('a long-press on the profile photo reports that photo', async () => {
    await openProfile();
    await fireEvent(screen.getByLabelText("Isha's photo"), 'longPress');
    await screen.findByRole('header', { name: "Report Isha's photo" });
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Inappropriate photos or messages' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Submit report' }),
    );
    expect(reports.reportContent).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: 'photo', targetId: 'p1' }),
    );
  });
});

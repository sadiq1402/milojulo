import { notifyManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import * as chat from '../src/features/chat/api';
import * as discover from '../src/features/discover/api';
import * as me from '../src/features/me/api';
import * as photos from '../src/features/photos/api';
import * as profileSetup from '../src/features/profileSetup/api';
import { SetupError } from '../src/features/profileSetup/model';
import { mockProfileSetup } from '../test/profileSetup';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/activities/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/discover/api');
jest.mock('../src/features/photos/api');
jest.mock('../src/features/profileSetup/api');
// Keep the real helpers (age, the support address); stand in only the database calls.
jest.mock('../src/features/me/api', () => ({
  ...jest.requireActual('../src/features/me/api'),
  setPaused: jest.fn(),
  fetchMyBlocks: jest.fn(),
  unblock: jest.fn(),
}));

const userId = 'id-asha@example.com';

beforeAll(() =>
  notifyManager.setScheduler(callback => Promise.resolve().then(callback)),
);

beforeEach(() => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
  jest.mocked(chat.fetchConversations).mockResolvedValue([]);
  jest
    .mocked(discover.fetchMyDiscoverState)
    .mockResolvedValue({ modes: ['friends'], paused: false });
  jest
    .mocked(discover.fetchFeedPage)
    .mockResolvedValue({ cards: [], nextCursor: null });
  mockProfileSetup(
    {
      displayName: 'Asha',
      areaId: 'baner',
      // 28 on any day of this year.
      birthDate: `${new Date().getUTCFullYear() - 28}-01-01`,
      modes: ['friends', 'activities'],
      prompts: [
        { position: 1, questionId: 1, answer: 'Chai and a trek' },
        { position: 2, questionId: 2, answer: 'Play badminton' },
      ],
      tagIds: [1, 2],
      availability: ['weekends'],
    },
    [
      { id: 'p1', position: 1 },
      { id: 'p2', position: 2 },
    ],
  );
  jest.mocked(profileSetup.saveBasics).mockResolvedValue();
  jest.mocked(profileSetup.saveModes).mockResolvedValue();
  jest.mocked(me.setPaused).mockResolvedValue();
  jest
    .mocked(me.fetchMyBlocks)
    .mockResolvedValue([
      { memberId: 'rohan', name: 'Rohan', blockedAt: '2026-10-02T10:00:00Z' },
    ]);
  jest.mocked(me.unblock).mockResolvedValue();
});

const header = (name: string) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.findByRole('button', { name });

async function openMe() {
  await renderApp(sessionFor('asha@example.com'));
  await fireEvent.press(await screen.findByRole('tab', { name: 'Me' }));
  await screen.findByText('Asha, 28');
}

describe('the Me tab', () => {
  test('shows name, age and Area with sections to edit, and no Approved badge', async () => {
    await openMe();
    expect(await screen.findByText('Baner')).toBeOnTheScreen();
    expect(await button(/^Name and Area/)).toBeOnTheScreen();
    expect(await button(/^Photos, 2 photos/)).toBeOnTheScreen();
    expect(await button(/^Prompts/)).toBeOnTheScreen();
    expect(
      await button(/^Modes and preferences, Friends, Activities/),
    ).toBeOnTheScreen();
    expect(
      await button(/^Interests and availability, Badminton, Cafes/),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Approved/)).toBeNull();
  });

  test('editing the name saves it and comes back to Me showing it', async () => {
    await openMe();
    await fireEvent.press(await button(/^Name and Area/));
    await header('What should we call you?');
    expect(screen.queryByLabelText(/Step \d of 5/)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Ashu');
    await fireEvent.press(await button('Save'));
    expect(await screen.findByText('Ashu, 28')).toBeOnTheScreen();
    expect(profileSetup.saveBasics).toHaveBeenCalledWith(userId, {
      displayName: 'Ashu',
      areaId: 'baner',
    });
  });

  test('an edit the profile minimum refuses stays open with the reason', async () => {
    jest
      .mocked(profileSetup.saveModes)
      .mockRejectedValue(new SetupError('Choose at least one Mode.', 'modes'));
    await openMe();
    await fireEvent.press(await button(/^Modes and preferences/));
    await fireEvent.press(await button('Save'));
    expect(
      await screen.findByText('Choose at least one Mode.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save' })).toBeOnTheScreen();
  });

  test('Back saves the edit, as setup does', async () => {
    await openMe();
    await fireEvent.press(await button(/^Name and Area/));
    await fireEvent.changeText(
      await screen.findByLabelText('First name'),
      'Ashu',
    );
    await fireEvent.press(await button('Back'));
    expect(await screen.findByText('Ashu, 28')).toBeOnTheScreen();
    expect(profileSetup.saveBasics).toHaveBeenCalledWith(userId, {
      displayName: 'Ashu',
      areaId: 'baner',
    });
  });

  test('Back saves Modes too', async () => {
    await openMe();
    await fireEvent.press(await button(/^Modes and preferences/));
    await screen.findByRole('button', { name: 'Save' });
    await fireEvent.press(await button('Back'));
    await screen.findByText('Asha, 28');
    expect(profileSetup.saveModes).toHaveBeenCalled();
  });

  test('a save refused on the way back stays with the reason', async () => {
    jest
      .mocked(profileSetup.saveBasics)
      .mockRejectedValue(new SetupError('Add your first name.', 'basics'));
    await openMe();
    await fireEvent.press(await button(/^Name and Area/));
    await fireEvent.changeText(await screen.findByLabelText('First name'), '');
    await fireEvent.press(await button('Back'));
    expect(await screen.findByText('Add your first name.')).toBeOnTheScreen();
    expect(screen.getByLabelText('First name')).toBeOnTheScreen();
  });

  test('removing a photo below the minimum says why', async () => {
    jest
      .mocked(photos.deletePhoto)
      .mockRejectedValue(
        new Error(
          'Your profile needs at least 2 photos. Add another before removing this one.',
        ),
      );
    await openMe();
    await fireEvent.press(await button(/^Photos/));
    await fireEvent.press(await button('Photo 2'));
    await fireEvent.press(await button('Remove photo'));
    expect(
      await screen.findByText(
        'Your profile needs at least 2 photos. Add another before removing this one.',
      ),
    ).toBeOnTheScreen();
  });

  test('a Paused Member sees it on Me', async () => {
    jest
      .mocked(discover.fetchMyDiscoverState)
      .mockResolvedValue({ modes: ['friends'], paused: true });
    await openMe();
    expect(await screen.findByText('Paused')).toBeOnTheScreen();
  });
});

describe('Settings', () => {
  async function openSettings() {
    await openMe();
    await fireEvent.press(await button(/^Settings/));
    await header('Settings');
  }

  test('pausing calls set_paused and explains that chats carry on', async () => {
    await openSettings();
    expect(screen.getByText(/existing chats carry on/i)).toBeOnTheScreen();
    await fireEvent.press(
      await screen.findByRole('switch', {
        name: 'Pause my profile',
        checked: false,
      }),
    );
    await waitFor(() => expect(me.setPaused).toHaveBeenCalledWith(true));
  });

  test('a Paused Member can unpause from the same switch', async () => {
    jest
      .mocked(discover.fetchMyDiscoverState)
      .mockResolvedValue({ modes: ['friends'], paused: true });
    await openSettings();
    const toggle = await screen.findByRole('switch', {
      name: 'Pause my profile',
      checked: true,
    });
    await fireEvent.press(toggle);
    await waitFor(() => expect(me.setPaused).toHaveBeenCalledWith(false));
  });

  test('rows for features not built yet are hidden', async () => {
    await openSettings();
    for (const hidden of [
      /Delete account/,
      /Notifications/,
      /Consent/,
      /copy of my data/,
    ]) {
      expect(screen.queryByText(hidden)).toBeNull();
    }
  });

  test('blocked people are listed and can be unblocked', async () => {
    await openSettings();
    await fireEvent.press(await button(/^Blocked people/));
    await header('Blocked people');
    expect(await screen.findByText('Rohan')).toBeOnTheScreen();
    jest.mocked(me.fetchMyBlocks).mockResolvedValue([]);
    await fireEvent.press(await button('Unblock Rohan'));
    await waitFor(() => expect(me.unblock).toHaveBeenCalledWith('rohan'));
    expect(
      await screen.findByText("You haven't blocked anyone."),
    ).toBeOnTheScreen();
  });

  test('a failed unblock says so and keeps the row', async () => {
    jest
      .mocked(me.unblock)
      .mockRejectedValue(new Error("That didn't work. Try again."));
    await openSettings();
    await fireEvent.press(await button(/^Blocked people/));
    await fireEvent.press(await button('Unblock Rohan'));
    expect(
      await screen.findByText("That didn't work. Try again."),
    ).toBeOnTheScreen();
    expect(screen.getByText('Rohan')).toBeOnTheScreen();
  });
});

describe('the Safety Centre', () => {
  async function openSafety() {
    await openMe();
    await fireEvent.press(await button(/^Safety Centre/));
    await header('Safety Centre');
  }

  test('shows first-meet tips and how to report', async () => {
    await openSafety();
    expect(
      screen.getByText('Choose a public place for the first meeting.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/menu on their profile, chat or Activity/),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: /Report a problem/ }),
    ).toBeNull();
  });

  test('Call 112 dials the emergency number; Contact support writes an email', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openSafety();
    await fireEvent.press(await button('Call 112'));
    expect(open).toHaveBeenCalledWith('tel:112');
    await fireEvent.press(await button('Contact support'));
    expect(open).toHaveBeenCalledWith('mailto:support@milojulo.in');
  });

  test('Block someone opens blocked people; Pause my profile opens Settings', async () => {
    await openSafety();
    await fireEvent.press(await button(/^Block someone/));
    await header('Blocked people');
    await fireEvent.press(await button('Back'));
    await fireEvent.press(await button(/^Pause my profile/));
    await header('Settings');
  });
});

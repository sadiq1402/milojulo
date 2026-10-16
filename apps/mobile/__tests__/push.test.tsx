import { notifyManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import * as chat from '../src/features/chat/api';
import * as discover from '../src/features/discover/api';
import * as push from '../src/features/push/api';
import * as messaging from '../src/features/push/messaging';
import type { PushData } from '../src/features/push/messaging';
import { navigationRef } from '../src/navigation/navigationRef';
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
jest.mock('../src/features/push/api');
jest.mock('../src/features/push/messaging', () => ({
  requestPermission: jest.fn(),
  getToken: jest.fn(),
  onTokenRefresh: jest.fn(),
  onForegroundMessage: jest.fn(),
  onNotificationOpened: jest.fn(),
  getInitialNotification: jest.fn(),
}));

beforeAll(() =>
  notifyManager.setScheduler(callback => Promise.resolve().then(callback)),
);

let refreshed: (token: string) => void;
let foreground: (data: PushData) => void;
let opened: (data: PushData) => void;

beforeEach(() => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
  jest.mocked(activities.fetchBoard).mockResolvedValue([]);
  jest.mocked(chat.fetchConversations).mockResolvedValue([]);
  jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
    modes: ['friends'],
    paused: false,
    rangeKm: 10,
    inServiceRegion: true,
  });
  jest
    .mocked(discover.fetchFeedPage)
    .mockResolvedValue({ cards: [], nextCursor: null });
  mockProfileSetup();
  jest.mocked(push.registerDeviceToken).mockResolvedValue();
  jest.mocked(messaging.requestPermission).mockResolvedValue(true);
  jest.mocked(messaging.getToken).mockResolvedValue('tok-1');
  jest.mocked(messaging.getInitialNotification).mockResolvedValue(null);
  jest.mocked(messaging.onTokenRefresh).mockImplementation(listener => {
    refreshed = listener;
    return () => {};
  });
  jest.mocked(messaging.onForegroundMessage).mockImplementation(listener => {
    foreground = listener;
    return () => {};
  });
  jest.mocked(messaging.onNotificationOpened).mockImplementation(listener => {
    opened = listener;
    return () => {};
  });
});

const signIn = async () => {
  const app = await renderApp(sessionFor('asha@example.com'));
  await screen.findByRole('tab', { name: 'Inbox' });
  return app;
};

const route = () => navigationRef.getCurrentRoute();

describe('registering this phone', () => {
  test('a Member asks for permission, then registers the token', async () => {
    await signIn();
    await waitFor(() =>
      expect(push.registerDeviceToken).toHaveBeenCalledWith(
        'tok-1',
        Platform.OS,
      ),
    );
    expect(messaging.requestPermission).toHaveBeenCalled();
  });

  test('a new token from FCM is registered too', async () => {
    await signIn();
    await waitFor(() => expect(push.registerDeviceToken).toHaveBeenCalled());
    await act(async () => refreshed('tok-2'));
    expect(push.registerDeviceToken).toHaveBeenLastCalledWith(
      'tok-2',
      Platform.OS,
    );
  });

  test('refusing permission still registers, so turning it on later works', async () => {
    jest.mocked(messaging.requestPermission).mockResolvedValue(false);
    await signIn();
    await waitFor(() => expect(push.registerDeviceToken).toHaveBeenCalled());
  });

  test('nobody registers before they are a Member', async () => {
    jest.mocked(account.fetchAccountStage).mockResolvedValue('consent');
    await renderApp(sessionFor('asha@example.com'));
    await waitFor(() => expect(account.fetchAccountStage).toHaveBeenCalled());
    await screen.findAllByText(/18/);
    expect(messaging.getToken).not.toHaveBeenCalled();
    expect(push.registerDeviceToken).not.toHaveBeenCalled();
  });

  test('a failed registration is not shown and does not break the app', async () => {
    jest
      .mocked(push.registerDeviceToken)
      .mockRejectedValue(new Error('create your profile first'));
    await signIn();
    await waitFor(() => expect(push.registerDeviceToken).toHaveBeenCalled());
    expect(screen.queryByText(/create your profile first/)).toBeNull();
  });
});

describe('tapping a notification', () => {
  test.each([
    [{ kind: 'message', connectionId: 'c1' }, 'Chat', { connectionId: 'c1' }],
    [{ kind: 'accepted', connectionId: 'c2' }, 'Chat', { connectionId: 'c2' }],
    [
      { kind: 'join_request', activityId: 'a1' },
      'ActivityDetail',
      { activityId: 'a1' },
    ],
    [
      { kind: 'join_accepted', activityId: 'a2' },
      'ActivityDetail',
      { activityId: 'a2' },
    ],
  ])('%p opens %s', async (data, name, params) => {
    await signIn();
    await act(async () => opened(data));
    await waitFor(() => expect(route()).toMatchObject({ name, params }));
  });

  test('a request opens the Inbox on Requests, even if Chats was showing', async () => {
    await signIn();
    await fireEvent.press(screen.getByRole('tab', { name: 'Inbox' }));
    await fireEvent.press(await screen.findByRole('tab', { name: 'Chats' }));
    await act(async () => opened({ kind: 'request', connectionId: 'c1' }));
    await waitFor(() => expect(route()?.name).toBe('Inbox'));
    expect(
      screen.getByRole('tab', { name: 'Requests', selected: true }),
    ).toBeOnTheScreen();
  });

  test('the tap that opened the app from quit is followed', async () => {
    jest
      .mocked(messaging.getInitialNotification)
      .mockResolvedValue({ kind: 'message', connectionId: 'c9' });
    await renderApp(sessionFor('asha@example.com'));
    await waitFor(() =>
      expect(route()).toMatchObject({
        name: 'Chat',
        params: { connectionId: 'c9' },
      }),
    );
  });

  test('a tap that arrives before navigation is ready is followed once it is', async () => {
    jest
      .mocked(messaging.getInitialNotification)
      .mockResolvedValue({ kind: 'message', connectionId: 'c9' });
    jest.spyOn(navigationRef, 'isReady').mockReturnValueOnce(false);
    await renderApp(sessionFor('asha@example.com'));
    await screen.findByRole('tab', { name: 'Inbox' });
    // Any later navigation state change makes the container ready.
    await fireEvent.press(screen.getByRole('tab', { name: 'Inbox' }));
    await waitFor(() =>
      expect(route()).toMatchObject({
        name: 'Chat',
        params: { connectionId: 'c9' },
      }),
    );
  });

  test('an unknown kind goes nowhere', async () => {
    await signIn();
    await act(async () => opened({ kind: 'mystery' }));
    expect(route()?.name).toBe('Discover');
  });
});

describe('a notification while the app is open', () => {
  test('a message refreshes the chats instead of showing anything', async () => {
    await signIn();
    await waitFor(() => expect(chat.fetchConversations).toHaveBeenCalled());
    const before = jest.mocked(chat.fetchConversations).mock.calls.length;
    await act(async () => foreground({ kind: 'message', connectionId: 'c1' }));
    await waitFor(() =>
      expect(
        jest.mocked(chat.fetchConversations).mock.calls.length,
      ).toBeGreaterThan(before),
    );
    expect(route()?.name).toBe('Discover');
  });

  test('a join request refreshes my join requests', async () => {
    await signIn();
    await waitFor(() =>
      expect(activities.fetchMyJoinRequests).toHaveBeenCalled(),
    );
    const before = jest.mocked(activities.fetchMyJoinRequests).mock.calls
      .length;
    await act(async () =>
      foreground({ kind: 'join_request', activityId: 'a' }),
    );
    await waitFor(() =>
      expect(
        jest.mocked(activities.fetchMyJoinRequests).mock.calls.length,
      ).toBeGreaterThan(before),
    );
  });
});

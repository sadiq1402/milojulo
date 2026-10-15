import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyManager } from '@tanstack/react-query';
import { AppState, Linking } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import * as chat from '../src/features/chat/api';
import * as discover from '../src/features/discover/api';
import * as location from '../src/features/location/api';
import * as device from '../src/features/location/device';
import { clock } from '../src/features/location/prompt';
import { mockProfileSetup } from '../test/profileSetup';
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

const day = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 9, 15, 10);
let now = start;
let permission: boolean | undefined;
let appStateListeners: ((state: string) => void)[] = [];

beforeAll(() =>
  notifyManager.setScheduler(callback => Promise.resolve().then(callback)),
);

beforeEach(async () => {
  await AsyncStorage.clear();
  now = start;
  permission = false;
  appStateListeners = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener) => {
      appStateListeners.push(listener as (state: string) => void);
      return { remove: () => {} };
    });
  jest.spyOn(clock, 'now').mockImplementation(() => now);
  jest
    .spyOn(device, 'hasPermission')
    .mockImplementation(async () => permission);
  jest.spyOn(device, 'requestPermission').mockImplementation(async () => {
    permission = true;
    return true;
  });
  jest
    .spyOn(device, 'currentPosition')
    .mockResolvedValue({ lat: 18.59, lng: 73.76 });
  jest.mocked(location.setLocation).mockResolvedValue();
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
  jest.mocked(chat.fetchConversations).mockResolvedValue([]);
  jest
    .mocked(discover.fetchMyDiscoverState)
    .mockResolvedValue({ modes: ['friends'], paused: false });
  jest
    .mocked(discover.fetchFeedPage)
    .mockResolvedValue({ cards: [], nextCursor: null });
  mockProfileSetup({ displayName: 'Asha', areaId: 'wakad' });
});

const open = () => renderApp(sessionFor('asha@example.com'));
const header = (name: string) => screen.findByRole('header', { name });
const button = (name: string) => screen.findByRole('button', { name });
const tabs = () => screen.findByRole('tab', { name: 'Me' });

test('a Member is asked for location, and allowing sends it', async () => {
  await open();
  expect(await header('See who’s nearby')).toBeOnTheScreen();
  expect(screen.getByText(/never in the background/)).toBeOnTheScreen();
  await fireEvent.press(await button('Allow location'));
  expect(await tabs()).toBeOnTheScreen();
  await waitFor(() =>
    expect(location.setLocation).toHaveBeenCalledWith(18.59, 73.76),
  );
});

test('refusing in the phone dialog shows the area fallback once', async () => {
  jest.spyOn(device, 'requestPermission').mockResolvedValue(false);
  const app = await open();
  await fireEvent.press(await button('Allow location'));
  expect(await header('Using your area instead')).toBeOnTheScreen();
  expect(screen.getByText('Wakad')).toBeOnTheScreen();
  await fireEvent.press(await button('Continue with Wakad'));
  expect(await tabs()).toBeOnTheScreen();
  expect(location.setLocation).not.toHaveBeenCalled();

  await app.unmount();
  now = start + 30 * day;
  await open();
  expect(await tabs()).toBeOnTheScreen();
  expect(screen.queryByText('See who’s nearby')).toBeNull();
});

test('the fallback can open the phone settings', async () => {
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  await open();
  await fireEvent.press(await button('Not now'));
  await fireEvent.press(await button('Turn on in Settings'));
  expect(openSettings).toHaveBeenCalled();
  expect(await tabs()).toBeOnTheScreen();
});

test('after "Not now" the prompt comes back once, a week later', async () => {
  let app = await open();
  await fireEvent.press(await button('Not now'));
  await fireEvent.press(await button('Continue with Wakad'));
  await tabs();

  await app.unmount();
  now = start + 6 * day;
  app = await open();
  expect(await tabs()).toBeOnTheScreen();
  expect(screen.queryByText('See who’s nearby')).toBeNull();

  await app.unmount();
  now = start + 7 * day;
  app = await open();
  await fireEvent.press(await button('Not now'));
  // The area fallback was already shown once.
  expect(await tabs()).toBeOnTheScreen();

  await app.unmount();
  now = start + 60 * day;
  await open();
  expect(await tabs()).toBeOnTheScreen();
  expect(screen.queryByText('See who’s nearby')).toBeNull();
});

test('with permission already given there is no prompt, and location is refreshed at most every few hours', async () => {
  permission = true;
  await open();
  expect(await tabs()).toBeOnTheScreen();
  expect(screen.queryByText('See who’s nearby')).toBeNull();
  await waitFor(() => expect(location.setLocation).toHaveBeenCalledTimes(1));

  const comeBack = () =>
    act(async () => appStateListeners.forEach(listener => listener('active')));
  now = start + 60 * 60 * 1000;
  await comeBack();
  expect(location.setLocation).toHaveBeenCalledTimes(1);

  now = start + 3 * 60 * 60 * 1000;
  await comeBack();
  await waitFor(() => expect(location.setLocation).toHaveBeenCalledTimes(2));
});

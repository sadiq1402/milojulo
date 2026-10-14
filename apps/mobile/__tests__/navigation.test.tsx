import { fireEvent, screen } from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import * as chat from '../src/features/chat/api';
import { mockProfileSetup } from '../test/profileSetup';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/auth/api');
jest.mock('../src/features/account/api');
jest.mock('../src/features/consents/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/activities/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/photos/api');
jest.mock('../src/features/profileSetup/api');
// Profile setup loads the draft, photos and catalogs whenever it opens.
beforeEach(() => mockProfileSetup());

test('a signed-out visitor starts at welcome', async () => {
  await renderApp(null);
  expect(
    await screen.findByRole('button', { name: 'Get started' }),
  ).toBeOnTheScreen();
});

test('a signed-in account without date of birth and consents starts there', async () => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('consent');
  await renderApp(sessionFor('asha@example.com'));
  expect(
    await screen.findByRole('header', { name: 'Before we start' }),
  ).toBeOnTheScreen();
});

test('a Member who has given consent but not built a profile resumes at profile setup', async () => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('profile');
  await renderApp(sessionFor('asha@example.com'));
  expect(
    await screen.findByRole('header', { name: 'What should we call you?' }),
  ).toBeOnTheScreen();
});

test('a Member with a Submitted Profile lands on Discover and can switch tabs', async () => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(chat.fetchConversations).mockResolvedValue([]);
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
  await renderApp(sessionFor('asha@example.com'));
  expect(
    await screen.findByRole('tab', { name: 'Discover', selected: true }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('tab', { name: 'Inbox' }));
  expect(
    await screen.findByRole('tab', { name: 'Inbox', selected: true }),
  ).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Inbox' })).toBeOnTheScreen();
  expect(await screen.findByText(/No requests waiting/)).toBeOnTheScreen();
});

test('when the account cannot be loaded the app offers a retry', async () => {
  jest
    .mocked(account.fetchAccountStage)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue('member');
  await renderApp(sessionFor('asha@example.com'));
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Try again' }),
  );
  expect(
    await screen.findByRole('tab', { name: 'Discover', selected: true }),
  ).toBeOnTheScreen();
});

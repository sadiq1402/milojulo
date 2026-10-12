import { fireEvent, screen } from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/auth/api');
jest.mock('../src/features/account/api');

test('a signed-out visitor starts at welcome', async () => {
  await renderApp(null);
  expect(
    await screen.findByRole('button', { name: 'I have an invite code' }),
  ).toBeOnTheScreen();
});

test('a Member who has given consent but not built a profile resumes at profile setup', async () => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('profile');
  await renderApp(sessionFor('asha@example.com'));
  expect(
    await screen.findByRole('header', { name: 'Set up your profile' }),
  ).toBeOnTheScreen();
});

test('a Member with a Submitted Profile lands on Discover and can switch tabs', async () => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  await renderApp(sessionFor('asha@example.com'));
  expect(
    await screen.findByRole('tab', { name: 'Discover', selected: true }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('tab', { name: 'Inbox' }));
  expect(
    await screen.findByRole('tab', { name: 'Inbox', selected: true }),
  ).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Inbox' })).toBeOnTheScreen();
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

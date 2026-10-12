import { fireEvent, screen } from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as hello from '../src/features/hello/api';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/auth/api');
jest.mock('../src/features/account/api');
jest.mock('../src/features/hello/api');

test('a signed-out visitor is asked for their email', async () => {
  await renderApp(null);
  expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Send code' })).toBeOnTheScreen();
});

test('a signed-in account still onboarding sees the hello screen with its account checked', async () => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('onboarding');
  jest.mocked(hello.fetchIsAdmin).mockResolvedValue(false);
  await renderApp(sessionFor('asha@example.com'));
  expect(await screen.findByText('Member account')).toBeOnTheScreen();
  expect(screen.getByText('Signed in as asha@example.com')).toBeOnTheScreen();
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

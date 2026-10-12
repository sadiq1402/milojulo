import { fireEvent, screen } from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as auth from '../src/features/auth/api';
import * as hello from '../src/features/hello/api';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/auth/api');
jest.mock('../src/features/account/api');
jest.mock('../src/features/hello/api');

test('a visitor gets a code by email and signs in with it', async () => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('onboarding');
  jest.mocked(hello.fetchIsAdmin).mockResolvedValue(false);
  jest.mocked(auth.sendCode).mockResolvedValue();
  const { setSession } = await renderApp(null);
  jest
    .mocked(auth.verifyCode)
    .mockImplementation(async (email: string) => setSession(sessionFor(email)));

  await fireEvent.changeText(
    await screen.findByLabelText('Email'),
    ' asha@example.com ',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await fireEvent.changeText(await screen.findByLabelText('Code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  expect(
    await screen.findByText('Signed in as asha@example.com'),
  ).toBeOnTheScreen();
  expect(auth.sendCode).toHaveBeenCalledWith('asha@example.com');
  expect(auth.verifyCode).toHaveBeenCalledWith('asha@example.com', '123456');
});

test('sign in waits for all six digits', async () => {
  jest.mocked(auth.sendCode).mockResolvedValue();
  await renderApp(null);
  await fireEvent.changeText(
    await screen.findByLabelText('Email'),
    'asha@example.com',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await fireEvent.changeText(await screen.findByLabelText('Code'), '12345');
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
});

test('a refused email shows why', async () => {
  jest
    .mocked(auth.sendCode)
    .mockRejectedValue(new Error('Email rate limit exceeded'));
  await renderApp(null);
  await fireEvent.changeText(
    await screen.findByLabelText('Email'),
    'asha@example.com',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  expect(
    await screen.findByText('Email rate limit exceeded'),
  ).toBeOnTheScreen();
  expect(screen.queryByLabelText('Code')).not.toBeOnTheScreen();
});

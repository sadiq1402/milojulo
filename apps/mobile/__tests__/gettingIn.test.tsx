import { fireEvent, screen } from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as auth from '../src/features/auth/api';
import * as consents from '../src/features/consents/api';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/consents/api');

const documents = {
  terms: { id: 't1', url: null },
  guidelines: { id: 'g1', url: null },
  data_notice: { id: 'd1', url: null },
};

describe('welcome', () => {
  test('pitches MiloJulo as open, without promising that a person reviews profiles', async () => {
    await renderApp(null);
    expect(
      await screen.findByText(
        'Meet people in Pune who want the same kind of hangout.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Now open in Pune.')).toBeOnTheScreen();
    expect(screen.queryByText(/invite/i)).not.toBeOnTheScreen();
    expect(screen.queryByText(/reviewed by a person/)).not.toBeOnTheScreen();
  });

  test('one way in, for new and returning people alike', async () => {
    await renderApp(null);
    expect(
      await screen.findByRole('button', { name: 'Get started' }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'I already have an account' }),
    ).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    expect(
      await screen.findByRole('header', { name: "What's your email?" }),
    ).toBeOnTheScreen();
  });
});

test('a new person signs in by email, then gives age and consent', async () => {
  jest.mocked(auth.sendCode).mockResolvedValue();
  jest.mocked(account.fetchAccountStage).mockResolvedValue('consent');
  jest.mocked(consents.fetchConsentDocuments).mockResolvedValue(documents);
  const { setSession } = await renderApp(null);
  jest
    .mocked(auth.verifyCode)
    .mockImplementation(async (email: string) => setSession(sessionFor(email)));

  await fireEvent.press(
    await screen.findByRole('button', { name: 'Get started' }),
  );
  await fireEvent.changeText(
    await screen.findByLabelText('Email address'),
    'asha@example.com',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  expect(
    await screen.findByText(
      'Enter the 6-digit code we sent to asha@example.com.',
    ),
  ).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('6-digit code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));

  expect(
    await screen.findByRole('header', { name: 'Before we start' }),
  ).toBeOnTheScreen();
  expect(auth.verifyCode).toHaveBeenCalledWith('asha@example.com', '123456');
});

describe('6-digit code', () => {
  async function openCodeScreen() {
    jest.mocked(auth.sendCode).mockResolvedValue();
    await renderApp(null);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Get started' }),
    );
    await fireEvent.changeText(
      await screen.findByLabelText('Email address'),
      'asha@example.com',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByLabelText('6-digit code');
  }

  test('verify waits for all six digits', async () => {
    await openCodeScreen();
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '12345');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
  });

  test('a new code can be sent after 30 seconds', async () => {
    await openCodeScreen();
    expect(screen.getByText("Didn't get it? Resend in 0:30")).toBeOnTheScreen();
    // Real timers with the clock moved on (fake timers hang on Node 22): the next
    // one-second tick sees the deadline has passed.
    const later = Date.now() + 31_000;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(later);
    try {
      await fireEvent.press(
        await screen.findByRole(
          'button',
          { name: 'Resend code' },
          { timeout: 2000 },
        ),
      );
      expect(auth.sendCode).toHaveBeenCalledTimes(2);
      expect(
        await screen.findByText("Didn't get it? Resend in 0:30"),
      ).toBeOnTheScreen();
    } finally {
      clock.mockRestore();
    }
  });

  test('a wrong code shows why', async () => {
    jest
      .mocked(auth.verifyCode)
      .mockRejectedValue(new Error('That code is wrong or has expired.'));
    await openCodeScreen();
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '000000');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));
    expect(
      await screen.findByText('That code is wrong or has expired.'),
    ).toBeOnTheScreen();
  });
});

describe('date of birth and consents', () => {
  async function openConsentScreen() {
    jest
      .mocked(account.fetchAccountStage)
      .mockResolvedValueOnce('consent')
      .mockResolvedValue('profile');
    jest.mocked(consents.fetchConsentDocuments).mockResolvedValue(documents);
    await renderApp(sessionFor('asha@example.com'));
    await screen.findByRole('header', { name: 'Before we start' });
  }

  async function fillIn(day: string, month: string, year: string) {
    await fireEvent.changeText(screen.getByLabelText('Day'), day);
    await fireEvent.changeText(screen.getByLabelText('Month'), month);
    await fireEvent.changeText(screen.getByLabelText('Year'), year);
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'I agree to this use of my data' }),
    );
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'I accept the Terms and the Community Guidelines',
      }),
    );
  }

  test('continue waits for a date of birth and both agreements', async () => {
    await openConsentScreen();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Day'), '21');
    await fireEvent.changeText(screen.getByLabelText('Month'), '3');
    await fireEvent.changeText(screen.getByLabelText('Year'), '1998');
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'I agree to this use of my data' }),
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  test('accepting sends the date and every current document, then opens profile setup', async () => {
    jest.mocked(consents.acceptConsents).mockResolvedValue();
    await openConsentScreen();
    await fillIn('21', '3', '1998');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByRole('header', { name: 'Set up your profile' }),
    ).toBeOnTheScreen();
    expect(consents.acceptConsents).toHaveBeenCalledWith(
      '1998-03-21',
      documents,
    );
  });

  test('a date that does not exist is caught before sending', async () => {
    await openConsentScreen();
    await fillIn('31', '2', '2000');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Enter a real date of birth.'),
    ).toBeOnTheScreen();
    expect(consents.acceptConsents).not.toHaveBeenCalled();
  });

  test('someone under 18 sees the refusal', async () => {
    jest
      .mocked(consents.acceptConsents)
      .mockRejectedValue(
        new Error('You need to be 18 or older to use MiloJulo.'),
      );
    await openConsentScreen();
    await fillIn('1', '1', '2015');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('You need to be 18 or older to use MiloJulo.'),
    ).toBeOnTheScreen();
  });
});

test('signing out from profile setup returns to welcome', async () => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('profile');
  const { setSession } = await renderApp(sessionFor('asha@example.com'));
  jest.mocked(auth.signOut).mockImplementation(async () => setSession(null));
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Sign out' }),
  );
  expect(
    await screen.findByText(
      'Meet people in Pune who want the same kind of hangout.',
    ),
  ).toBeOnTheScreen();
});

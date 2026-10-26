import { notifyManager } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import * as auth from '../src/features/auth/api';
import * as chat from '../src/features/chat/api';
import * as consents from '../src/features/consents/api';
import * as discover from '../src/features/discover/api';
import * as me from '../src/features/me/api';
import * as profileSetup from '../src/features/profileSetup/api';
import { mockProfileSetup } from '../test/profileSetup';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/activities/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/consents/api');
jest.mock('../src/features/discover/api');
jest.mock('../src/features/photos/api');
jest.mock('../src/features/profileSetup/api');
jest.mock('../src/features/me/api', () => ({
  ...jest.requireActual('../src/features/me/api'),
  setPaused: jest.fn(),
  fetchMyBlocks: jest.fn(),
}));

const documents = {
  terms: { id: 't1', url: null },
  guidelines: { id: 'g1', url: null },
  data_notice: { id: 'd1', url: 'https://milojulo.co.in/data-notice' },
};

const accepted = (documentId: string, kind: consents.ConsentKind) => ({
  documentId,
  kind,
  version: '1',
  acceptedAt: '2026-10-01T10:00:00Z',
  withdrawnAt: null,
});

beforeAll(() =>
  notifyManager.setScheduler(callback => Promise.resolve().then(callback)),
);

beforeEach(() => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest
    .mocked(account.fetchMyConsents)
    .mockResolvedValue([
      accepted('t1', 'terms'),
      accepted('g1', 'guidelines'),
      accepted('d1', 'data_notice'),
    ]);
  jest.mocked(account.fetchDataRequests).mockResolvedValue([]);
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
  jest.mocked(chat.fetchConversations).mockResolvedValue([]);
  jest.mocked(consents.fetchConsentDocuments).mockResolvedValue(documents);
  jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
    modes: ['friends'],
    paused: false,
    rangeKm: 10,
    inServiceRegion: true,
  });
  jest
    .mocked(discover.fetchFeedPage)
    .mockResolvedValue({ cards: [], nextCursor: null });
  jest.mocked(me.setPaused).mockResolvedValue();
  jest.mocked(me.fetchMyBlocks).mockResolvedValue([]);
  mockProfileSetup({ displayName: 'Asha', birthDate: '1998-03-21' });
});

const header = (name: string) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.findByRole('button', { name });

async function openSettings() {
  const app = await renderApp(sessionFor('asha@example.com'));
  jest
    .mocked(auth.signOut)
    .mockImplementation(async () => app.setSession(null));
  await fireEvent.press(await screen.findByRole('tab', { name: 'Me' }));
  await fireEvent.press(await button(/^Settings/));
  await header('Settings');
  return app;
}

test('Settings has rows for consent settings, a copy of my data and deleting the account', async () => {
  await openSettings();
  expect(await button('Consent settings')).toBeOnTheScreen();
  expect(await button('Request a copy of my data')).toBeOnTheScreen();
  expect(await button('Delete account')).toBeOnTheScreen();
});

describe('consent settings', () => {
  async function openConsents() {
    await openSettings();
    await fireEvent.press(await button('Consent settings'));
    await header('Consent settings');
  }

  test('lists each accepted document with a way to withdraw it', async () => {
    await openConsents();
    for (const name of ['Terms', 'Community Guidelines', 'Data notice']) {
      expect(await button(`Withdraw ${name}`)).toBeOnTheScreen();
    }
  });

  test('withdrawing explains what stops working, then sends me to accept again or delete', async () => {
    jest.mocked(account.withdrawConsent).mockImplementation(async () => {
      jest.mocked(account.fetchAccountStage).mockResolvedValue('reconsent');
    });
    await openConsents();
    await fireEvent.press(await button('Withdraw Terms'));
    expect(
      await screen.findByText(/hidden from everyone until you accept again/),
    ).toBeOnTheScreen();
    expect(account.withdrawConsent).not.toHaveBeenCalled();
    await fireEvent.press(await button('Withdraw'));
    expect(await header('Accept to carry on')).toBeOnTheScreen();
    expect(account.withdrawConsent).toHaveBeenCalledWith('t1');
    expect(await button('Delete my account instead')).toBeOnTheScreen();
  });

  test('keeping the consent closes the sheet without withdrawing', async () => {
    await openConsents();
    await fireEvent.press(await button('Withdraw Terms'));
    await fireEvent.press(await button('Keep it'));
    await waitFor(() =>
      expect(screen.queryByText(/until you accept again/)).toBeNull(),
    );
    expect(account.withdrawConsent).not.toHaveBeenCalled();
  });

  test('a refused withdrawal shows why', async () => {
    jest
      .mocked(account.withdrawConsent)
      .mockRejectedValue(new Error("You've already withdrawn this consent."));
    await openConsents();
    await fireEvent.press(await button('Withdraw Terms'));
    await fireEvent.press(await button('Withdraw'));
    expect(
      await screen.findByText("You've already withdrawn this consent."),
    ).toBeOnTheScreen();
  });
});

describe('accepting again after withdrawing', () => {
  async function openReconsent(heading = 'Accept to carry on') {
    jest.mocked(account.fetchAccountStage).mockResolvedValue('reconsent');
    const app = await renderApp(sessionFor('asha@example.com'));
    jest
      .mocked(auth.signOut)
      .mockImplementation(async () => app.setSession(null));
    await header(heading);
  }

  test('an updated privacy notice explains the change on the same screen', async () => {
    jest.mocked(account.fetchAccountStage).mockResolvedValue('updatedNotice');
    await renderApp(sessionFor('asha@example.com'));
    expect(await header('Accept to carry on')).toBeOnTheScreen();
    expect(
      screen.getByText(/Our privacy notice has changed: we now use your phone/),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/You withdrew a consent/)).toBeNull();
    expect(await button('Delete my account instead')).toBeOnTheScreen();
  });

  test('accepting again keeps my date of birth and brings me back as a Member', async () => {
    jest.mocked(consents.acceptConsents).mockImplementation(async () => {
      jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
    });
    await openReconsent();
    expect(screen.queryByLabelText('Day')).toBeNull();
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'I agree to this use of my data' }),
    );
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'I accept the Terms and the Community Guidelines',
      }),
    );
    await fireEvent.press(await button('Continue'));
    expect(await screen.findByRole('tab', { name: 'Me' })).toBeOnTheScreen();
    expect(consents.acceptConsents).toHaveBeenCalledWith(
      '1998-03-21',
      documents,
    );
  });

  test('without a stored date of birth it asks for one', async () => {
    mockProfileSetup({ displayName: 'Asha', birthDate: null });
    jest.mocked(consents.acceptConsents).mockResolvedValue();
    await openReconsent('Before we start');
    expect(await screen.findByLabelText('Day')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Day'), '21');
    await fireEvent.changeText(screen.getByLabelText('Month'), '3');
    await fireEvent.changeText(screen.getByLabelText('Year'), '1998');
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'I agree to this use of my data' }),
    );
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'I accept the Terms and the Community Guidelines',
      }),
    );
    await fireEvent.press(await button('Continue'));
    await waitFor(() =>
      expect(consents.acceptConsents).toHaveBeenCalledWith(
        '1998-03-21',
        documents,
      ),
    );
  });

  test('if my profile cannot load it offers a retry', async () => {
    jest.mocked(profileSetup.fetchDraft).mockRejectedValue(new Error('x'));
    jest.mocked(account.fetchAccountStage).mockResolvedValue('reconsent');
    await renderApp(sessionFor('asha@example.com'));
    await fireEvent.press(await button('Try again'));
    await waitFor(() =>
      expect(profileSetup.fetchDraft).toHaveBeenCalledTimes(2),
    );
  });

  test('or I delete my account from there', async () => {
    jest.mocked(account.deleteAccount).mockResolvedValue();
    await openReconsent();
    await fireEvent.press(await button('Delete my account instead'));
    await header('Delete your account?');
    expect(
      screen.queryByRole('button', { name: 'Pause my profile instead' }),
    ).toBeNull();
    await fireEvent.changeText(
      screen.getByLabelText('Type DELETE to confirm'),
      'DELETE',
    );
    await fireEvent.press(await button('Delete my account'));
    expect(
      await screen.findByText(
        'Meet people in Pune who want the same kind of hangout.',
      ),
    ).toBeOnTheScreen();
    expect(account.deleteAccount).toHaveBeenCalled();
  });
});

describe('a copy of my data', () => {
  async function openDataCopy() {
    await openSettings();
    await fireEvent.press(await button('Request a copy of my data'));
    await header('Your data');
  }

  test('asking creates the request and shows it in progress', async () => {
    jest.mocked(account.requestDataCopy).mockImplementation(async () => {
      jest.mocked(account.fetchDataRequests).mockResolvedValue([
        {
          id: 'r1',
          kind: 'access',
          status: 'pending',
          createdAt: '2026-10-16T10:00:00Z',
          completedAt: null,
        },
      ]);
      return 'r1';
    });
    await openDataCopy();
    await fireEvent.press(await button('Request a copy'));
    expect(
      await screen.findByText(/We'll email it to you when it's ready/),
    ).toBeOnTheScreen();
    expect(account.requestDataCopy).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Request a copy' })).toBeNull();
  });

  test('a finished request says it was sent, and I can ask again', async () => {
    jest.mocked(account.fetchDataRequests).mockResolvedValue([
      {
        id: 'r1',
        kind: 'access',
        status: 'done',
        createdAt: '2026-09-01T10:00:00Z',
        completedAt: '2026-09-10T10:00:00Z',
      },
    ]);
    await openDataCopy();
    expect(
      await screen.findByText(/sent to your email on 10 Sep 2026/),
    ).toBeOnTheScreen();
    expect(await button('Request a copy')).toBeOnTheScreen();
  });

  test('a refused request shows why', async () => {
    jest
      .mocked(account.requestDataCopy)
      .mockRejectedValue(new Error("You've already asked for a copy."));
    await openDataCopy();
    await fireEvent.press(await button('Request a copy'));
    expect(
      await screen.findByText("You've already asked for a copy."),
    ).toBeOnTheScreen();
  });
});

describe('deleting the account', () => {
  async function openDelete() {
    await openSettings();
    await fireEvent.press(await button('Delete account'));
    await header('Delete your account?');
  }

  test('waits for DELETE, deletes, then signs out', async () => {
    jest.mocked(account.deleteAccount).mockResolvedValue();
    await openDelete();
    const field = screen.getByLabelText('Type DELETE to confirm');
    await fireEvent.changeText(field, 'delete');
    expect(
      screen.getByRole('button', { name: 'Delete my account' }),
    ).toBeDisabled();
    await fireEvent.changeText(field, 'DELETE');
    await fireEvent.press(await button('Delete my account'));
    expect(
      await screen.findByText(
        'Meet people in Pune who want the same kind of hangout.',
      ),
    ).toBeOnTheScreen();
    expect(account.deleteAccount).toHaveBeenCalled();
    expect(auth.signOut).toHaveBeenCalled();
  });

  test('signing out forgets everything the account loaded', async () => {
    jest.mocked(account.deleteAccount).mockResolvedValue();
    const app = await openSettings();
    await fireEvent.press(await button('Delete account'));
    await header('Delete your account?');
    expect(app.client.getQueryCache().getAll().length).toBeGreaterThan(0);
    await fireEvent.changeText(
      screen.getByLabelText('Type DELETE to confirm'),
      'DELETE',
    );
    await fireEvent.press(await button('Delete my account'));
    await screen.findByText(
      'Meet people in Pune who want the same kind of hangout.',
    );
    expect(app.client.getQueryData(['my-consents'])).toBeUndefined();
    expect(
      app.client
        .getQueryCache()
        .getAll()
        .filter(query => query.state.data !== undefined),
    ).toEqual([]);
  });

  test('links to how we handle my data', async () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openSettings();
    await fireEvent.press(await button('Delete account'));
    await fireEvent.press(
      await screen.findByRole('link', { name: 'Read how we handle your data' }),
    );
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://milojulo.co.in/data-notice',
    );
  });

  test('says messages go for both sides', async () => {
    await openSettings();
    await fireEvent.press(await button('Delete account'));
    expect(
      await screen.findByText(/messages are removed for both sides/),
    ).toBeOnTheScreen();
  });

  test('a failed delete says so and keeps me signed in', async () => {
    jest
      .mocked(account.deleteAccount)
      .mockRejectedValue(
        new Error("That didn't work. Check your connection and try again."),
      );
    await openDelete();
    await fireEvent.changeText(
      screen.getByLabelText('Type DELETE to confirm'),
      'DELETE',
    );
    await fireEvent.press(await button('Delete my account'));
    expect(await screen.findByText(/That didn't work/)).toBeOnTheScreen();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  test('pausing instead pauses my profile and goes back to Settings', async () => {
    await openDelete();
    await fireEvent.press(await button('Pause my profile instead'));
    await header('Settings');
    expect(me.setPaused).toHaveBeenCalledWith(true);
    expect(account.deleteAccount).not.toHaveBeenCalled();
  });
});

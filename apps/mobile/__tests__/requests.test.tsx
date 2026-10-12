import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as account from '../src/features/account/api';
import * as catalog from '../src/features/catalog/api';
import * as chat from '../src/features/chat/api';
import type { Conversation } from '../src/features/chat/api';
import { chatKeys } from '../src/features/chat/queries';
import type { Mode } from '../src/features/modes';
import * as requests from '../src/features/requests/api';
import { SendRequestSheet } from '../src/screens/requests/SendRequestSheet';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/requests/api', () => ({
  ...jest.requireActual('../src/features/requests/api'),
  sendRequest: jest.fn(),
  respondRequest: jest.fn(),
}));

const me = sessionFor('asha@example.com');

const conversation = (overrides: Partial<Conversation>): Conversation => ({
  connectionId: 'conn-rohan',
  otherId: 'rohan',
  otherName: 'Rohan',
  otherPhotoId: null,
  otherAreaId: 'wakad',
  mode: 'friends',
  status: 'requested',
  direction: 'incoming',
  note: 'Up for a Sinhagad trek this weekend?',
  lastMessage: null,
  unreadCount: 0,
  ...overrides,
});

const rohan = conversation({});
const anaya = conversation({
  connectionId: 'conn-anaya',
  otherId: 'anaya',
  otherName: 'Anaya',
  note: null,
});
const meera = conversation({
  connectionId: 'conn-meera',
  otherId: 'meera',
  otherName: 'Meera',
  direction: 'outgoing',
});
const isha = conversation({
  connectionId: 'conn-isha',
  otherId: 'isha',
  otherName: 'Isha',
  status: 'accepted',
  note: null,
});

beforeEach(() => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(catalog.fetchAreaNames).mockResolvedValue({ wakad: 'Wakad' });
  jest
    .mocked(chat.fetchConversations)
    .mockResolvedValue([rohan, anaya, meera, isha]);
  jest.mocked(chat.fetchMessages).mockResolvedValue([]);
  jest
    .mocked(chat.fetchChatState)
    .mockResolvedValue({ otherLastReadAt: null, muted: false });
  jest.mocked(chat.subscribeToChat).mockReturnValue(() => {});
  jest.mocked(chat.fetchOpenModeChange).mockResolvedValue(null);
  jest.mocked(requests.respondRequest).mockResolvedValue();
});

async function openInbox() {
  const app = await renderApp(me);
  await fireEvent.press(await screen.findByRole('tab', { name: /^Inbox/ }));
  // Let the area names land too before the test goes on.
  await screen.findAllByText('Wakad');
  return app;
}

describe('Inbox requests', () => {
  test('opens on Requests: incoming ones wait for an answer, sent ones show as pending', async () => {
    await openInbox();
    expect(
      screen.getByRole('tab', { name: 'Requests', selected: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Waiting for you')).toBeOnTheScreen();
    expect(
      screen.getByText('Up for a Sinhagad trek this weekend?'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Accept Rohan' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Decline Anaya' }),
    ).toBeOnTheScreen();
    const sent = within(screen.getByTestId('sent-requests'));
    expect(sent.getByText('Meera')).toBeOnTheScreen();
    expect(sent.getByText('Pending')).toBeOnTheScreen();
    expect(screen.queryByText('Isha')).not.toBeOnTheScreen();
  });

  test('the Inbox tab shows how many requests are waiting', async () => {
    await renderApp(me);
    expect(
      await screen.findByRole('tab', { name: 'Inbox, 2 waiting' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('2')).toBeOnTheScreen();
  });

  test('accepting a request opens the chat', async () => {
    await openInbox();
    jest
      .mocked(chat.fetchConversations)
      .mockResolvedValue([{ ...rohan, status: 'accepted' }, anaya, meera]);
    await fireEvent.press(screen.getByRole('button', { name: 'Accept Rohan' }));
    expect(requests.respondRequest).toHaveBeenCalledWith('conn-rohan', true);
    expect(await screen.findByLabelText('Chat menu')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Rohan' })).toBeOnTheScreen();
  });

  test('declining a request removes it', async () => {
    await openInbox();
    jest.mocked(chat.fetchConversations).mockResolvedValue([anaya, meera]);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Decline Rohan' }),
    );
    expect(requests.respondRequest).toHaveBeenCalledWith('conn-rohan', false);
    await waitFor(() =>
      expect(screen.queryByText('Rohan')).not.toBeOnTheScreen(),
    );
    expect(
      await screen.findByRole('tab', { name: 'Inbox, 1 waiting' }),
    ).toBeOnTheScreen();
  });

  test('an answer that fails says so on the card', async () => {
    jest
      .mocked(requests.respondRequest)
      .mockRejectedValue(
        new Error('This request is no longer waiting for an answer.'),
      );
    await openInbox();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Decline Rohan' }),
    );
    expect(
      await screen.findByText(
        'This request is no longer waiting for an answer.',
      ),
    ).toBeOnTheScreen();
  });

  test('with no requests, says how they arrive', async () => {
    jest.mocked(chat.fetchConversations).mockResolvedValue([isha]);
    await renderApp(me);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Inbox' }));
    expect(
      await screen.findByText(/No requests waiting for you/),
    ).toBeOnTheScreen();
    expect(screen.getByText(/You haven't sent any/)).toBeOnTheScreen();
  });
});

describe('send request sheet', () => {
  async function renderSheet(modes: Mode[]) {
    const client = new QueryClient({
      defaultOptions: { mutations: { gcTime: Infinity } },
    });
    jest.spyOn(client, 'invalidateQueries');
    const onSent = jest.fn();
    const onClose = jest.fn();
    await render(
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <SendRequestSheet
            visible
            onClose={onClose}
            member={{ id: 'isha', name: 'Isha', modes }}
            onSent={onSent}
          />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    return { client, onSent, onClose };
  }

  test('with one Eligible Mode it is chosen already; Send sends the note, then closes and refreshes the Inbox', async () => {
    jest.mocked(requests.sendRequest).mockResolvedValue('conn-new');
    const { client, onSent, onClose } = await renderSheet(['friends']);
    expect(
      screen.getByRole('header', { name: 'Say hi to Isha' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Friends', selected: true }),
    ).toBeOnTheScreen();
    await fireEvent.changeText(
      screen.getByLabelText('Add a short note (optional)'),
      'Badminton at Baner?',
    );
    expect(screen.getByText('19/200')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(requests.sendRequest).toHaveBeenCalledWith(
      'isha',
      'friends',
      'Badminton at Baner?',
    );
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Send request' }),
      ).not.toBeBusy(),
    );
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: chatKeys.conversations,
    });
  });

  test('with several Eligible Modes the Member picks one before sending', async () => {
    jest.mocked(requests.sendRequest).mockResolvedValue('conn-new');
    const { onSent } = await renderSheet(['friends', 'networking']);
    const send = screen.getByRole('button', { name: 'Send request' });
    expect(send).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Networking' }));
    expect(
      screen.getByRole('button', { name: 'Networking', selected: true }),
    ).toBeOnTheScreen();
    await fireEvent.press(send);
    expect(requests.sendRequest).toHaveBeenCalledWith('isha', 'networking', '');
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    await waitFor(() => expect(send).not.toBeBusy());
  });

  test('a refused request shows why in the sheet and keeps it open', async () => {
    jest
      .mocked(requests.sendRequest)
      .mockRejectedValue(
        new Error("This member isn't available for requests right now."),
      );
    const { onSent, onClose } = await renderSheet(['friends']);
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(
      await screen.findByText(
        "This member isn't available for requests right now.",
      ),
    ).toBeOnTheScreen();
    expect(onSent).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('the note stops at 200 characters', async () => {
    await renderSheet(['friends']);
    expect(
      screen.getByLabelText('Add a short note (optional)').props.maxLength,
    ).toBe(200);
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import type { MyJoinRequest } from '../src/features/activities/model';
import * as catalog from '../src/features/catalog/api';
import * as chat from '../src/features/chat/api';
import type { Conversation } from '../src/features/chat/api';
import { chatKeys } from '../src/features/chat/queries';
import type { Mode } from '../src/features/modes';
import * as requests from '../src/features/requests/api';
import { navigationRef } from '../src/navigation/navigationRef';
import { SendRequestSheet } from '../src/screens/requests/SendRequestSheet';
import { areas } from '../test/catalog';
import { renderApp, sessionFor } from '../test/render';

const member = jest.requireMock<
  typeof import('../src/features/live/__mocks__/memberChannel')
>('../src/features/live/memberChannel');

jest.mock('../src/features/account/api');
jest.mock('../src/features/activities/api');
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
  mode: 'dating',
  direction: 'outgoing',
});
// Far enough ahead that the label doesn't depend on today's date.
const nextYear = new Date().getUTCFullYear() + 1;
const joinRequest = (overrides: Partial<MyJoinRequest>): MyJoinRequest => ({
  id: 'join-kabir',
  activityId: 'badminton',
  activityTitle: 'Badminton doubles',
  activityStartsAt: `${nextYear}-01-15T13:30:00Z`,
  otherId: 'kabir',
  otherName: 'Kabir',
  otherPhotoId: null,
  direction: 'incoming',
  createdAt: '2026-10-12T10:00:00Z',
  ...overrides,
});
const kabirJoins = joinRequest({});
const askedTrek = joinRequest({
  id: 'join-trek',
  activityId: 'trek',
  activityTitle: 'Sinhagad trek',
  otherId: 'neha',
  otherName: 'Neha',
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
  jest.mocked(catalog.fetchAreas).mockResolvedValue(areas({ wakad: 'Wakad' }));
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
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
});

async function openInbox() {
  const app = await renderApp(me);
  await fireEvent.press(await screen.findByRole('tab', { name: /^Inbox/ }));
  await screen.findByText('Waiting for you');
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

  test('a sent request shows the Mode it went under', async () => {
    await openInbox();
    const sent = within(screen.getByTestId('sent-requests'));
    expect(sent.getByText('Dating')).toBeOnTheScreen();
  });

  test('View profile on a request opens their profile', async () => {
    await openInbox();
    await fireEvent.press(
      screen.getByRole('button', { name: "View Rohan's profile" }),
    );
    expect(navigationRef.getCurrentRoute()).toMatchObject({
      name: 'Profile',
      params: { memberId: 'rohan' },
    });
  });

  test('a sent request opens their profile', async () => {
    await openInbox();
    await fireEvent.press(
      screen.getByRole('button', { name: /^Meera, .*see their profile$/ }),
    );
    expect(navigationRef.getCurrentRoute()).toMatchObject({
      name: 'Profile',
      params: { memberId: 'meera' },
    });
  });

  test('the Inbox tab shows how many requests are waiting', async () => {
    await renderApp(me);
    expect(
      await screen.findByRole('tab', { name: 'Inbox, 2 waiting' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('2')).toBeOnTheScreen();
  });

  test('a new request shows on the Inbox badge as soon as it arrives on my Member channel', async () => {
    jest.mocked(chat.fetchConversations).mockResolvedValue([meera, isha]);
    await renderApp(me);
    await screen.findByRole('tab', { name: 'Inbox' });
    jest
      .mocked(chat.fetchConversations)
      .mockResolvedValue([rohan, meera, isha]);
    await act(() =>
      member.emitMemberEvent({
        event: 'connection',
        payload: { connection_id: 'conn-rohan' },
      }),
    );
    expect(
      await screen.findByRole('tab', { name: 'Inbox, 1 waiting' }),
    ).toBeOnTheScreen();
  });

  test('unread messages count on the Inbox badge too (#202)', async () => {
    jest
      .mocked(chat.fetchConversations)
      .mockResolvedValue([
        rohan,
        { ...isha, unreadCount: 3 },
        { ...anaya, status: 'accepted', unreadCount: 1 },
      ]);
    await renderApp(me);
    // One waiting request and two chats with something unread.
    expect(
      await screen.findByRole('tab', { name: 'Inbox, 3 waiting' }),
    ).toBeOnTheScreen();
  });

  test('a message arriving while the app is open says so, and opens the chat (#202)', async () => {
    jest.mocked(chat.fetchConversations).mockResolvedValue([isha]);
    await renderApp(me);
    await screen.findByRole('tab', { name: 'Inbox' });
    await act(() =>
      member.emitMemberEvent({
        event: 'message',
        payload: {
          connection_id: 'conn-isha',
          sender_id: 'isha',
          type: 'text',
          body: 'Still on for Saturday?',
        },
      }),
    );
    const banner = await screen.findByRole('button', {
      name: 'Isha: Still on for Saturday?. Opens the chat',
    });
    await fireEvent.press(banner);
    expect(
      await screen.findByRole('header', { name: 'Isha' }),
    ).toBeOnTheScreen();
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

describe('Inbox Join Requests', () => {
  beforeEach(() => {
    jest
      .mocked(activities.fetchMyJoinRequests)
      .mockResolvedValue([kabirJoins, askedTrek]);
  });

  test('a request to join my Activity waits for an answer; my own sits under Sent', async () => {
    await openInbox();
    expect(
      screen.getByText(/^Asks to join Badminton doubles, \w+ 15 Jan, 7:00 pm$/),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: "Accept Kabir's Join Request" }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: "Decline Kabir's Join Request" }),
    ).toBeOnTheScreen();
    const sent = within(screen.getByTestId('sent-requests'));
    expect(sent.getByText('Sinhagad trek')).toBeOnTheScreen();
    expect(sent.getByText('Join Request, hosted by Neha')).toBeOnTheScreen();
    expect(sent.getByText('Waiting')).toBeOnTheScreen();
  });

  test('the Inbox tab counts Join Requests waiting for me too', async () => {
    await renderApp(me);
    expect(
      await screen.findByRole('tab', { name: 'Inbox, 3 waiting' }),
    ).toBeOnTheScreen();
  });

  test('a new Join Request shows on the Inbox badge as soon as it arrives on my Member channel', async () => {
    jest.mocked(chat.fetchConversations).mockResolvedValue([meera, isha]);
    jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([askedTrek]);
    await renderApp(me);
    await screen.findByRole('tab', { name: 'Inbox' });
    jest
      .mocked(activities.fetchMyJoinRequests)
      .mockResolvedValue([kabirJoins, askedTrek]);
    await act(() =>
      member.emitMemberEvent({
        event: 'join-request',
        payload: { activity_id: 'badminton' },
      }),
    );
    expect(
      await screen.findByRole('tab', { name: 'Inbox, 1 waiting' }),
    ).toBeOnTheScreen();
  });

  test('accepting a Join Request opens the chat with the joiner', async () => {
    const kabir = conversation({
      connectionId: 'conn-kabir',
      otherId: 'kabir',
      otherName: 'Kabir',
      status: 'accepted',
      mode: 'activities',
      note: null,
    });
    jest.mocked(activities.respondJoinRequest).mockImplementation(async () => {
      jest
        .mocked(chat.fetchConversations)
        .mockResolvedValue([rohan, anaya, meera, kabir]);
      jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
      return 'conn-kabir';
    });
    await openInbox();
    await fireEvent.press(
      screen.getByRole('button', { name: "Accept Kabir's Join Request" }),
    );
    expect(activities.respondJoinRequest).toHaveBeenCalledWith(
      'join-kabir',
      true,
    );
    expect(await screen.findByLabelText('Chat menu')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Kabir' })).toBeOnTheScreen();
  });

  test('accepting still opens the chat when the card leaves the list before the refresh ends', async () => {
    const kabir = conversation({
      connectionId: 'conn-kabir',
      otherId: 'kabir',
      otherName: 'Kabir',
      status: 'accepted',
      mode: 'activities',
      note: null,
    });
    jest.mocked(activities.respondJoinRequest).mockImplementation(async () => {
      jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
      // The chat list answers late, so the card is gone before the accept finishes.
      const after = [rohan, anaya, meera, kabir];
      jest
        .mocked(chat.fetchConversations)
        .mockImplementationOnce(
          () => new Promise(resolve => setTimeout(() => resolve(after), 50)),
        )
        .mockResolvedValue(after);
      return 'conn-kabir';
    });
    await openInbox();
    await fireEvent.press(
      screen.getByRole('button', { name: "Accept Kabir's Join Request" }),
    );
    expect(await screen.findByLabelText('Chat menu')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Kabir' })).toBeOnTheScreen();
    // Let the chat's own loads land inside act before the test ends.
    await act(() => new Promise<void>(resolve => setTimeout(resolve, 100)));
  });

  test('declining a Join Request removes it and opens nothing', async () => {
    jest.mocked(activities.respondJoinRequest).mockImplementation(async () => {
      jest
        .mocked(activities.fetchMyJoinRequests)
        .mockResolvedValue([askedTrek]);
      return null;
    });
    await openInbox();
    await fireEvent.press(
      screen.getByRole('button', { name: "Decline Kabir's Join Request" }),
    );
    expect(activities.respondJoinRequest).toHaveBeenCalledWith(
      'join-kabir',
      false,
    );
    await waitFor(() =>
      expect(
        screen.queryByText(/^Asks to join Badminton doubles/),
      ).not.toBeOnTheScreen(),
    );
    expect(screen.queryByLabelText('Chat menu')).not.toBeOnTheScreen();
  });

  test('a refused answer says why on the card', async () => {
    jest
      .mocked(activities.respondJoinRequest)
      .mockRejectedValue(
        new Error('There are no spots left on this Activity.'),
      );
    await openInbox();
    await fireEvent.press(
      screen.getByRole('button', { name: "Accept Kabir's Join Request" }),
    );
    expect(
      await screen.findByText('There are no spots left on this Activity.'),
    ).toBeOnTheScreen();
  });

  test('tapping a Join Request opens its Activity', async () => {
    jest.mocked(activities.fetchActivity).mockResolvedValue({
      id: 'badminton',
      hostId: me.user.id,
      hostName: 'Asha',
      title: 'Badminton doubles',
      type: 'sports',
      areaId: 'wakad',
      startsAt: kabirJoins.activityStartsAt,
      endsAt: null,
      capacity: 4,
      spotsLeft: 4,
      description: null,
      startsWhen: 'later',
      isMine: true,
      circleId: null,
      circleName: null,
      hostPhotoId: null,
      status: 'open',
      venueDetail: null,
      isLocked: false,
      myRequest: null,
      connectionId: null,
    });
    jest.mocked(activities.fetchJoinRequests).mockResolvedValue([]);
    await openInbox();
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Kabir asks to join Badminton doubles. Open the Activity',
      }),
    );
    expect(
      await screen.findByRole('header', { name: 'Badminton doubles' }),
    ).toBeOnTheScreen();
    expect(activities.fetchActivity).toHaveBeenCalledWith('badminton');
  });
});

describe('send request sheet', () => {
  async function renderSheet(modes: Mode[], sharedModes: Mode[] = modes) {
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
            member={{ id: 'isha', name: 'Isha', modes, sharedModes }}
            onSent={onSent}
          />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    return { client, onSent, onClose };
  }

  test('with one Mode its chip is chosen already; Send sends the note, then closes and refreshes the Inbox', async () => {
    jest.mocked(requests.sendRequest).mockResolvedValue('conn-new');
    const { client, onSent, onClose } = await renderSheet(['friends']);
    expect(
      screen.getByRole('header', { name: 'Say hi to Isha' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /Friends/, selected: true }),
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

  test('their Modes are listed shared first and marked, the first shared one chosen; another can be picked', async () => {
    jest.mocked(requests.sendRequest).mockResolvedValue('conn-new');
    const { onSent } = await renderSheet(
      ['activities', 'dating', 'friends', 'networking'],
      ['dating', 'friends'],
    );
    expect(
      screen
        .getAllByText(/^(Activities|Dating|Friends|Networking)$/)
        .map(t => t.props.children),
    ).toEqual(['Dating', 'Friends', 'Activities', 'Networking']);
    expect(
      screen.getByRole('button', { name: 'Dating Shared', selected: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Friends Shared', selected: false }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Activities', selected: false }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Isha's Modes. Shared ones come first."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Networking' }));
    expect(
      screen.getByRole('button', { name: 'Networking', selected: true }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    // Networking isn't shared, so it asks before sending (#200).
    expect(requests.sendRequest).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        "You and Isha haven't both chosen Networking. Connect anyway?",
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Connect anyway' }),
    );
    expect(requests.sendRequest).toHaveBeenCalledWith('isha', 'networking', '');
    await waitFor(() => expect(onSent).toHaveBeenCalled());
  });

  test('a shared Mode sends straight away, with no warning (#200)', async () => {
    jest.mocked(requests.sendRequest).mockResolvedValue('conn-new');
    const { onSent } = await renderSheet(
      ['friends', 'networking'],
      ['friends'],
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(requests.sendRequest).toHaveBeenCalledWith('isha', 'friends', '');
    expect(screen.queryByText(/Connect anyway/)).toBeNull();
    await waitFor(() => expect(onSent).toHaveBeenCalled());
  });

  test('with no shared Mode the first of theirs is chosen and the sheet says so', async () => {
    await renderSheet(['activities', 'networking'], []);
    expect(
      screen.getByRole('button', { name: 'Activities', selected: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Shared')).not.toBeOnTheScreen();
    expect(
      screen.getByText("You don't share a Mode with Isha. Pick one of Isha's."),
    ).toBeOnTheScreen();
  });

  test('Casual carries its adult-intent label', async () => {
    await renderSheet(['casual', 'friends']);
    expect(
      screen.getByRole('button', { name: /^Casual.*18\+ · adults only/ }),
    ).toBeOnTheScreen();
  });

  test('a refused request shows why in the sheet and keeps it open', async () => {
    jest
      .mocked(requests.sendRequest)
      .mockRejectedValue(
        new Error("This Member isn't available for requests right now."),
      );
    const { onSent, onClose } = await renderSheet(['friends']);
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(
      await screen.findByText(
        "This Member isn't available for requests right now.",
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

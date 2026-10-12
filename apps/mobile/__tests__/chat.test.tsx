import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as catalog from '../src/features/catalog/api';
import * as chat from '../src/features/chat/api';
import type { Conversation, Message } from '../src/features/chat/api';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');

const me = sessionFor('asha@example.com');
const myId = me.user.id;

const conversation = (overrides: Partial<Conversation>): Conversation => ({
  connectionId: 'conn-isha',
  otherId: 'isha',
  otherName: 'Isha',
  otherPhotoId: null,
  otherAreaId: 'baner',
  mode: 'friends',
  status: 'accepted',
  direction: 'incoming',
  note: null,
  lastMessage: null,
  unreadCount: 0,
  ...overrides,
});

const message = (overrides: Partial<Message>): Message => ({
  id: 'm1',
  connectionId: 'conn-isha',
  senderId: 'isha',
  type: 'text',
  body: 'Hey!',
  activityId: null,
  createdAt: '2026-10-12T10:00:00.000Z',
  ...overrides,
});

const isha = conversation({
  lastMessage: {
    type: 'text',
    body: 'Count me in. 7:30?',
    at: '2026-10-12T10:00:00.000Z',
  },
  unreadCount: 1,
});
const kabir = conversation({
  connectionId: 'conn-kabir',
  otherId: 'kabir',
  otherName: 'Kabir',
  status: 'closed',
});
const rohan = conversation({
  connectionId: 'conn-rohan',
  otherId: 'rohan',
  otherName: 'Rohan',
  status: 'requested',
});

let live: Parameters<typeof chat.subscribeToChat>[1] | undefined;

beforeEach(() => {
  live = undefined;
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(catalog.fetchAreaNames).mockResolvedValue({ baner: 'Baner' });
  jest.mocked(chat.fetchConversations).mockResolvedValue([isha, kabir, rohan]);
  jest
    .mocked(chat.fetchMessages)
    .mockResolvedValue([
      message({ id: 'm1', body: 'Hey! Saw you play badminton at Baner too?' }),
    ]);
  jest
    .mocked(chat.fetchChatState)
    .mockResolvedValue({ otherLastReadAt: null, muted: false });
  jest.mocked(chat.markRead).mockResolvedValue();
  jest.mocked(chat.subscribeToChat).mockImplementation((_id, handlers) => {
    live = handlers;
    return () => {};
  });
  jest.mocked(chat.fetchOpenModeChange).mockResolvedValue(null);
  jest
    .mocked(chat.fetchEligibleModes)
    .mockResolvedValue(['friends', 'activities', 'networking']);
  let n = 0;
  jest.mocked(chat.newMessageId).mockImplementation(() => `new-${++n}`);
});

async function openInbox() {
  const app = await renderApp(me);
  await fireEvent.press(await screen.findByRole('tab', { name: 'Inbox' }));
  return app;
}

async function openChatWith(name: string) {
  const app = await openInbox();
  await fireEvent.press(
    await screen.findByRole('button', { name: new RegExp(`^${name}`) }),
  );
  await screen.findByLabelText('Chat menu');
  // Let the screen's loads (area names, messages, read state) land before the test goes on.
  await screen.findByText(name === 'Isha' ? 'Baner' : name);
  return app;
}

describe('chat list', () => {
  test('lists accepted and closed chats with preview and unread, but not pending requests', async () => {
    await openInbox();
    expect(
      await screen.findByRole('tab', { name: 'Chats', selected: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: /^Isha, Count me in\. 7:30\?, 1 unread/,
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /^Kabir, Closed/ }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Rohan')).not.toBeOnTheScreen();
  });

  test('with no chats yet, says how they start', async () => {
    jest.mocked(chat.fetchConversations).mockResolvedValue([rohan]);
    await openInbox();
    expect(await screen.findByText(/No chats yet/)).toBeOnTheScreen();
  });
});

describe('a chat', () => {
  test('shows the other Member, the first-meet safety note and the messages, and marks them read', async () => {
    await openChatWith('Isha');
    expect(screen.getByRole('header', { name: 'Isha' })).toBeOnTheScreen();
    expect(await screen.findByText('Baner')).toBeOnTheScreen();
    expect(
      screen.getByText(/Meet in public places and tell a friend/),
    ).toBeOnTheScreen();
    expect(
      await screen.findByText('Hey! Saw you play badminton at Baner too?'),
    ).toBeOnTheScreen();
    expect(chat.markRead).toHaveBeenCalledWith(
      'conn-isha',
      '2026-10-12T10:00:00.000Z',
    );
  });

  test('a sent message shows at once and is sent with a phone-made id', async () => {
    let finish: () => void = () => {};
    jest
      .mocked(chat.sendMessage)
      .mockReturnValue(new Promise<void>(resolve => (finish = resolve)));
    await openChatWith('Isha');
    await fireEvent.changeText(
      screen.getByLabelText('Message'),
      'Yes, Tuesdays mostly.',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Yes, Tuesdays mostly.')).toBeOnTheScreen();
    expect(screen.getByText('Sending…')).toBeOnTheScreen();
    expect(chat.sendMessage).toHaveBeenCalledWith({
      id: 'new-1',
      connectionId: 'conn-isha',
      body: 'Yes, Tuesdays mostly.',
    });
    expect(screen.getByLabelText('Message').props.value).toBe('');
    await act(async () => finish());
  });

  test('a failed send offers a retry that reuses the same id', async () => {
    jest
      .mocked(chat.sendMessage)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue();
    await openChatWith('Isha');
    await fireEvent.changeText(screen.getByLabelText('Message'), 'Count me in');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    await fireEvent.press(
      await screen.findByRole('button', { name: /Not sent\. Tap to retry/ }),
    );
    expect(chat.sendMessage).toHaveBeenNthCalledWith(2, {
      id: 'new-1',
      connectionId: 'conn-isha',
      body: 'Count me in',
    });
  });

  test('a send refused because the chat just closed says why instead of offering a retry', async () => {
    jest
      .mocked(chat.sendMessage)
      .mockRejectedValue(new Error(chat.cannotSendMessage));
    await openChatWith('Isha');
    await fireEvent.changeText(
      screen.getByLabelText('Message'),
      'Still there?',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(chat.cannotSendMessage)).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: /Tap to retry/ }),
    ).not.toBeOnTheScreen();
  });

  test('a send that went through stops showing "Sending…" even if confirming it fails', async () => {
    jest.mocked(chat.sendMessage).mockResolvedValue();
    await openChatWith('Isha');
    jest.mocked(chat.fetchMessages).mockRejectedValue(new Error('offline'));
    await fireEvent.changeText(screen.getByLabelText('Message'), 'On my way');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('On my way')).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.queryByText('Sending…')).not.toBeOnTheScreen(),
    );
  });

  test('a message from the other side appears live and is marked read', async () => {
    await openChatWith('Isha');
    await act(async () =>
      live!.onMessage(
        message({
          id: 'm2',
          body: 'Count me in. 7:30?',
          createdAt: '2026-10-12T10:05:00.000Z',
        }),
      ),
    );
    expect(await screen.findByText('Count me in. 7:30?')).toBeOnTheScreen();
    expect(chat.markRead).toHaveBeenLastCalledWith(
      'conn-isha',
      '2026-10-12T10:05:00.000Z',
    );
  });

  test('on (re)connecting it catches up from a little before the newest message seen', async () => {
    await openChatWith('Isha');
    await screen.findByText('Hey! Saw you play badminton at Baner too?');
    jest.mocked(chat.fetchMessages).mockResolvedValue([
      message({
        id: 'm3',
        body: 'Missed while offline',
        createdAt: '2026-10-12T10:09:00.000Z',
      }),
    ]);
    await act(async () => live!.onStatus!('live'));
    expect(chat.fetchMessages).toHaveBeenLastCalledWith(
      'conn-isha',
      '2026-10-12T09:59:30.000Z',
    );
    expect(await screen.findByText('Missed while offline')).toBeOnTheScreen();
    expect(
      screen.getByText('Hey! Saw you play badminton at Baner too?'),
    ).toBeOnTheScreen();
  });

  test('my last message shows "Seen" once the other side has read it', async () => {
    jest.mocked(chat.fetchMessages).mockResolvedValue([
      message({
        id: 'm1',
        senderId: myId,
        body: 'Coffee?',
        createdAt: '2026-10-12T10:00:00.000Z',
      }),
    ]);
    jest.mocked(chat.fetchChatState).mockResolvedValue({
      otherLastReadAt: '2026-10-12T10:01:00.000Z',
      muted: false,
    });
    await openChatWith('Isha');
    expect(await screen.findByText('Seen')).toBeOnTheScreen();
  });

  test('an Activity card message shows as a card', async () => {
    jest.mocked(chat.fetchMessages).mockResolvedValue([
      message({
        id: 'm4',
        type: 'activity_card',
        body: null,
        activityId: 'a1',
      }),
    ]);
    await openChatWith('Isha');
    expect(await screen.findByLabelText('Activity')).toBeOnTheScreen();
  });

  test('a closed chat can be read but not written in, and says why', async () => {
    await openChatWith('Kabir');
    expect(
      await screen.findByText('This chat is closed. You can still read it.'),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText('Message')).not.toBeOnTheScreen();
  });
});

describe('chat menu', () => {
  async function openMenu() {
    await openChatWith('Isha');
    await fireEvent.press(screen.getByLabelText('Chat menu'));
  }

  test('Mute silences this chat for me', async () => {
    jest.mocked(chat.setMuted).mockResolvedValue();
    await openMenu();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Mute notifications' }),
    );
    expect(chat.setMuted).toHaveBeenCalledWith('conn-isha', true);
  });

  test('Block asks first, then blocks the other Member', async () => {
    jest.mocked(chat.blockMember).mockImplementation(async () => {
      jest
        .mocked(chat.fetchConversations)
        .mockResolvedValue([{ ...isha, status: 'closed' }]);
    });
    await openMenu();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Block Isha' }),
    );
    expect(chat.blockMember).not.toHaveBeenCalled();
    const sheet = await screen.findByText(/won't be able to message you/);
    expect(sheet).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Block' }));
    expect(chat.blockMember).toHaveBeenCalledWith('isha');
    expect(
      await screen.findByText('This chat is closed. You can still read it.'),
    ).toBeOnTheScreen();
  });

  test('a menu action that fails says so', async () => {
    jest.mocked(chat.blockMember).mockRejectedValue(new Error('offline'));
    await openMenu();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Block Isha' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Block' }));
    expect(
      await screen.findByText(
        "That didn't work. Check your connection and try again.",
      ),
    ).toBeOnTheScreen();
  });

  test('Close chat asks first, then closes the Connection', async () => {
    jest.mocked(chat.closeConnection).mockImplementation(async () => {
      jest
        .mocked(chat.fetchConversations)
        .mockResolvedValue([{ ...isha, status: 'closed' }]);
    });
    await openMenu();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Close chat' }),
    );
    expect(chat.closeConnection).not.toHaveBeenCalled();
    const confirm = within(await screen.findByTestId('confirm-close'));
    await fireEvent.press(confirm.getByRole('button', { name: 'Close chat' }));
    expect(chat.closeConnection).toHaveBeenCalledWith('conn-isha');
    expect(
      await screen.findByText('This chat is closed. You can still read it.'),
    ).toBeOnTheScreen();
  });
});

describe('Mode Change', () => {
  test("the chat header shows the Connection's Mode", async () => {
    await openChatWith('Isha');
    expect(screen.getByText('Friends')).toBeOnTheScreen();
  });

  test('Change Mode offers only the other Eligible Modes, and a proposal then waits for an answer', async () => {
    jest.mocked(chat.proposeModeChange).mockImplementation(async () => {
      jest.mocked(chat.fetchOpenModeChange).mockResolvedValue({
        id: 'mc1',
        proposedBy: myId,
        fromMode: 'friends',
        toMode: 'activities',
        proposedAt: '2026-10-12T10:00:00.000Z',
      });
    });
    await openChatWith('Isha');
    await fireEvent.press(screen.getByLabelText('Chat menu'));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Change Mode' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Activities' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Networking' }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Friends' }),
    ).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Activities' }));
    expect(chat.proposeModeChange).toHaveBeenCalledWith(
      'conn-isha',
      'activities',
    );
    expect(
      await screen.findByText(
        'You suggested moving to Activities. Waiting for Isha.',
      ),
    ).toBeOnTheScreen();
  });

  test('a refused proposal says why', async () => {
    jest
      .mocked(chat.proposeModeChange)
      .mockRejectedValue(
        new Error("There's already a Mode Change waiting for an answer."),
      );
    await openChatWith('Isha');
    await fireEvent.press(screen.getByLabelText('Chat menu'));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Change Mode' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Activities' }),
    );
    expect(
      await screen.findByText(
        "There's already a Mode Change waiting for an answer.",
      ),
    ).toBeOnTheScreen();
  });

  test('the other side can accept, and the header moves to the new Mode', async () => {
    jest.mocked(chat.fetchOpenModeChange).mockResolvedValue({
      id: 'mc2',
      proposedBy: 'isha',
      fromMode: 'friends',
      toMode: 'activities',
      proposedAt: '2026-10-12T10:00:00.000Z',
    });
    jest.mocked(chat.respondModeChange).mockImplementation(async () => {
      jest.mocked(chat.fetchOpenModeChange).mockResolvedValue(null);
      jest
        .mocked(chat.fetchConversations)
        .mockResolvedValue([{ ...isha, mode: 'activities' }]);
    });
    await openChatWith('Isha');
    expect(
      await screen.findByText(
        'Isha would like to move this chat to Activities.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Accept' }));
    expect(chat.respondModeChange).toHaveBeenCalledWith('mc2', true);
    expect(await screen.findByText('Activities')).toBeOnTheScreen();
    expect(
      screen.queryByText(/would like to move this chat/),
    ).not.toBeOnTheScreen();
  });

  test('when the other side accepts my proposal, my header moves to the new Mode', async () => {
    jest.mocked(chat.fetchOpenModeChange).mockResolvedValue({
      id: 'mc4',
      proposedBy: myId,
      fromMode: 'friends',
      toMode: 'activities',
      proposedAt: '2026-10-12T10:00:00.000Z',
    });
    const { client } = await openChatWith('Isha');
    expect(
      await screen.findByText(
        'You suggested moving to Activities. Waiting for Isha.',
      ),
    ).toBeOnTheScreen();

    // Isha accepts on her phone; this phone's next check finds no open proposal.
    jest.mocked(chat.fetchOpenModeChange).mockResolvedValue(null);
    jest
      .mocked(chat.fetchConversations)
      .mockResolvedValue([{ ...isha, mode: 'activities' }]);
    await act(async () => {
      await client.invalidateQueries({
        queryKey: ['mode-change', 'conn-isha'],
      });
    });
    expect(await screen.findByText('Activities')).toBeOnTheScreen();
  });

  test('the other side can decline', async () => {
    jest.mocked(chat.fetchOpenModeChange).mockResolvedValue({
      id: 'mc3',
      proposedBy: 'isha',
      fromMode: 'friends',
      toMode: 'activities',
      proposedAt: '2026-10-12T10:00:00.000Z',
    });
    jest.mocked(chat.respondModeChange).mockResolvedValue();
    await openChatWith('Isha');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Decline' }),
    );
    expect(chat.respondModeChange).toHaveBeenCalledWith('mc3', false);
  });

  test('a closed chat offers no Mode Change', async () => {
    await openChatWith('Kabir');
    await fireEvent.press(screen.getByLabelText('Chat menu'));
    await screen.findByRole('button', { name: 'Safety Centre' });
    expect(
      screen.queryByRole('button', { name: 'Change Mode' }),
    ).not.toBeOnTheScreen();
  });
});

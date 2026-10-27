import { fireEvent, screen } from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import * as chat from '../src/features/chat/api';
import type { Conversation } from '../src/features/chat/api';
import * as discover from '../src/features/discover/api';
import * as meetFeedback from '../src/features/meetFeedback/api';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/activities/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/discover/api');
// Keep the real error class, so the screen can tell an earlier answer apart.
jest.mock('../src/features/meetFeedback/api', () => ({
  AlreadyAnsweredError: jest.requireActual('../src/features/meetFeedback/api')
    .AlreadyAnsweredError,
  fetchPendingFeedback: jest.fn(),
  hasAnswered: jest.fn(),
  submitMeetFeedback: jest.fn(),
}));

const me = sessionFor('asha@example.com');

const isha: Conversation = {
  connectionId: 'conn-isha',
  otherId: 'isha',
  otherName: 'Isha',
  otherPhotoId: null,
  mode: 'friends',
  status: 'accepted',
  direction: 'incoming',
  note: null,
  lastMessage: null,
  unreadCount: 0,
};

beforeEach(() => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
  jest.mocked(activities.fetchBoard).mockResolvedValue([]);
  jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
    modes: ['friends'],
    paused: false,
    rangeKm: 10,
    hasLocation: true,
  });
  jest
    .mocked(discover.fetchFeedPage)
    .mockResolvedValue({ cards: [], nextCursor: null });
  jest.mocked(chat.fetchConversations).mockResolvedValue([isha]);
  jest.mocked(chat.fetchMessages).mockResolvedValue([]);
  jest
    .mocked(chat.fetchChatState)
    .mockResolvedValue({ otherLastReadAt: null, muted: false });
  jest.mocked(chat.markRead).mockResolvedValue();
  jest.mocked(chat.subscribeToChat).mockReturnValue(() => {});
  jest.mocked(chat.fetchOpenModeChange).mockResolvedValue(null);
  jest.mocked(meetFeedback.hasAnswered).mockResolvedValue(false);
  jest.mocked(meetFeedback.fetchPendingFeedback).mockResolvedValue([]);
  jest.mocked(meetFeedback.submitMeetFeedback).mockResolvedValue();
});

async function openChatMenu() {
  await renderApp(me);
  await fireEvent.press(await screen.findByRole('tab', { name: /^Inbox/ }));
  await fireEvent.press(screen.getByRole('tab', { name: 'Chats' }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Isha/ }));
  await fireEvent.press(await screen.findByLabelText('Chat menu'));
}

async function answer(met: string, keep: string) {
  await fireEvent.press(await screen.findByRole('radio', { name: met }));
  await fireEvent.press(screen.getByRole('radio', { name: keep }));
}

describe('We met, from the chat menu', () => {
  test('asks both questions and sends the answers about the pair', async () => {
    await openChatMenu();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'We met' }),
    );
    expect(
      await screen.findByRole('header', { name: 'Did you two meet?' }),
    ).toBeOnTheScreen();
    await answer('Yes, we met', 'Not for me');
    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByRole('header', { name: 'Thanks for telling us' }),
    ).toBeOnTheScreen();
    expect(meetFeedback.submitMeetFeedback).toHaveBeenCalledWith({
      otherUserId: 'isha',
      didMeet: true,
      keep: false,
    });
  });

  test('is not offered again once answered', async () => {
    jest.mocked(meetFeedback.hasAnswered).mockResolvedValue(true);
    await openChatMenu();
    expect(
      await screen.findByRole('button', { name: 'Block Isha' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'We met' })).toBeNull();
    expect(meetFeedback.hasAnswered).toHaveBeenCalledWith('isha');
  });

  test('both questions need an answer', async () => {
    await openChatMenu();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'We met' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Submit' }),
    );
    expect(
      await screen.findByText('Answer both questions first.'),
    ).toBeOnTheScreen();
    expect(meetFeedback.submitMeetFeedback).not.toHaveBeenCalled();
  });

  test('a refusal reads as the data module words it', async () => {
    jest
      .mocked(meetFeedback.submitMeetFeedback)
      .mockRejectedValue(
        new Error("You can't answer about this person any more."),
      );
    await openChatMenu();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'We met' }),
    );
    await answer('Not this time', 'Yes, keep it');
    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByText("You can't answer about this person any more."),
    ).toBeOnTheScreen();
  });

  test('an answer already given elsewhere ends on the thanks, not an error', async () => {
    jest
      .mocked(meetFeedback.submitMeetFeedback)
      .mockRejectedValue(new meetFeedback.AlreadyAnsweredError());
    await openChatMenu();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'We met' }),
    );
    await answer('Yes, we met', 'Yes, keep it');
    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByRole('header', { name: 'Thanks for telling us' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("You'd already answered about this one."),
    ).toBeOnTheScreen();
  });
});

describe('after an Activity', () => {
  beforeEach(() => {
    jest.mocked(meetFeedback.fetchPendingFeedback).mockResolvedValue([
      {
        otherUserId: 'isha',
        otherName: 'Isha',
        coverPhotoId: null,
        activityId: 'badminton',
        activityTitle: 'Badminton doubles',
        // Over a week back, so the label doesn't depend on today's date.
        endsAt: '2026-01-01T06:30:00Z',
      },
    ]);
  });

  test('the Activities tab asks about each person and sends the Activity with the answers', async () => {
    await renderApp(me);
    await fireEvent.press(
      await screen.findByRole('tab', { name: /^Activities/ }),
    );
    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Did you meet Isha at Badminton doubles?',
      }),
    );
    expect(await screen.findByText('Badminton doubles')).toBeOnTheScreen();
    expect(screen.getByText('with Isha · on Thu 1 Jan')).toBeOnTheScreen();
    await answer('Yes, we met', 'Yes, keep it');
    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByRole('header', { name: 'Thanks for telling us' }),
    ).toBeOnTheScreen();
    expect(meetFeedback.submitMeetFeedback).toHaveBeenCalledWith({
      otherUserId: 'isha',
      activityId: 'badminton',
      didMeet: true,
      keep: true,
    });
  });

  test('the prompts show even when the board fails to load', async () => {
    jest.mocked(activities.fetchBoard).mockRejectedValue(new Error('offline'));
    await renderApp(me);
    await fireEvent.press(
      await screen.findByRole('tab', { name: /^Activities/ }),
    );
    expect(
      await screen.findByRole('button', {
        name: 'Did you meet Isha at Badminton doubles?',
      }),
    ).toBeOnTheScreen();
    expect(await screen.findByText('offline')).toBeOnTheScreen();
  });
});
